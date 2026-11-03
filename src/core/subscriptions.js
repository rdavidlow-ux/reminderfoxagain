'use strict';
// Calendar subscriptions: calendars read from a web address (holidays, sports, a school or team calendar). They are
// read-only, kept next to the reminders as subscriptions/<id>.ics (so they show without a connection), refreshed on a
// timer, and shown in the Reminders and Month views as each subscription's "show in" choices say.
// Shared by the desktop main process (src/main.js) and the host core of the Thunderbird add-on (src/host/core.js).
// A subscription: { id, url, name, color, refreshHours, showList, showMonth, autoDone, updated, error, count }, kept in
// settings.subscriptions. Its items' uids are "sub:<id>:<uid>" in the views.
// Ticks: an item from a subscription can be marked completed. The calendar's file is replaced on every refresh, so the
// ticks are kept apart from it (the host keeps them in state.json as subsDone: { <id>: { "<uid>|<YYYY-MM-DD>": when } })
// and laid over its rows; a refresh drops the ticks of items the calendar no longer has. With autoDone, an item whose
// time is over counts as completed without a tick; unticking one keeps it open (stored as 0).
const HOUR = 3600000;
const MAX_BYTES = 10 * 1024 * 1024;
const COLORS = ['#2e7d32', '#1565c0', '#6a1b9a', '#00838f', '#c62828', '#ef6c00', '#5d4037', '#ad1457'];
const REFRESH = [1, 6, 12, 24, 168];
const PREFIX = 'sub:';

