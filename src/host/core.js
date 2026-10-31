'use strict';
// ReminderFoxAgain host core: the platform-neutral half of src/main.js (data file, backups, state, settings, alarm
// engine, quick alarms, suspend, the pop-up data, import/export and every window.rf call), with no Electron or Node
// imports. A platform gives it an adapter (below) and gets back `call(channel, args)`, which answers the same
// channels the desktop preload uses (data:range, data:save, alarm:snooze…), with the same results.
//
// Used by the Thunderbird add-on (thunderbird/background.js). The desktop app still runs on src/main.js.
//
// adapter = {
//   platform,                 // meta().platform, e.g. 'thunderbird'
//   os,                       // 'windows' | 'macos' | 'linux' (the wording the pages use)
//   version,                  // the app version
//   dataLabel,                // what meta().dataFile shows (there is no file path in an add-on)
//   files: {                  // names like 'reminders.ics', 'state.json', 'backups/reminders-2026-10-31.ics'
//     read(name) → Promise<string|null>, write(name, text) → Promise, remove(name) → Promise,
//     list() → Promise<[{name, size, mtime}]>,
//   },
//   emit(channel, payload, target),   // to the pages; target 'main' | 'alarm' | 'slider' | undefined (all)
//   windows: { showMain() → Promise, alarm: { show(), raise(), close(), hide() }, slider: { show(corner), close() } },
//   notify(title, body),      // a desktop notification for new alarms
//   badge(n), tooltip(text), menu(items),   // the toolbar button: count, tooltip and its menu
//   openUrl(url), systemLocale() → 'en-CA', loadDict(lang) → Promise<object>, languageChanged(info),
//   now() → ms (optional, for tests), setTimeout / clearTimeout / setInterval / clearInterval (optional)
// }
const { Store, dayKey, timeKey, setPhrases } = require('../core/store');
const I18N = require('../ui/i18n.js');

const APP_NAME = 'ReminderFoxAgain';
const HOUR = 3600000;
const DAY = 24 * HOUR;
const DATA_FILE = 'reminders.ics';
const STATE_FILE = 'state.json';
const ARCHIVE_FILE = 'archive.ics';
const BACKUP_DIR = 'backups/';
const SOUND_FILE = 'sounds/alarm-sound';
const ARCHIVE_LIST = 'Terminated or Suspended';
const SOUND_TYPES = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', webm: 'audio/webm' };

const DEFAULT_SETTINGS = {
  startWithWindows: true, closeToTray: true, weekStart: 0, defaultAlarm: null,
  snoozeAmount: 10, snoozeUnit: 'minutes', alarmSound: true, theme: '',
  soundFile: null, soundName: '', resoundMinutes: 0, alarmTone: 'chime',
  sliderEnabled: false, sliderShow: 'both', sliderEvery: 60, sliderKeep: 15, sliderCorner: 'br', sliderSound: false,
  upcomingDays: 15, badge: 'today',
  textSize: 100, dateFormat: '', timeFormat: '', sidePanel: true, miniMonths: 1, mapService: 'google',
  remColumnsHidden: [], todoColumnsHidden: [],
  todayLabel: '[time]  [reminderDesc]', upcomingLabel: '[shortMonth] [date]  [reminderDesc]', tooltipUpcoming: true,
  language: '', listTabs: true, lists: [], categories: [], views: [], repeatAhead: 'm12', pastRepeatDays: 'all', hideRepeating: false, hideCompleted: false, todoSort: 'date',
  customThemes: [],
};

