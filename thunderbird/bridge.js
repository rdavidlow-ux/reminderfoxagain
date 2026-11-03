'use strict';
/* global browser */
// ReminderFoxAgain for Thunderbird — window.rf for the pages (the desktop's src/preload.js, for an add-on).
// Loaded first by index.html, alarm.html and slider.html. Calls go to the background page as runtime messages; what
// needs the person (picking a file, saving one) happens here in the page, and only the text crosses over.
(function () {
  const PAGE = /alarm\.html$/.test(location.pathname) ? 'alarm' : /slider\.html$/.test(location.pathname) ? 'slider' : 'main';

  // the language, synchronously, before the page renders: the background page keeps it in localStorage (same origin)
  let i18n = { lang: 'en', dict: {}, dateLocale: '', collect: false, platform: 'windows', host: 'thunderbird' };
  try {
    const saved = JSON.parse(localStorage.getItem('rf.i18n') || 'null');
    if (saved) i18n = { ...i18n, ...saved, dict: {} };
    i18n.keys = JSON.parse(localStorage.getItem('rf.keys') || 'null'); // the Thunderbird shortcuts, by the desktop letter
    if (i18n.lang && i18n.lang !== 'en') {
      const x = new XMLHttpRequest();
      x.open('GET', `locales/${i18n.lang}.json`, false); // a local file in the add-on; synchronous on purpose
      x.send();
      if (x.status === 200 || x.status === 0) i18n.dict = JSON.parse(x.responseText);
    }
  } catch (e) { i18n = { ...i18n, lang: 'en', dict: {} }; }
  document.documentElement.dataset.host = 'thunderbird';

  async function call(ch, ...args) {
    const r = await browser.runtime.sendMessage({ rf: 'call', ch, args });
    if (!r || !r.ok) throw new Error((r && r.error) || 'Unknown error');
    return r.value;
  }
  // the add-on's own channels: Thunderbird's compose and address-book APIs (background.js)
  async function tb(ch, ...args) {
    const r = await browser.runtime.sendMessage({ rf: 'tb', ch, args });
    if (!r || !r.ok) throw new Error((r && r.error) || 'Unknown error');
    return r.value;
  }

  // ---------------------------------------------------------------- files the person picks or saves
  const ICS = '.ics,.ical,.ifb,.icalendar,text/calendar';
  function pick({ accept, multiple, as }) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept || '';
      input.multiple = !!multiple;
      input.style.display = 'none';
      let settled = false;
      const done = (v) => { if (settled) return; settled = true; input.remove(); resolve(v); };
      input.addEventListener('cancel', () => done(null));
      input.addEventListener('change', async () => {
        const list = [...(input.files || [])];
        if (!list.length) { done(null); return; }
        const out = [];
        for (const f of list) {
          out.push({ name: f.name, size: f.size, mtime: f.lastModified, text: as === 'dataUrl' ? await asDataUrl(f) : await f.text() });
        }
        done(out);
      });
      document.body.appendChild(input);
      input.click();
    });
  }
  const asDataUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
  function save(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 60000);
    return name;
  }
  async function pickAndUpload(opts) {
    const files = await pick(opts);
    return files ? call('upload', files) : null;
  }

  // ---------------------------------------------------------------- events from the background page
  const listeners = {};
  const CHANNELS = ['data:changed', 'settings:changed', 'alarms:update', 'alarms:ring', 'ui:new', 'ui:edit', 'ui:quick', 'ui:suspend', 'slider:update',
    'ui:import', 'ui:export', 'ui:settings', 'ui:goto', 'ui:side', 'ui:find', 'ui:importFiles', 'ui:alarms'];
  browser.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.rf !== 'emit') return;
    if (msg.target && msg.target !== PAGE) return;
    if (msg.ch === 'host:reload') { location.reload(); return; }
    // a Thunderbird shortcut: press the app's key here (Alt+Shift and the same letter as the desktop app), so the page's own keyboard handler does what it always does
    if (msg.ch === 'host:key') {
      const target = document.activeElement || document.body;
      const k = String(msg.payload.key || '').toUpperCase();
      target.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: `Key${k}`, altKey: true, shiftKey: true, bubbles: true, cancelable: true }));
      return;
    }
    for (const fn of listeners[msg.ch] || []) { try { fn(msg.payload); } catch (e) { console.error(e); } }
  });

  // ---------------------------------------------------------------- text size (the desktop zooms its windows)
  function zoom(settings) {
    const f = Math.min(2, Math.max(0.7, (Number(settings && settings.textSize) || 100) / 100));
    document.documentElement.style.zoom = f === 1 ? '' : String(f);
  }
  (listeners['settings:changed'] = listeners['settings:changed'] || []).push(zoom);

  window.rf = {
    i18n,
    i18nMissing: () => {},
    range: (from, to, opts) => call('data:range', from, to, opts),
    next: (from, opts) => call('data:next', from, opts),
    history: (before, opts) => call('data:history', before, opts),
    all: () => call('data:all'),
    get: (uid) => call('data:get', uid),
    save: (dto) => call('data:save', dto),
    remove: (uid, occ) => call('data:delete', uid, occ),
    complete: (uid, done, occ) => call('data:complete', uid, done, occ),
    moveToList: (uid, list) => call('data:moveToList', uid, list),
    duplicate: (uid, opts) => call('data:duplicate', uid, opts),
    setOrder: (uids) => call('data:order', uids),
    renameList: (from, to) => call('lists:rename', from, to),
    removeList: (name, opts) => call('lists:remove', name, opts),
    renameCategory: (from, to) => call('categories:rename', from, to),
    quickList: () => call('quick:list'),
    quickAdd: (q) => call('quick:add', q),
    quickRemove: (id) => call('quick:remove', id),
    suspend: (until) => call('suspend:set', until),
    suspended: () => call('suspend:get'),
    chooseSound: async () => {
      const files = await pick({ accept: 'audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm', as: 'dataUrl' });
      if (!files) return null;
      const f = files[0];
      return call('sound:set', { name: f.name, size: f.size, dataUrl: f.text });
    },
    soundData: () => call('sound:data'),
    sliderState: () => call('slider:state'),
    showSlider: () => call('slider:show'),
    closeSlider: () => call('slider:close'),
    openFromSlider: (uid, start) => call('slider:open', uid, start),
    setBadge: (trayUrl, overlayUrl, text, count) => call('badge:set', null, null, text, count),
    backupNow: async (choose) => {
      const file = await call('backup:now');
      if (!choose) return file;
      const b = await call('backup:text', file);
      return save(b.name, b.text);
    },
    backupList: () => call('backup:list'),
    backupDescribe: (file) => call('backup:describe', file),
    backupChoose: async () => {
      const t = await pickAndUpload({ accept: ICS });
      return t ? call('backup:describe', t[0]) : null;
    },
    backupRestore: (file) => call('backup:restore', file),
    openBackups: async () => true, // no folder to show in an add-on (the Restore dialog lists the backups)
    meta: () => call('data:meta'),
    // "Data file": there is no folder to open, so it saves a copy of the reminders file instead
    openDataFolder: async () => { const d = await call('data:text'); save(d.name, d.text); return true; },
    openUrl: (u) => call('open:url', u),
    // the email a reminder or list item came from (Thunderbird only: the desktop has no openEmail, so it shows no button)
    openEmail: (messageId) => call('mail:open', messageId),
    // Thunderbird only: a reminder or list item as an email, and an invitation to it (the desktop has neither)
    sendByEmail: (uid) => tb('sendItem', uid),
    invite: (uid) => (window.RFTB && window.RFTB.openInvite ? window.RFTB.openInvite(uid) : null),
    inviteSend: (uid, emails) => tb('invite', uid, emails),
    contacts: (text) => tb('contacts', text),
    setSettings: (patch) => call('settings:set', patch),
    importIcs: async () => {
      const t = await pickAndUpload({ accept: ICS, multiple: true });
      return t ? call('ics:importPaths', t, {}) : null;
    },
    importPath: (p) => call('ics:importPath', p),
    // the add-on's prefs.js may be picked with the reminderfox.ics: it brings the add-on's list names
    pickIcs: (kind) => pickAndUpload({ accept: kind === 'old' || kind === 'any' ? `${ICS},.js` : ICS, multiple: true }),
    previewImport: (files) => call('ics:preview', files),
    importPaths: (files, opts) => call('ics:importPaths', files, opts),
    exportIcs: async (opts) => { const d = await call('ics:exportText', opts); return save(d.name, d.text); },
    findOld: () => call('rf:findOld'),
    pickOld: async () => {
      const t = await pickAndUpload({ accept: `${ICS},.js`, multiple: true });
      return t ? call('ics:importPaths', t, {}) : null;
    },
    snooze: (key, seconds) => call('alarm:snooze', key, seconds),
    dismiss: (key) => call('alarm:dismiss', key),
    dismissAll: () => call('alarm:dismissAll'),
    completeAlarm: (key) => call('alarm:complete', key),
    openAlarm: (key) => call('alarm:open', key),
    hideAlarm: () => call('alarm:hide'),
    alarmState: () => call('alarm:state'),
    alarmsList: (days) => call('alarms:list', days),
    // calendar subscriptions: Thunderbird asks once to let the add-on read the calendar's web site
    subsList: () => call('subs:list'),
    // Thunderbird only lets permissions.request run while it is handling the click (or Enter) itself, so it is called
    // at once, before anything is awaited; when the site is already allowed it answers true without asking.
    subsAdd: (o) => {
      let origin = '';
      try { origin = new URL(String((o && o.url) || '').trim().replace(/^webcals?:\/\//i, 'https://')).origin; } catch (e) { origin = ''; }
      let asked = Promise.resolve(true);
      if (origin && /^https?:/.test(origin) && browser.permissions && browser.permissions.request) {
        try { asked = Promise.resolve(browser.permissions.request({ origins: [`${origin}/*`] })); } catch (e) { asked = Promise.reject(e); }
      }
      return asked.then((ok) => {
        if (!ok) throw new Error('ReminderFoxAgain needs your permission to read that web site.');
        return call('subs:add', o);
      });
    },
    subsUpdate: (id, patch) => call('subs:update', id, patch),
    subsRemove: (id) => call('subs:remove', id),
    subsRefresh: (id) => call('subs:refresh', id),
    subsRange: (from, to, view) => call('subs:range', from, to, view),
    subsNext: (from, opts, view) => call('subs:next', from, opts, view),
    subsCopy: (uid) => call('subs:copy', uid),
    unskipAlarm: (key) => call('alarm:unskip', key),
    on: (channel, fn) => {
      if (!CHANNELS.includes(channel)) throw new Error(`Unknown channel ${channel}`);
      (listeners[channel] = listeners[channel] || []).push(fn);
      return () => { listeners[channel] = (listeners[channel] || []).filter((f) => f !== fn); };
    },
  };

  const start = () => {
    browser.runtime.sendMessage({ rf: 'ready', page: PAGE }).catch(() => {});
    call('data:meta').then((m) => zoom(m && m.settings)).catch(() => {});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
