'use strict';
/* global RFHost, RF_VERSION, RFCap */
// ReminderFoxAgain for Android — the host. The shared host core (src/host/core.js, bundled into host.js) runs here,
// in the main page, with an Android adapter:
//   files        the app's private data folder (Capacitor Filesystem, Directory.Data, folder "rfa/"), plus an index
//   alarm, pop-up  sheets over the main page with alarm.html and slider.html in a frame
//   alarms       while the app isn't open, scheduled notifications (LocalNotifications), 14 days ahead, with
//                Snooze, Done and Open on them
//   links        the system browser (Capacitor Browser); calendars are fetched by the native HTTP client
// The pages talk to it through the add-on's bridge.js, by way of shim.js (window.RFHOST below).
(function () {
  const C = RFCap;
  const NATIVE = C.Capacitor.isNativePlatform();
  const DIR = C.Directory.Data;
  const ROOT = 'rfa';
  const UTF8 = C.Encoding.UTF8;

  // ---------------------------------------------------------------- files
  // An index of the files (name → size, mtime) is kept beside them, so list() needs no folder walk.
  const INDEX = `${ROOT}/files.json`;
  let fileIndex = null;
  const fpath = (name) => `${ROOT}/${name}`;
  async function readRaw(path) {
    try { return (await C.Filesystem.readFile({ path, directory: DIR, encoding: UTF8 })).data; } catch (e) { return null; }
  }
  async function writeRaw(path, text) {
    // a new copy first, then moved over the old one, so a file is never left half written
    await C.Filesystem.writeFile({ path: `${path}.tmp`, data: text, directory: DIR, encoding: UTF8, recursive: true });
    try { await C.Filesystem.deleteFile({ path, directory: DIR }); } catch (e) { /* not there yet */ }
    await C.Filesystem.rename({ from: `${path}.tmp`, to: path, directory: DIR, toDirectory: DIR });
  }
  async function idx() {
    if (!fileIndex) { try { fileIndex = JSON.parse((await readRaw(INDEX)) || '{}'); } catch (e) { fileIndex = {}; } }
    return fileIndex;
  }
  let indexQueue = Promise.resolve();
  const saveIndex = () => { indexQueue = indexQueue.then(() => writeRaw(INDEX, JSON.stringify(fileIndex))).catch(() => {}); return indexQueue; };
  const files = {
    read: (name) => readRaw(fpath(name)),
    async write(name, text) {
      await writeRaw(fpath(name), text);
      (await idx())[name] = { size: text.length, mtime: Date.now() };
      await saveIndex();
    },
    async remove(name) {
      try { await C.Filesystem.deleteFile({ path: fpath(name), directory: DIR }); } catch (e) { /* gone */ }
      delete (await idx())[name];
      await saveIndex();
    },
    async list() { return Object.entries(await idx()).map(([name, v]) => ({ name, size: v.size, mtime: v.mtime })); },
  };

  // ---------------------------------------------------------------- pages: the main page and the two sheets
  // listeners: [{win, fn}] from bridge.js in each page; a page gets messages once it said it is ready
  let listeners = [];
  const ready = { main: false, alarm: false, slider: false };
  const waiting = { alarm: [], slider: [] };
  const pageOf = (win) => (win === window ? 'main' : sheets.alarm && sheets.alarm.frame.contentWindow === win ? 'alarm' : sheets.slider && sheets.slider.frame.contentWindow === win ? 'slider' : 'main');
  function deliver(msg) {
    listeners = listeners.filter((l) => { try { return !l.win.closed && l.win.document; } catch (e) { return false; } });
    for (const l of listeners.slice()) { try { l.fn(msg); } catch (e) { /* a page that went away */ } }
  }
  function emit(ch, payload, target) {
    const msg = { rf: 'emit', ch, payload, target: target || null };
    if (target && target !== 'main' && !ready[target]) { if (sheets[target]) waiting[target].push(msg); return; }
    deliver(msg);
    if (ch === 'data:changed' || ch === 'settings:changed' || ch === 'alarms:update') scheduleSoon();
  }

  // ---------------------------------------------------------------- the alarm and pop-up sheets
  const sheets = { alarm: null, slider: null };
  function openSheet(page) {
    if (sheets[page]) { sheets[page].el.classList.add('open'); return; }
    const el = document.createElement('div');
    el.className = `rfa-sheet rfa-${page}`;
    el.setAttribute('role', 'dialog');
    const frame = document.createElement('iframe');
    frame.title = page === 'alarm' ? 'Alarms' : 'Today and upcoming';
    frame.src = page === 'alarm' ? 'alarm.html' : 'slider.html';
    el.innerHTML = '<div class="rfa-grab" aria-hidden="true"></div>';
    el.appendChild(frame);
    document.body.appendChild(el);
    ready[page] = false;
    sheets[page] = { el, frame };
    requestAnimationFrame(() => el.classList.add('open'));
    // drag the grab handle down to put the sheet away
    let y0 = null;
    el.querySelector('.rfa-grab').addEventListener('pointerdown', (e) => { y0 = e.clientY; });
    window.addEventListener('pointerup', (e) => { if (y0 != null && e.clientY - y0 > 60) hideSheet(page); y0 = null; });
  }
  // put away, as the desktop minimizes its alarm window: it comes back with the next alarm
  function hideSheet(page) { if (sheets[page]) sheets[page].el.classList.remove('open'); }
  function closeSheet(page, byUser) {
    const s = sheets[page];
    if (!s) return;
    sheets[page] = null; ready[page] = false; waiting[page] = [];
    s.el.classList.remove('open');
    setTimeout(() => s.el.remove(), 250);
    if (byUser && page === 'alarm' && host) host.alarmClosed();
  }
  const windows = {
    showMain: async () => true,
    alarm: { show: () => openSheet('alarm'), raise: () => openSheet('alarm'), close: () => closeSheet('alarm'), hide: () => hideSheet('alarm') },
    slider: { show: () => openSheet('slider'), close: () => closeSheet('slider') },
  };

  // ---------------------------------------------------------------- scheduled notifications
  // The app isn't running most of the time, so every alarm of the next 14 days is a scheduled notification, made
  // again whenever the data, the settings or the alarms change, and when the app is put away or comes back.
  const N = C.LocalNotifications;
  const LIMIT = 400; // Android's limit is 500 pending; leave room
  const idOf = (key) => { let h = 0; for (const c of String(key)) h = ((h * 31) + c.charCodeAt(0)) | 0; return (h & 0x7fffffff) || 1; };
  let lastSchedule = '';
  let scheduleTimer = null;
  const scheduleSoon = () => { clearTimeout(scheduleTimer); scheduleTimer = setTimeout(() => schedule().catch((e) => console.error('schedule', e)), 800); };
  let tr = (s) => s;
  async function channelFor(settings) {
    if (!NATIVE) return undefined;
    const tone = settings.alarmSound === false ? 'silent' : (['chime', 'bell', 'marimba', 'beeps', 'clock'].includes(settings.alarmTone) ? settings.alarmTone : 'chime');
    const id = `alarms-${tone}`;
    await N.createChannel({ id, name: tone === 'silent' ? tr('Alarms (silent)') : tr('Alarms'), importance: 5, visibility: 1, vibration: true, lights: true, lightColor: '#E26E26', ...(tone === 'silent' ? {} : { sound: `${tone}.wav` }) }).catch(() => {});
    return id;
  }
  async function schedule() {
    if (!host) return;
    const meta = await host.call('data:meta', []);
    const settings = (meta && meta.settings) || {};
    const list = await host.call('alarms:list', [14]);
    const at = Date.now();
    const sus = list.suspended;
    const until = sus === true ? Infinity : Number(sus) || 0;
    const rows = list.alarms.filter((a) => (a.status === 'upcoming' || a.status === 'snoozed') && a.when > at + 1000 && a.when >= until).slice(0, LIMIT);
    const channelId = await channelFor(settings);
    const tf = new Intl.DateTimeFormat(navigator.language || 'en', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    const notes = rows.map((a) => ({
      id: idOf(a.key),
      title: `${a.important ? '★ ' : ''}${a.summary || 'ReminderFoxAgain'}`,
      body: [a.allDay ? '' : tf.format(new Date(a.start != null ? a.start : a.when)), a.location].filter(Boolean).join(' · ') || 'ReminderFoxAgain',
      schedule: { at: new Date(a.when), allowWhileIdle: true },
      actionTypeId: 'alarm',
      extra: { key: a.key },
      smallIcon: 'ic_stat_reminderfoxagain',
      iconColor: '#E26E26',
      ...(channelId ? { channelId } : {}),
    }));
    const sig = JSON.stringify(notes.map((n) => [n.id, +n.schedule.at, n.title, n.body, n.channelId]));
    if (sig === lastSchedule) return;
    lastSchedule = sig;
    try {
      const pending = await N.getPending();
      if (pending.notifications.length) await N.cancel({ notifications: pending.notifications.map((p) => ({ id: p.id })) });
      if (notes.length && NATIVE) await N.schedule({ notifications: notes });
    } catch (e) { console.error('notifications', e && e.message); }
    window.RFA_SCHEDULED = notes; // for the UI checks
  }
  async function setUpNotifications() {
    if (!NATIVE) return;
    try {
      let p = await N.checkPermissions();
      if (p.display !== 'granted') p = await N.requestPermissions();
      await N.registerActionTypes({ types: [{ id: 'alarm', actions: [
        { id: 'snooze', title: tr('Snooze') }, { id: 'done', title: tr('Done') }, { id: 'open', title: tr('Open'), foreground: true }] }] });
      const exact = await N.checkExactNotificationSetting().catch(() => ({ exact_alarm: 'granted' }));
      if (exact.exact_alarm !== 'granted') window.RFA_EXACT_DENIED = true;
    } catch (e) { console.error('notification setup', e && e.message); }
    N.addListener('localNotificationActionPerformed', async (ev) => {
      const key = ev && ev.notification && ev.notification.extra && ev.notification.extra.key;
      if (!key) return;
      await started;
      await host.checkAlarms();
      const meta = await host.call('data:meta', []);
      const s = (meta && meta.settings) || {};
      const secs = (Number(s.snoozeAmount) || 10) * ({ minutes: 60, hours: 3600, days: 86400 }[s.snoozeUnit] || 60);
      if (ev.actionId === 'snooze') await host.call('alarm:snooze', [key, secs]);
      else if (ev.actionId === 'done') await host.call('alarm:complete', [key]);
      else if (ev.actionId === 'open') await host.call('alarm:open', [key]);
      else openSheet('alarm'); // tapped: the Due now sheet
      scheduleSoon();
    });
  }

  // ---------------------------------------------------------------- language, links, calendars
  async function loadDict(lang) {
    const r = await fetch(`locales/${lang}.json`);
    return r.ok ? r.json() : {};
  }
  let pageLang = null;
  function languageChanged(info) {
    try { localStorage.setItem('rf.i18n', JSON.stringify(info)); } catch (e) { /* English until next time */ }
    // the pages read the language as they load: reload once the host knows it (first start, or a new choice)
    if (pageLang != null && info && info.lang !== pageLang) location.reload();
  }
  function openUrl(url) {
    if (NATIVE) C.Browser.open({ url }).catch(() => {});
    else window.open(url, '_blank', 'noopener');
  }
  async function fetchText(url) {
    let r = null;
    try { r = await fetch(url, { credentials: 'omit', cache: 'no-store' }); } catch (e) {
      throw new Error('The calendar could not be fetched. Check the address and your connection.');
    }
    if (!r.ok) throw new Error('The calendar\'s web site did not give the calendar. Check the address.');
    return r.text();
  }

  // ---------------------------------------------------------------- the host
  let host = null;
  const started = (async () => {
    try { pageLang = (JSON.parse(localStorage.getItem('rf.i18n') || 'null') || {}).lang || 'en'; } catch (e) { pageLang = 'en'; }
    host = RFHost.createHost({
      platform: 'android', os: 'linux', version: RF_VERSION, dataLabel: 'Share a copy of your reminders file',
      files, emit, windows, openUrl, loadDict, languageChanged, fetchText,
      notify: () => {}, // the scheduled notification is already there
      badge: () => {}, tooltip: () => {}, menu: () => {},
      systemLocale: () => navigator.language || 'en',
    });
    await host.start();
    // the notification texts in the app's language
    const words = {};
    for (const w of ['Snooze', 'Done', 'Open', 'Alarms', 'Alarms (silent)']) words[w] = await Promise.resolve(host.call('host:t', [w])).catch(() => w);
    tr = (w) => words[w] || w;
    await setUpNotifications();
    scheduleSoon();
  })().catch((e) => console.error('ReminderFoxAgain could not start', e));

  C.App.addListener('pause', () => { scheduleSoon(); });
  C.App.addListener('resume', async () => { await started; await host.checkAlarms(); scheduleSoon(); });

  // ---------------------------------------------------------------- what bridge.js sends (through shim.js)
  window.RFHOST = {
    message(msg, win) {
      if (!msg || typeof msg !== 'object') return Promise.resolve(null);
      if (msg.rf === 'ready') {
        const page = pageOf(win);
        return started.then(() => {
          ready[page] = true;
          for (const m of (waiting[page] || []).splice(0)) deliver(m);
          return true;
        });
      }
      if (msg.rf === 'tb') return Promise.resolve({ ok: false, error: 'Not available on Android.' });
      if (msg.rf !== 'call') return Promise.resolve(null);
      return started.then(() => host.call(msg.ch, msg.args || []))
        .then((value) => ({ ok: true, value: value === undefined ? null : value }), (err) => ({ ok: false, error: (err && err.message) || String(err) }));
    },
    listen(fn, win) { listeners.push({ win, fn }); },
    closeSheet,
    hideSheet,
    openSheet,
    sheetOpen: (page) => !!sheets[page] && sheets[page].el.classList.contains('open'),
    schedule: () => schedule(),
    started: () => started,
  };
}());