function createHost(ad) {
  const now = () => (ad.now ? ad.now() : Date.now());
  // (called as plain functions: a browser's setTimeout refuses to run as a method of another object)
  const T = {
    set: (fn, ms) => (ad.setTimeout ? ad.setTimeout(fn, ms) : setTimeout(fn, ms)),
    clear: (id) => (ad.clearTimeout ? ad.clearTimeout(id) : clearTimeout(id)),
    every: (fn, ms) => (ad.setInterval ? ad.setInterval(fn, ms) : setInterval(fn, ms)),
    stop: (id) => (ad.clearInterval ? ad.clearInterval(id) : clearInterval(id)),
  };
  const today = () => dayKey(new Date(now()));
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = () => { const d = new Date(now()); return `${today()}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; };

  let store = new Store('');
  let archive = new Store('');
  let state = { settings: { ...DEFAULT_SETTINGS }, dismissed: {}, snoozed: {}, quickAlarms: [], suspend: null };
  let loadError = null;
  let archiveBroken = false;
  let archiveMoved = 0;
  let currentAlarms = [];
  let shownKeys = new Set();
  let alarmOpen = false;
  const timers = { snooze: null, quick: null, resume: null, slider: null, check: null, state: null };

  // ------------------------------------------------------------ files: an in-memory copy, written in order
  // disk[name] = the text last written (null = no such file); index = the backups and other files we know of
  const disk = {};
  const index = new Map(); // name → {size, mtime}
  let queue = Promise.resolve();
  const exists = (name) => (name in disk ? disk[name] != null : index.has(name));
  function put(name, text) {
    disk[name] = text;
    index.set(name, { size: text.length, mtime: now() });
    queue = queue.then(() => ad.files.write(name, text)).catch((e) => console.error('write', name, e && e.message));
    return queue;
  }
  function drop(name) {
    delete disk[name];
    index.delete(name);
    queue = queue.then(() => ad.files.remove(name)).catch(() => {});
  }
  async function read(name) {
    if (name in disk) return disk[name];
    await queue;
    return ad.files.read(name);
  }
  const flush = () => queue;

  // ------------------------------------------------------------ language
  let uiLang = 'en';
  let uiDict = {};
  let L = I18N.create('en', {});
  const tr = (s, vars) => L.t(s, vars);
  function systemLocale() {
    let s = 'en';
    try { s = ad.systemLocale() || 'en'; } catch (e) { /* default */ }
    s = String(s).replace(/[.@].*$/, '').replace(/_/g, '-');
    try { return Intl.getCanonicalLocales(s)[0] || 'en'; } catch (e) { return 'en'; }
  }
  function dateLocale() {
    const sys = systemLocale();
    return sys.split('-')[0].toLowerCase() === uiLang.split('-')[0].toLowerCase() ? sys : uiLang;
  }
  async function loadLanguage() {
    uiLang = I18N.resolve(state.settings.language || '', systemLocale());
    uiDict = {};
    if (uiLang !== 'en') { try { uiDict = (await ad.loadDict(uiLang)) || {}; } catch (e) { console.error('language', uiLang, e && e.message); } }
    L = I18N.create(uiLang, uiDict);
    const loc = dateLocale();
    const WDI = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    setPhrases(uiLang === 'en' ? null : {
      t: L.t, ordinal: L.ordinal,
      weekday: (code) => new Date(2024, 0, 7 + WDI[code]).toLocaleDateString(loc, { weekday: 'short' }),
      month: (m) => new Date(2024, (m || 1) - 1, 1).toLocaleDateString(loc, { month: 'short' }),
      monthDay: (m, d) => new Date(2024, (m || 1) - 1, d).toLocaleDateString(loc, { month: 'short', day: 'numeric' }),
      date: (key) => { const [y, mo, d] = String(key).split('-').map(Number); return new Date(y, mo - 1, d).toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' }); },
    });
    if (ad.languageChanged) ad.languageChanged(i18nInfo());
  }
  function i18nInfo() {
    return { lang: uiLang, dateLocale: dateLocale(), collect: false, systemLang: I18N.resolve('', systemLocale()), platform: ad.os || 'windows', host: ad.platform };
  }

  // ------------------------------------------------------------ state + data
  function upgradeState(s) {
    state = { ...state, ...(s || {}) };
    const set = { ...(state.settings || {}) };
    if (set.snoozeMinutes != null && set.snoozeAmount == null) {
      const m = Number(set.snoozeMinutes);
      if (m > 0 && m % 60 === 0) { set.snoozeAmount = m / 60; set.snoozeUnit = 'hours'; } else if (m > 0) { set.snoozeAmount = Math.round(m); set.snoozeUnit = 'minutes'; }
    }
    delete set.snoozeMinutes;
    if (!set.themeVersion) { if (set.theme === 'light') set.theme = 'fox'; set.themeVersion = 2; }
    delete set.monthShowDone;
    if (!set.alarmTone) set.alarmTone = set.soundFile ? 'file' : 'chime';
    state.settings = { ...DEFAULT_SETTINGS, ...set };
    state.dismissed = state.dismissed || {};
    state.snoozed = state.snoozed || {};
    state.quickAlarms = Array.isArray(state.quickAlarms) ? state.quickAlarms : [];
    state.suspend = state.suspend && typeof state.suspend === 'object' ? state.suspend : null;
    for (const k of ['lists', 'categories', 'views', 'remColumnsHidden', 'todoColumnsHidden', 'customThemes']) if (!Array.isArray(state.settings[k])) state.settings[k] = [];
  }
  function saveState(immediately) {
    T.clear(timers.state);
    const write = () => put(STATE_FILE, JSON.stringify(state, null, 2));
    if (immediately) write(); else timers.state = T.set(write, 300);
  }
  function loadStore(name, text, label) {
    if (text == null) return { store: new Store(''), broken: false };
    try { return { store: new Store(text), broken: false }; } catch (e) {
      let keep = `${name}.unreadable`;
      for (let n = 2; exists(keep) && disk[keep] !== text; n++) keep = `${name}.unreadable-${n}`;
      if (!exists(keep)) put(keep, text);
      loadError = (loadError ? `${loadError} ` : '') + `Your ${label} file could not be read (${e.message}). It was kept as ${keep}.`;
      return { store: new Store(''), broken: true };
    }
  }
  function backupIfNeeded(file = DATA_FILE, prefix = 'reminders') {
    if (!exists(file) || disk[file] == null) return;
    const name = `${BACKUP_DIR}${prefix}-${today()}.ics`;
    if (!exists(name)) put(name, disk[file]);
    const re = new RegExp(`^${BACKUP_DIR}${prefix}-\\d{4}-\\d{2}-\\d{2}\\.ics$`);
    const daily = [...index.keys()].filter((f) => re.test(f)).sort();
    for (const f of daily.slice(0, Math.max(0, daily.length - 30))) drop(f);
  }
  function saveData() { backupIfNeeded(); put(DATA_FILE, store.toString()); }
  function saveArchive() {
    if (archiveBroken) throw new Error('The archive file could not be read, so it is not changed. It was kept as archive.ics.unreadable.');
    backupIfNeeded(ARCHIVE_FILE, 'archive');
    put(ARCHIVE_FILE, archive.toString());
  }
  function archiveToList() {
    if (archiveBroken || !archive.count()) return 0;
    put(`${BACKUP_DIR}archive-before-list-${stamp()}.ics`, archive.toString());
    let n = 0;
    for (const uid of archive.list().map((d) => d.uid)) {
      const d = archive.extract(uid);
      if (!d || store.get(uid)) continue;
      store.insert(d, { archived: false });
      store.moveToList(uid, ARCHIVE_LIST);
      n++;
    }
    if (n) addLists([ARCHIVE_LIST]);
    saveData();
    put(ARCHIVE_FILE, archive.toString());
    saveState(true);
    return n;
  }
  function changed() {
    saveData();
    broadcast('data:changed');
    updateTray();
    checkAlarms();
  }
  const broadcast = (ch, payload) => ad.emit(ch, payload);
  const send = (target, ch, payload) => ad.emit(ch, payload, target);
  function orderedLists() {
    const fromData = store.todoLists().slice(1);
    const mine = state.settings.lists.filter((l) => l && l !== "To-Do's");
    return ["To-Do's", ...mine, ...fromData.filter((l) => !mine.includes(l)).sort((a, b) => a.localeCompare(b))];
  }
  function allCategories() { return [...new Set([...store.categories(), ...state.settings.categories])].sort((a, b) => a.localeCompare(b)); }
  function meta() {
    return {
      categories: allCategories(), todoLists: orderedLists(), settings: state.settings, suspend: suspendedUntil(),
      listCounts: store.listCounts(), categoryCounts: store.categoryCounts(),
      dataFile: ad.dataLabel || DATA_FILE, count: store.count(), archiveCount: archive.count(), archiveFile: ad.dataLabel || ARCHIVE_FILE,
      loadError, version: ad.version, archiveMoved, platform: ad.platform, trayMissing: false,
    };
  }

  // ------------------------------------------------------------ the toolbar button: tooltip, menu
  const fmtTime = (ms) => {
    const tf = state.settings.timeFormat;
    return new Date(ms).toLocaleTimeString(dateLocale(), { hour: 'numeric', minute: '2-digit', ...(tf === '24' ? { hourCycle: 'h23' } : tf === '12' ? { hour12: true } : {}) });
  };
  function label(template, r, at = now()) {
    const d = new Date(r.start);
    const t0 = new Date(at); t0.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - t0) / DAY);
    const mins = Math.max(0, Math.round((r.start - at) / 60000));
    const until = r.allDay ? (days === 0 ? tr('today') : tr(days === 1 ? '{n} day' : '{n} days', { n: days }))
      : mins < 60 ? tr('{n} min', { n: mins }) : mins < 1440 ? tr('{n} h {n2} min', { n: Math.floor(mins / 60), n2: mins % 60 }) : tr(Math.floor(mins / 1440) === 1 ? '{n} day' : '{n} days', { n: Math.floor(mins / 1440) });
    const loc = dateLocale();
    const v = {
      reminderDesc: r.summary, time: r.allDay ? '' : fmtTime(r.start), timeUntil: until, daysUntil: String(days),
      longDay: d.toLocaleDateString(loc, { weekday: 'long' }), shortDay: d.toLocaleDateString(loc, { weekday: 'short' }),
      longMonth: d.toLocaleDateString(loc, { month: 'long' }), shortMonth: d.toLocaleDateString(loc, { month: 'short' }),
      numMonth: String(d.getMonth() + 1), date: String(d.getDate()), longYear: String(d.getFullYear()), shortYear: String(d.getFullYear()).slice(2),
    };
    return String(template || '[reminderDesc]').replace(/\[(\w+)\]/g, (m, k) => (k in v ? v[k] : m)).replace(/\(\s*\)/g, '').replace(/\s{3,}/g, '  ').trim();
  }
  function todayAndUpcoming(at = now()) {
    const t0 = new Date(at); t0.setHours(0, 0, 0, 0);
    const t1 = new Date(t0); t1.setDate(t1.getDate() + 1);
    const tN = new Date(t0); tN.setDate(tN.getDate() + 1 + Math.max(0, Number(state.settings.upcomingDays) || 0));
    let todayRows = []; let upcoming = [];
    try {
      const rows = store.occurrences(t0, tN, { includeTodos: true, now: at }).filter((r) => !r.completed && (r.kind === 'event' || r.date));
      todayRows = rows.filter((r) => r.date === dayKey(t0));
      upcoming = rows.filter((r) => r.date > dayKey(t0) && r.start >= t1.getTime());
    } catch (e) { /* ignore */ }
    return { today: todayRows, upcoming };
  }
  function trayTooltip() {
    const at = now();
    const { today: rows, upcoming } = todayAndUpcoming(at);
    let todos = [];
    try { todos = store.tooltipTodos(); } catch (e) { /* ignore */ }
    const reminders = rows.filter((r) => r.kind === 'event');
    const lines = reminders.slice(0, 8).map((r) => label(state.settings.todayLabel, r, at));
    if (state.settings.tooltipUpcoming) for (const r of upcoming.filter((x) => x.kind === 'event').slice(0, Math.max(0, 6 - lines.length))) lines.push(label(state.settings.upcomingLabel, r, at));
    for (const d of todos.slice(0, Math.max(0, 8 - lines.length))) lines.push(`${tr('To-do')}  ${d.display}`);
    const sus = suspendedUntil();
    const head = sus ? (sus.until ? tr('{app} — alarms off until {time}', { app: APP_NAME, time: fmtTime(sus.until) }) : tr('{app} — alarms off', { app: APP_NAME })) : APP_NAME;
    if (!lines.length) return sus ? head : tr('{app} — nothing today', { app: APP_NAME });
    return `${head} — ${reminders.length ? tr('today') : tr('coming up')}:\n${lines.join('\n')}`;
  }
  // the tray menu's items, without Quit (Thunderbird itself is quit instead)
  function trayMenu() {
    const sus = suspendedUntil();
    return [
      { id: 'open', title: tr('Open {app}', { app: APP_NAME }) },
      { id: 'new-event', title: tr('Add reminder…') },
      { id: 'new-todo', title: tr('Add list item…') },
      { id: 'quick', title: tr('Quick alarm…') },
      { type: 'separator' },
      sus ? { id: 'resume', title: tr('Resume alarms') } : { id: 'suspend', title: tr('Suspend alarms…') },
      { id: 'slider', title: tr("Show today's reminders") },
    ];
  }
  async function menuClick(id) {
    const ui = async (ch, payload) => { await ad.windows.showMain(); send('main', ch, payload); };
    if (id === 'open') await ad.windows.showMain();
    else if (id === 'new-event') await ui('ui:new', { kind: 'event' });
    else if (id === 'new-todo') await ui('ui:new', { kind: 'todo' });
    else if (id === 'quick') await ui('ui:quick');
    else if (id === 'suspend') await ui('ui:suspend');
    else if (id === 'resume') setSuspend(0);
    else if (id === 'slider') showSlider(true);
  }
  let lastTip = '';
  function updateTray() {
    const tip = trayTooltip();
    if (tip !== lastTip) { lastTip = tip; try { ad.tooltip(tip); } catch (e) { /* ignore */ } }
  }
  function refreshTrayMenu() { try { ad.menu(trayMenu()); } catch (e) { /* ignore */ } updateTray(); }

  // ------------------------------------------------------------ alarms
  function checkAlarms() {
    const at = now();
    try { if (store.syncUntilDone(at)) { saveData(); broadcast('data:changed'); } } catch (e) { console.error('until-done', e.message); }
    let fired = [];
    try { fired = store.alarms(at - 48 * HOUR, at + 1); } catch (e) { console.error('alarms', e.message); }
    for (const q of state.quickAlarms) if (q.at <= at) fired.push(quickRow(q));
    for (const [k, t] of Object.entries(state.dismissed)) if (at - t > 7 * DAY) delete state.dismissed[k];
    for (const k of Object.keys(state.snoozed)) if (!itemExists(k)) delete state.snoozed[k];
    const due = [];
    const seen = new Set();
    for (const a of fired) {
      if (state.dismissed[a.key]) continue;
      const sn = state.snoozed[a.key];
      if (sn && sn.until > at) continue;
      seen.add(a.key);
      due.push(a);
    }
    for (const [k, sn] of Object.entries(state.snoozed)) {
      if (sn.until > at || seen.has(k) || state.dismissed[k]) continue;
      const a = sn.alarm;
      if (!a || !itemExists(k)) continue;
      if (fired.some((f) => f.key === k)) continue;
      seen.add(k);
      due.push(a);
    }
    due.sort((x, y) => x.at - y.at);
    currentAlarms = due;
    const sus = suspendedUntil(at);
    const fresh = due.filter((a) => !shownKeys.has(a.key));
    if (sus) {
      if (alarmOpen) { ad.windows.alarm.close(); alarmOpen = false; }
      shownKeys = new Set();
      armResume(at);
    } else if (!due.length) {
      if (alarmOpen) { ad.windows.alarm.close(); alarmOpen = false; }
      shownKeys = new Set();
    } else if (fresh.length) {
      if (!alarmOpen) { ad.windows.alarm.show(); alarmOpen = true; } else { ad.windows.alarm.raise(); send('alarm', 'alarms:ring'); }
      notifyFresh(fresh);
      for (const a of fresh) shownKeys.add(a.key);
    }
    for (const k of [...shownKeys]) if (!seen.has(k)) shownKeys.delete(k);
    send('alarm', 'alarms:update', { alarms: due, settings: state.settings });
    armSnoozeTimer(at);
    armQuickTimer(at);
    updateTray();
    saveState();
  }
  function notifyFresh(fresh) {
    if (!fresh.length || !ad.notify) return;
    const first = fresh[0];
    try { ad.notify(fresh.length > 1 ? tr('{n} reminders', { n: fresh.length }) : first.summary || APP_NAME, fresh.length > 1 ? fresh.map((a) => a.summary).join(', ') : APP_NAME); } catch (e) { /* optional */ }
  }
  // the alarm window was closed by the user (its own close button): what is due shows again with the next new alarm
  function alarmClosed() { alarmOpen = false; shownKeys = new Set(); }
  function itemExists(key) {
    const [uid, id] = String(key).split('|');
    if (uid === 'quick') return state.quickAlarms.some((q) => q.id === id);
    return !!store.get(uid);
  }
  function quickRow(q) {
    return { key: `quick|${q.id}|${q.at}`, uid: `quick|${q.id}`, quick: true, kind: 'event', summary: q.text || 'Quick alarm', notes: q.notes || '',
      location: '', start: q.at, end: q.at, at: q.at, date: dayKey(q.at), time: timeKey(q.at), allDay: false, important: false, categories: [] };
  }
  function armQuickTimer(at) {
    T.clear(timers.quick);
    const ahead = state.quickAlarms.map((q) => q.at).filter((t) => t > at);
    if (ahead.length) timers.quick = T.set(checkAlarms, Math.min(Math.min(...ahead) - at + 50, 6 * HOUR));
  }
  function removeQuick(key) {
    const [kind, id] = String(key).split('|');
    if (kind !== 'quick') return false;
    state.quickAlarms = state.quickAlarms.filter((q) => q.id !== id);
    for (const k of Object.keys(state.snoozed)) if (k.startsWith(`quick|${id}|`)) delete state.snoozed[k];
    return true;
  }
  function suspendedUntil(at = now()) {
    const s = state.suspend;
    if (!s) return null;
    if (s.until && s.until <= at) { state.suspend = null; saveState(); return null; }
    return { since: s.since, until: s.until || null };
  }
  function armResume(at) {
    T.clear(timers.resume);
    const s = state.suspend;
    if (s && s.until) timers.resume = T.set(() => { checkAlarms(); refreshTrayMenu(); broadcast('settings:changed', state.settings); }, Math.min(s.until - at + 50, 6 * HOUR));
  }
  function setSuspend(until) {
    if (until === 0) state.suspend = null; else state.suspend = { since: now(), until: until || null };
    saveState(true);
    checkAlarms();
    refreshTrayMenu();
    broadcast('settings:changed', state.settings);
    return suspendedUntil();
  }
  function armSnoozeTimer(at) {
    T.clear(timers.snooze);
    const ahead = Object.values(state.snoozed).map((s) => s.until).filter((u) => u > at);
    if (ahead.length) timers.snooze = T.set(checkAlarms, Math.min(Math.min(...ahead) - at + 50, 6 * HOUR));
  }
  function findAlarm(key) { return currentAlarms.find((a) => a.key === key) || (state.snoozed[key] && state.snoozed[key].alarm) || null; }
  function snooze(key, seconds) {
    if (typeof seconds !== 'number' || !Number.isInteger(seconds) || seconds < 1 || seconds > 999 * 3600) return false;
    if (typeof key !== 'string' || !key) return false;
    const alarm = findAlarm(key) || { key, uid: key.split('|')[0], start: Number(key.split('|')[1]), at: Number(key.split('|')[2]), summary: '' };
    state.snoozed[key] = { until: now() + seconds * 1000, alarm };
    delete state.dismissed[key];
    shownKeys.delete(key);
    saveState(true);
    checkAlarms();
    return true;
  }
  function dismiss(key) {
    if (removeQuick(key)) { saveState(true); checkAlarms(); return true; }
    state.dismissed[key] = now();
    delete state.snoozed[key];
    saveState(true);
    checkAlarms();
    return true;
  }

  // ------------------------------------------------------------ the pop-up (today's and upcoming reminders)
  function sliderData(at = now()) {
    const { today: t, upcoming } = todayAndUpcoming(at);
    const show = state.settings.sliderShow;
    return { today: show === 'upcoming' ? [] : t.slice(0, 30), upcoming: show === 'today' ? [] : upcoming.slice(0, 30), settings: state.settings };
  }
  function showSlider(force) {
    if (!force && (!state.settings.sliderEnabled || suspendedUntil())) return;
    const data = sliderData();
    if (!force && !data.today.length && !data.upcoming.length) return;
    ad.windows.slider.show(state.settings.sliderCorner || 'br');
    send('slider', 'slider:update', data);
  }
  function armSlider() {
    T.stop(timers.slider);
    const every = Number(state.settings.sliderEvery) || 0;
    if (state.settings.sliderEnabled && every > 0) timers.slider = T.every(() => showSlider(false), every * 60000);
  }

  // ------------------------------------------------------------ backups
  function combinedText() {
    const combo = new Store(store.toString());
    if (archive.count()) combo.import(archive.toString());
    return combo.toString();
  }
  function backupNow() {
    const file = `${BACKUP_DIR}manual-${stamp()}.ics`;
    put(file, combinedText());
    return file;
  }
  const baseName = (f) => String(f).replace(/^.*\//, '');
  async function textOf(file) {
    if (uploads.has(file)) return uploads.get(file).text;
    const text = await read(file);
    if (text == null) throw new Error(`${baseName(file)} was not found.`);
    return text;
  }
  async function describeBackup(file) {
    const name = uploads.has(file) ? uploads.get(file).name : baseName(file);
    const text = await textOf(file);
    const st = index.get(file) || { size: text.length, mtime: (uploads.get(file) || {}).mtime || now() };
    let items = 0; let archived = 0; let error = null;
    try { const s = new Store(text); for (const d of s.list()) { if (d.archivedAt) archived++; else items++; } } catch (e) { error = e.message; }
    const kind = /^manual-/.test(name) ? 'Backup made by you' : /^before-restore-/.test(name) ? 'Saved before a restore'
      : /^before-import-/.test(name) ? 'Saved before an import replaced everything' : /^archive-before-list-/.test(name) ? 'The archive, before it became a list' : /^archive-/.test(name) ? 'Daily backup of the archive (earlier version)'
        : /^reminders-/.test(name) ? 'Daily backup' : 'Backup';
    return { name, path: file, modified: st.mtime, size: st.size, items, archived, kind, error };
  }
  async function listBackups() {
    const names = [...index.keys()].filter((f) => f.startsWith(BACKUP_DIR) && /\.ics$/i.test(f));
    const out = [];
    for (const n of names) out.push(await describeBackup(n));
    return out.sort((a, b) => b.modified - a.modified);
  }
  async function restoreBackup(file) {
    const text = await textOf(file);
    const incoming = new Store(text);
    const name = uploads.has(file) ? uploads.get(file).name : baseName(file);
    const all = incoming.list();
    const live = all.filter((d) => !d.archivedAt).map((d) => d.uid);
    const arch = all.filter((d) => d.archivedAt).map((d) => d.uid);
    const isArchiveFile = /^archive-/.test(name);
    const replaceMain = !isArchiveFile;
    const replaceArchive = isArchiveFile || arch.length > 0 || /^(manual|before-restore)-/.test(name);
    if (replaceArchive && archiveBroken) throw new Error('The archive file could not be read, so it cannot be replaced.');
    const safety = `${BACKUP_DIR}before-restore-${stamp()}.ics`;
    put(safety, combinedText());
    if (replaceMain) {
      const next = new Store('');
      for (const uid of live) next.insert(incoming.extract(uid), null);
      store = next;
      loadError = null;
      put(DATA_FILE, store.toString());
    }
    if (replaceArchive) {
      const next = new Store('');
      for (const uid of (isArchiveFile ? [...arch, ...live] : arch)) next.insert(incoming.extract(uid), null);
      archive = next;
      put(ARCHIVE_FILE, archive.toString());
    }
    const moved = archiveToList();
    if (moved) broadcast('settings:changed', state.settings);
    broadcast('data:changed');
    updateTray();
    checkAlarms();
    return { items: store.count(), moved, list: ARCHIVE_LIST, safety: baseName(safety) };
  }

  // ------------------------------------------------------------ import: files the page picked, kept here by token
  // A page has no file paths: it reads the files the person picked and hands their text over ('upload'); the token
  // it gets back stands in for a path in ics:preview, ics:importPaths, backup:describe and backup:restore.
  const uploads = new Map(); // token → {name, text, mtime}
  let uploadN = 0;
  function upload(files) {
    if (uploads.size > 50) uploads.clear();
    return [].concat(files || []).map((f) => {
      const token = `upload:${++uploadN}/${baseName(f.name || 'file.ics')}`;
      uploads.set(token, { name: baseName(f.name || 'file.ics'), text: String(f.text || ''), mtime: Number(f.mtime) || now() });
      return token;
    });
  }
  // The add-on kept the names of its custom to-do lists in the profile's prefs.js; a prefs.js picked together with
  // the reminderfox.ics brings them in (on the desktop the file next to the profile folder is read instead).
  const isPrefs = (name) => /(^|\/)prefs\.js$/i.test(name);
  function addonListsFrom(text) {
    const m = /user_pref\(\s*"extensions\.reminderFox\.todoLists"\s*,\s*("(?:[^"\\]|\\.)*")\s*\)/i.exec(String(text || ''));
    if (!m) return [];
    let v = '';
    try { v = JSON.parse(m[1]); } catch (e) { return []; }
    return v.split(',').map((s) => s.trim()).filter((s) => s && !/[:]/.test(s) && s !== "To-Do's");
  }
  function addLists(names) {
    const known = new Set(orderedLists().map((l) => l.toLowerCase()));
    const mine = state.settings.lists.slice();
    const added = [];
    for (const n of names) {
      if (known.has(n.toLowerCase())) { if (!mine.some((l) => l.toLowerCase() === n.toLowerCase())) mine.push(n); continue; }
      known.add(n.toLowerCase()); mine.push(n); added.push(n);
    }
    state.settings.lists = mine;
    return added;
  }
  function uploaded(tokens) {
    const all = [].concat(tokens || []).map((t) => { const u = uploads.get(t); if (!u) throw new Error('That file is no longer available. Please choose it again.'); return u; });
    return { ics: all.filter((u) => !isPrefs(u.name)), prefs: all.filter((u) => isPrefs(u.name)) };
  }
  function importFiles(tokens, opts = {}) {
    const { ics, prefs } = uploaded(tokens);
    const total = { added: 0, updated: 0, skipped: 0, duplicates: 0, lists: [], replaced: null };
    for (const f of ics) new Store(f.text); // every file must be a calendar before anything changes
    if (opts.mode === 'replace') {
      const safety = `${BACKUP_DIR}before-import-${stamp()}.ics`;
      put(safety, combinedText());
      total.replaced = { count: store.count(), safety: baseName(safety) };
      store = new Store('');
      loadError = null;
    }
    for (const f of ics) {
      const r = store.import(f.text, { duplicates: opts.mode === 'replace' ? 'import' : opts.duplicates, category: opts.category });
      total.added += r.added; total.updated += r.updated; total.skipped += r.skipped; total.duplicates += r.duplicates || 0;
    }
    for (const p of prefs) total.lists.push(...addLists(addonListsFrom(p.text)));
    if (total.lists.length) { saveState(true); broadcast('settings:changed', state.settings); }
    if (opts.category && !state.settings.categories.includes(String(opts.category).trim())) { state.settings.categories.push(String(opts.category).trim()); saveState(true); }
    if (total.added || total.updated || total.lists.length || total.replaced) changed(); else broadcast('data:changed');
    return total;
  }
  function previewFiles(tokens) {
    const { ics } = uploaded(tokens);
    const out = { files: ics.map((f) => f.name), events: 0, todos: 0, existing: 0, duplicates: 0, current: store.count() };
    for (const f of ics) {
      const p = store.previewImport(f.text);
      out.events += p.events; out.todos += p.todos; out.existing += p.existing; out.duplicates += p.duplicates;
    }
    return out;
  }

  // ------------------------------------------------------------ settings
  function setSettings(patch) {
    if (patch && 'closeToTray' in patch) patch = { ...patch, closeToTrayChosen: true };
    state.settings = { ...state.settings, ...(patch || {}) };
    delete state.settings.snoozeMinutes;
    saveState(true);
    if (patch && Object.keys(patch).some((k) => k.startsWith('slider'))) armSlider();
    if (patch && Object.keys(patch).some((k) => /Label$|tooltipUpcoming|upcomingDays|timeFormat/.test(k))) updateTray();
    if (patch && 'soundFile' in patch && !patch.soundFile) soundCache = null;
    broadcast('settings:changed', state.settings);
    send('alarm', 'alarms:update', { alarms: currentAlarms, settings: state.settings });
    if (patch && 'language' in patch) {
      T.set(async () => { await loadLanguage(); refreshTrayMenu(); lastTip = ''; updateTray(); broadcast('host:reload'); }, 50);
    }
    return state.settings;
  }
  let soundCache = null;
  async function soundData() {
    const f = state.settings.soundFile;
    if (!f || state.settings.alarmTone !== 'file') return null;
    if (soundCache && soundCache.f === f) return soundCache.url;
    const url = await read(SOUND_FILE);
    if (url) soundCache = { f, url };
    return url || null;
  }
  // a sound the page read from a file the person picked: {name, dataUrl, size}
  function setSound(s) {
    const name = baseName((s && s.name) || '');
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (!SOUND_TYPES[ext]) throw new Error('Please choose a sound file (.mp3, .wav, .ogg, .m4a, .aac, .flac or .webm).');
    if (Number(s.size) > 10 * 1024 * 1024) throw new Error('That sound file is larger than 10 MB. Please choose a shorter one.');
    const url = String(s.dataUrl || '').replace(/^data:[^;,]*/, `data:${SOUND_TYPES[ext]}`);
    put(SOUND_FILE, url);
    soundCache = null;
    state.settings = { ...state.settings, soundFile: `alarm-sound.${ext}`, soundName: name, alarmTone: 'file' };
    saveState(true);
    broadcast('settings:changed', state.settings);
    return state.settings;
  }

  // ------------------------------------------------------------ the channels (as in src/preload.js)
  const exportName = (kind) => `${kind === 'event' ? 'reminders' : kind === 'todo' ? 'todos' : 'reminderfoxagain'}-${today()}.ics`;
  const H = {
    'data:range': (from, to, opts) => store.occurrences(from, to, opts || {}),
    'data:next': (from, opts) => store.nextOccurrences(from, opts || {}),
    'data:history': (before, opts) => {
      if (opts && opts.tickedOnly) return store.completedHistory(before);
      const days = state.settings.pastRepeatDays;
      const since = days === 'all' || days == null ? null : Number(before) - Math.max(1, Number(days) || 365) * DAY;
      return store.completedHistory(before, { since });
    },
    'data:all': () => store.list(),
    'data:get': (uid) => store.get(uid),
    'data:save': (dto) => { const uid = store.upsert(dto); changed(); return uid; },
    'data:delete': (uid, occ) => { const r = store.remove(uid, occ); changed(); return r; },
    'data:complete': (uid, done, occ) => { const r = store.setCompleted(uid, done, occ); changed(); return r; },
    'data:meta': () => meta(),
    'open:url': (u) => { if (typeof u === 'string' && /^(https?:\/\/|mailto:)/i.test(u)) { ad.openUrl(u); return true; } return false; },
    'settings:set': (patch) => setSettings(patch),
    'rf:findOld': () => [], // an add-on can't look into other programs' profile folders: the person picks the file
    'upload': (files) => upload(files),
    'ics:preview': (files) => previewFiles(files),
    'ics:importPaths': (files, opts) => importFiles(files, opts || {}),
    'ics:importPath': (p) => importFiles([p]),
    // the text to save, for the page to offer as a download
    'ics:exportText': (opts) => {
      const kind = opts && opts.kind;
      return { name: exportName(kind), text: store.export(kind === 'event' || kind === 'todo' ? { kinds: [kind] } : {}) };
    },
    'data:text': () => ({ name: `reminders-${today()}.ics`, text: store.toString() }),
    'alarm:snooze': (key, seconds) => snooze(key, seconds),
    'alarm:dismiss': (key) => dismiss(key),
    'alarm:dismissAll': () => {
      const at = now();
      for (const a of currentAlarms) { if (!removeQuick(a.key)) { state.dismissed[a.key] = at; delete state.snoozed[a.key]; } }
      saveState(true);
      checkAlarms();
      return true;
    },
    'alarm:complete': (key) => {
      const [uid, start] = String(key).split('|');
      if (uid === 'quick') return dismiss(key);
      if (store.get(uid)) { store.setCompleted(uid, true, Number(start)); state.dismissed[key] = now(); delete state.snoozed[key]; changed(); } else dismiss(key);
      return true;
    },
    'alarm:open': async (key) => {
      const [uid, start] = String(key).split('|');
      await ad.windows.showMain();
      if (uid === 'quick') send('main', 'ui:quick'); else send('main', 'ui:edit', { uid, start: Number(start) });
      return true;
    },
    'alarm:hide': () => { ad.windows.alarm.hide(); return true; },
    'alarm:closed': () => { alarmClosed(); return true; },
    'alarm:state': () => ({ alarms: suspendedUntil() ? [] : currentAlarms, settings: state.settings }),
    'quick:list': () => state.quickAlarms.slice().sort((a, b) => a.at - b.at),
    'quick:add': (q) => {
      const at = Number(q && q.at);
      if (!Number.isFinite(at) || at <= now() - 60000) throw new Error('Please choose a time in the future.');
      const item = { id: newId(), text: String((q && q.text) || '').trim() || 'Quick alarm', notes: String((q && q.notes) || ''), at };
      state.quickAlarms.push(item);
      saveState(true);
      checkAlarms();
      return item;
    },
    'quick:remove': (id) => { removeQuick(`quick|${id}`); saveState(true); checkAlarms(); return true; },
    'suspend:set': (until) => setSuspend(until),
    'suspend:get': () => suspendedUntil(),
    'sound:set': (s) => setSound(s),
    'sound:data': () => soundData(),
    'slider:state': () => sliderData(),
    'slider:show': () => { showSlider(true); return true; },
    'slider:close': () => { ad.windows.slider.close(); return true; },
    'slider:open': async (uid, start) => { await ad.windows.showMain(); send('main', 'ui:edit', { uid, start }); ad.windows.slider.close(); return true; },
    'badge:set': (trayUrl, overlayUrl, text, count) => { try { ad.badge(Number(count) || 0, text || ''); } catch (e) { /* optional */ } return true; },
    'data:moveToList': (uid, list) => { const r = store.moveToList(uid, list); changed(); return r; },
    'data:duplicate': (uid, opts) => {
      const o = opts || {};
      if (o.list != null && /[,:]/.test(String(o.list))) throw new Error('A list name can\'t contain a comma or a colon.');
      const r = store.duplicate(uid, o);
      if (o.list != null) addLists([String(o.list).trim()].filter((l) => l && l !== "To-Do's"));
      changed();
      return r;
    },
    'data:order': (uids) => { store.setOrder(uids || []); changed(); return true; },
    'lists:rename': (from, to) => {
      to = String(to || '').trim();
      if (!to || /[,:]/.test(to)) throw new Error('A list name can\'t be empty or contain a comma or a colon.');
      const n = store.renameList(from, to) + archive.renameList(from, to);
      state.settings.lists = state.settings.lists.map((l) => (l === from ? to : l)).filter((l, i, a) => l !== "To-Do's" && a.indexOf(l) === i);
      saveState(true);
      try { saveArchive(); } catch (err) { /* archive unchanged */ }
      changed();
      broadcast('settings:changed', state.settings);
      return n;
    },
    'lists:remove': (name, opts) => {
      const n = (opts && opts.deleteItems ? store.removeListItems(name) : store.renameList(name, "To-Do's")) + archive.renameList(name, "To-Do's");
      state.settings.lists = state.settings.lists.filter((l) => l !== name);
      saveState(true);
      try { saveArchive(); } catch (err) { /* archive unchanged */ }
      changed();
      broadcast('settings:changed', state.settings);
      return n;
    },
    'categories:rename': (from, to) => {
      to = String(to || '').trim();
      const n = store.renameCategory(from, to) + archive.renameCategory(from, to);
      state.settings.categories = [...new Set(state.settings.categories.map((c) => (c === from ? to : c)).filter(Boolean))];
      saveState(true);
      try { saveArchive(); } catch (err) { /* archive unchanged */ }
      changed();
      broadcast('settings:changed', state.settings);
      return n;
    },
    'backup:now': () => backupNow(),
    'backup:text': async (file) => ({ name: `ReminderFoxAgain-backup-${today()}.ics`, text: await textOf(file) }),
    'backup:list': () => listBackups(),
    'backup:describe': (file) => describeBackup(file),
    'backup:restore': (file) => restoreBackup(file),
    'menu:click': (id) => menuClick(id),
    'host:i18n': () => i18nInfo(),
  };
  function newId() {
    const c = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Math.random().toString(16).slice(2)}0000000`;
    return c.replace(/-/g, '').slice(0, 8);
  }
  async function call(ch, args) {
    const fn = H[ch];
    if (!fn) throw new Error(`Unknown channel ${ch}`);
    return fn(...(args || []));
  }

  // ------------------------------------------------------------ start
  async function start() {
    for (const f of await ad.files.list()) index.set(f.name, { size: f.size, mtime: f.mtime });
    for (const name of [STATE_FILE, DATA_FILE, ARCHIVE_FILE]) disk[name] = await ad.files.read(name);
    let saved = null;
    try { saved = disk[STATE_FILE] ? JSON.parse(disk[STATE_FILE]) : null; } catch (e) { /* defaults */ }
    upgradeState(saved);
    await loadLanguage();
    store = loadStore(DATA_FILE, disk[DATA_FILE], 'reminders').store;
    const a = loadStore(ARCHIVE_FILE, disk[ARCHIVE_FILE], 'archive');
    archive = a.store; archiveBroken = a.broken;
    try { archiveMoved = archiveToList(); } catch (e) { console.error('archive to list', e.message); }
    refreshTrayMenu();
    checkAlarms();
    timers.check = T.every(checkAlarms, 15000);
    armSlider();
    T.set(() => showSlider(false), 8000);
  }

  return {
    start, call, i18nInfo, checkAlarms, alarmClosed, flush, menuClick,
    // for tests
    _state: () => state, _store: () => store,
  };
}

module.exports = { createHost, DEFAULT_SETTINGS };