// the address as fetched: webcal:// is https://
function normalizeUrl(u) {
  const s = String(u || '').trim().replace(/^webcals?:\/\//i, 'https://');
  let url = null;
  try { url = new URL(s); } catch (e) { url = null; }
  if (!url || !/^https?:$/.test(url.protocol) || !url.hostname) throw new Error('Please enter a web address starting with https://, http:// or webcal://.');
  return url.href;
}
// the calendar's own name (X-WR-CALNAME), unfolded and unescaped
function calendarName(text) {
  const m = /^X-WR-CALNAME(?:;[^:\r\n]*)?:(.*(?:\r?\n[ \t].*)*)/im.exec(String(text || ''));
  return m ? m[1].replace(/\r?\n[ \t]/g, '').replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ').trim().slice(0, 80) : '';
}
const isSubUid = (uid) => String(uid || '').startsWith(PREFIX);
function splitUid(uid) {
  const s = String(uid || '').slice(PREFIX.length);
  const i = s.indexOf(':');
  return i < 0 ? { id: '', uid: '' } : { id: s.slice(0, i), uid: s.slice(i + 1) };
}

function createSubscriptions({ Store, getList, setList, read, write, remove, fetchText, now, setTimer, clearTimer, onChange, newId, getDone, setDone }) {
  const stores = new Map(); // id → Store of its last good copy
  let timer = null;
  let running = null;
  const list = () => (Array.isArray(getList()) ? getList() : []);
  const fileOf = (id) => `subscriptions/${id}.ics`;
  const find = (id) => list().find((s) => s.id === id) || null;
  const save = (next) => { setList(next); if (onChange) onChange(); };
  const patchOne = (id, patch) => save(list().map((s) => (s.id === id ? { ...s, ...patch } : s)));
  // ticks: { <id>: { "<uid>|<day>": when ticked } }
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayOf = (ms) => { const d = new Date(Number(ms)); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const doneAll = () => { const d = getDone ? getDone() : null; return d && typeof d === 'object' ? d : {}; };
  const doneOf = (id) => doneAll()[id] || {};
  function saveDone(id, ticks) {
    if (!setDone) return;
    const all = { ...doneAll() };
    if (ticks && Object.keys(ticks).length) all[id] = ticks; else delete all[id];
    setDone(all);
  }
  // after a refresh: keep only the ticks of items the calendar still has
  function pruneDone(id, store) {
    const ticks = doneOf(id);
    const keep = {};
    for (const [k, at] of Object.entries(ticks)) if (store.items.has(k.slice(0, k.lastIndexOf('|')))) keep[k] = at;
    if (Object.keys(keep).length !== Object.keys(ticks).length) saveDone(id, keep);
  }

  // a fetched text that is a calendar, as a store; otherwise an error the person can understand
  function parse(text) {
    const t = String(text == null ? '' : text);
    if (t.length > MAX_BYTES) throw new Error('That calendar is too big (more than 10 MB).');
    if (!/BEGIN:VCALENDAR/i.test(t)) throw new Error('That address did not give a calendar (an .ics file).');
    let store = null;
    try { store = new Store(t); } catch (e) { throw new Error('That calendar could not be read.'); }
    return store;
  }
  const countOf = (store) => { let n = 0; for (const it of store.items.values()) if (it.master.name === 'vevent') n++; return n; };

  async function load() {
    for (const s of list()) {
      try { const text = await read(fileOf(s.id)); if (text) stores.set(s.id, new Store(text)); } catch (e) { /* refreshed later */ }
    }
    schedule();
  }

  async function add(o) {
    const url = normalizeUrl(o && o.url);
    if (list().some((s) => s.url === url)) throw new Error('You already subscribe to that calendar.');
    const text = await fetchText(url);
    const store = parse(text);
    const used = new Set(list().map((s) => s.color));
    const id = newId();
    const host = new URL(url).hostname.replace(/^www\./, '');
    const sub = {
      id, url, name: String((o && o.name) || '').trim().slice(0, 80) || calendarName(text) || host,
      color: /^#[0-9a-f]{6}$/i.test((o && o.color) || '') ? o.color.toLowerCase() : (COLORS.find((c) => !used.has(c)) || COLORS[list().length % COLORS.length]),
      refreshHours: 24, showList: true, showMonth: true, autoDone: false, updated: now(), error: '', count: countOf(store),
    };
    await write(fileOf(id), text);
    stores.set(id, store);
    save([...list(), sub]);
    schedule();
    return sub;
  }

  function update(id, patch) {
    if (!find(id)) throw new Error('That subscription no longer exists.');
    const p = {};
    if (typeof patch.name === 'string' && patch.name.trim()) p.name = patch.name.trim().slice(0, 80);
    if (/^#[0-9a-f]{6}$/i.test(patch.color || '')) p.color = patch.color.toLowerCase();
    if (REFRESH.includes(Number(patch.refreshHours))) p.refreshHours = Number(patch.refreshHours);
    if (typeof patch.showList === 'boolean') p.showList = patch.showList;
    if (typeof patch.showMonth === 'boolean') p.showMonth = patch.showMonth;
    if (typeof patch.autoDone === 'boolean') p.autoDone = patch.autoDone;
    patchOne(id, p);
    schedule();
    return find(id);
  }

  async function removeSub(id) {
    if (!find(id)) return false;
    stores.delete(id);
    saveDone(id, null);
    try { await remove(fileOf(id)); } catch (e) { /* already gone */ }
    save(list().filter((s) => s.id !== id));
    schedule();
    return true;
  }

  // fetch one subscription again; a failure keeps the last good copy and says why
  async function refreshOne(id) {
    const s = find(id);
    if (!s) throw new Error('That subscription no longer exists.');
    try {
      const text = await fetchText(s.url);
      const store = parse(text);
      await write(fileOf(id), text);
      stores.set(id, store);
      pruneDone(id, store);
      patchOne(id, { updated: now(), error: '', count: countOf(store), tried: now() });
      return true;
    } catch (e) {
      patchOne(id, { error: String((e && e.message) || e).slice(0, 200), tried: now() });
      return false;
    }
  }
  // id: one subscription; without: every one that is due (force: all of them)
  function refresh(id, force) {
    if (id) return refreshOne(id).finally(schedule);
    if (running) return running;
    const at = now();
    const due = list().filter((s) => force || dueAt(s) <= at);
    running = (async () => { for (const s of due) await refreshOne(s.id); })().finally(() => { running = null; schedule(); });
    return running;
  }
  // when it is due: its refresh time after the last good copy; after a failure, half an hour after trying
  const dueAt = (s) => Math.min((s.updated || 0) + (Number(s.refreshHours) || 24) * HOUR, s.error ? (s.tried || 0) + 0.5 * HOUR : Infinity);
  function schedule() {
    if (timer != null) clearTimer(timer);
    timer = null;
    if (!list().length) return;
    const next = Math.min(...list().map(dueAt));
    timer = setTimer(() => { timer = null; refresh(); }, Math.max(5000, Math.min(next - now(), 6 * HOUR)));
  }

  // rows for a view ('list' | 'month'): from each subscription shown there, its events, marked as read-only
  function rows(view, fn) {
    const out = [];
    for (const s of list()) {
      if ((view === 'month' ? s.showMonth : s.showList) === false) continue;
      const store = stores.get(s.id);
      if (!store) continue;
      let r = [];
      try { r = fn(store); } catch (e) { r = []; }
      const ticks = doneOf(s.id);
      const at0 = now();
      for (const x of r) {
        if (x.kind !== 'event') continue;
        const at = ticks[`${x.uid}|${dayOf(x.start)}`];
        // ticked (a time), unticked on purpose (0), or, with autoDone, over: its end (or start) has passed
        const over = !!s.autoDone && at !== 0 && (x.end != null && x.end > x.start ? x.end : x.start) <= at0;
        const done = !!at || over;
        out.push({ ...x, uid: `${PREFIX}${s.id}:${x.uid}`, sub: s.id, subName: s.name, subColor: s.color, readOnly: true, hasAlarm: false,
          completed: done, completedAt: at || null, completedDate: at ? dayOf(at) : '', autoDone: over && !at });
      }
    }
    return out;
  }
  const range = (from, to, view) => rows(view, (st) => st.occurrences(from, to, { includeTodos: false }));
  const next = (from, opts, view) => rows(view, (st) => st.nextOccurrences(from, opts || {}));
  // one item, for the editor (read-only) or to copy into your own reminders
  function get(uid) {
    const { id, uid: inner } = splitUid(uid);
    const s = find(id);
    const store = stores.get(id);
    const d = s && store ? store.get(inner) : null;
    if (!d) return null;
    return { ...d, uid, sub: id, subName: s.name, subColor: s.color, readOnly: true, alarm: null };
  }
  // what to save as your own copy of it
  function copyOf(uid) {
    const d = get(uid);
    if (!d) throw new Error('That item no longer exists.');
    const out = { ...d };
    for (const k of ['uid', 'sub', 'subName', 'subColor', 'readOnly', 'completed', 'completedAt']) delete out[k];
    return out;
  }
  // tick or untick one item (one date of a repeating one); the calendar itself is not changed
  function markDone(uid, done, occ) {
    const { id, uid: inner } = splitUid(uid);
    const store = stores.get(id);
    const d = find(id) && store ? store.get(inner) : null;
    if (!d) throw new Error('That item no longer exists.');
    const day = occ != null && Number.isFinite(Number(occ)) ? dayOf(occ) : String(d.date || '');
    const ticks = { ...doneOf(id) };
    const k = `${inner}|${day}`;
    // unticking with autoDone on keeps it open even once it is over: 0
    if (done) ticks[k] = now(); else if (find(id).autoDone) ticks[k] = 0; else delete ticks[k];
    saveDone(id, ticks);
    if (onChange) onChange();
    return !!done;
  }
  function stop() { if (timer != null) clearTimer(timer); timer = null; }

  return { load, add, update, remove: removeSub, refresh, range, next, get, copyOf, list, stop, markDone, REFRESH };
}


// The channels both hosts answer (window.rf → host), and the guard for the channels that change an item.
const READ_ONLY = 'This comes from a calendar you subscribe to, so it can\'t be changed here.';
function guardReadOnly(uid) { if (isSubUid(uid)) throw new Error(READ_ONLY); }
function subscriptionChannels(subs, getStore, changed) {
  return {
    'subs:list': () => subs.list(),
    'subs:add': (o) => subs.add(o || {}),
    'subs:update': (id, p) => subs.update(id, p || {}),
    'subs:remove': (id) => subs.remove(id),
    'subs:refresh': (id) => subs.refresh(id || null, !id),
    'subs:range': (from, to, view) => subs.range(from, to, view),
    'subs:next': (from, opts, view) => subs.next(from, opts, view),
    // your own copy of an item from a subscription, in your reminders
    'subs:copy': (uid) => { const u = getStore().upsert(subs.copyOf(uid)); changed(); return u; },
  };
}

module.exports = { createSubscriptions, normalizeUrl, calendarName, isSubUid, splitUid, COLORS, guardReadOnly, subscriptionChannels, READ_ONLY };
