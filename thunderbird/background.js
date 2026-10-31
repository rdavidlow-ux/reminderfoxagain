'use strict';
/* global browser, RFHost, RF_VERSION */
// ReminderFoxAgain for Thunderbird — the background page. It runs the shared host core (src/host/core.js, bundled
// into host.js) with a Thunderbird adapter:
//   files       browser.storage.local, one key per file ("f:reminders.ics"), plus an index of names
//   main window a Thunderbird tab with src/ui/index.html (the toolbar button opens it)
//   alarm, pop-up  popup windows with src/ui/alarm.html and src/ui/slider.html
//   tray        the toolbar button: its tooltip, a count on it, and its right-click menu
// The pages talk to this page through bridge.js (runtime messages); this page answers with the core's channels.
(function () {
  const PAGE = {
    main: browser.runtime.getURL('src/ui/index.html'),
    alarm: browser.runtime.getURL('src/ui/alarm.html'),
    slider: browser.runtime.getURL('src/ui/slider.html'),
  };
  // meta().dataFile: app.js shows it as the tooltip of the status bar's "Data file" link, which saves a copy here
  const DATA_LABEL = 'Save a copy of your reminders file';

  // ---------------------------------------------------------------- files in storage.local
  const KEY = (name) => `f:${name}`;
  const INDEX = 'f-index';
  let fileIndex = null;
  async function idx() {
    if (!fileIndex) fileIndex = (await browser.storage.local.get(INDEX))[INDEX] || {};
    return fileIndex;
  }
  const files = {
    async read(name) { const r = await browser.storage.local.get(KEY(name)); return r[KEY(name)] == null ? null : r[KEY(name)]; },
    async write(name, text) {
      const i = await idx();
      i[name] = { size: text.length, mtime: Date.now() };
      await browser.storage.local.set({ [KEY(name)]: text, [INDEX]: i });
    },
    async remove(name) {
      const i = await idx();
      delete i[name];
      await browser.storage.local.remove(KEY(name));
      await browser.storage.local.set({ [INDEX]: i });
    },
    async list() { const i = await idx(); return Object.entries(i).map(([name, v]) => ({ name, size: v.size, mtime: v.mtime })); },
  };

  // ---------------------------------------------------------------- pages: messages out, readiness
  const ready = { main: null, alarm: null, slider: null }; // the page's tab id once it said it is ready
  const waiting = { main: [], alarm: [], slider: [] }; // messages for a page that is still loading
  function emit(ch, payload, target) {
    const msg = { rf: 'emit', ch, payload, target: target || null };
    if (target && !ready[target]) {
      // a page that is opening gets it once it is ready; a page that isn't open doesn't need it (it asks on load)
      const opening = target === 'main' ? mainTab != null : popups[target] != null;
      if (opening) waiting[target].push(msg);
      return;
    }
    browser.runtime.sendMessage(msg).catch(() => { /* no page open */ });
  }
  function pageReady(page, tabId) {
    ready[page] = tabId || true;
    const q = waiting[page].splice(0);
    for (const m of q) browser.runtime.sendMessage(m).catch(() => {});
    if (readyWaiters[page]) { for (const r of readyWaiters[page].splice(0)) r(); }
  }
  const readyWaiters = { main: [], alarm: [], slider: [] };
  const whenReady = (page) => (ready[page] ? Promise.resolve() : new Promise((r) => readyWaiters[page].push(r)));

  // ---------------------------------------------------------------- windows
  let mainTab = null;
  async function showMain() {
    try {
      if (mainTab != null) {
        const t = await browser.tabs.get(mainTab).catch(() => null);
        if (t) {
          await browser.tabs.update(t.id, { active: true });
          if (t.windowId != null) await browser.windows.update(t.windowId, { focused: true }).catch(() => {});
          return whenReady('main');
        }
      }
      const found = (await browser.tabs.query({})).find((t) => t.url && t.url.split('#')[0] === PAGE.main);
      if (found) { mainTab = found.id; return showMain(); }
      ready.main = null;
      const t = await browser.tabs.create({ url: PAGE.main, active: true });
      mainTab = t.id;
    } catch (e) { console.error('main tab', e); }
    return whenReady('main');
  }
  const popups = { alarm: null, slider: null }; // window ids
  function place(w, h, corner) {
    const s = window.screen;
    const left = (s.availLeft || 0) + (String(corner).endsWith('l') ? 16 : s.availWidth - w - 16);
    const top = (s.availTop || 0) + (String(corner).startsWith('t') ? 16 : s.availHeight - h - 16);
    return { left: Math.max(0, Math.round(left)), top: Math.max(0, Math.round(top)) };
  }
  async function openPopup(page, w, h, corner) {
    if (popups[page] != null) {
      const win = await browser.windows.get(popups[page]).catch(() => null);
      if (win) { await browser.windows.update(win.id, { state: 'normal', focused: page === 'alarm', drawAttention: page === 'alarm', ...place(w, h, corner) }).catch(() => {}); return; }
    }
    ready[page] = null;
    const win = await browser.windows.create({ url: PAGE[page], type: 'popup', width: w, height: h, allowScriptsToClose: true, ...place(w, h, corner) });
    popups[page] = win.id;
  }
  async function closePopup(page) {
    const id = popups[page];
    popups[page] = null; ready[page] = null; waiting[page] = [];
    if (id != null) await browser.windows.remove(id).catch(() => {});
  }
  browser.windows.onRemoved.addListener((id) => {
    if (id === popups.alarm) { popups.alarm = null; ready.alarm = null; waiting.alarm = []; host.alarmClosed(); }
    if (id === popups.slider) { popups.slider = null; ready.slider = null; waiting.slider = []; }
  });
  browser.tabs.onRemoved.addListener((id) => { if (id === mainTab) { mainTab = null; ready.main = null; waiting.main = []; } });
  const windows = {
    showMain,
    alarm: {
      show: () => openPopup('alarm', 500, 360, 'br'),
      raise: () => openPopup('alarm', 500, 360, 'br'),
      close: () => closePopup('alarm'),
      hide: () => { if (popups.alarm != null) browser.windows.update(popups.alarm, { state: 'minimized' }).catch(() => {}); },
    },
    slider: { show: (corner) => openPopup('slider', 360, 380, corner), close: () => closePopup('slider') },
  };

  // ---------------------------------------------------------------- the toolbar button
  const ACTION = browser.browserAction;
  function badge(n) {
    ACTION.setBadgeText({ text: n ? String(n) : '' }).catch(() => {});
    if (n) ACTION.setBadgeBackgroundColor({ color: '#e26e26' }).catch(() => {});
  }
  function tooltip(text) { ACTION.setTitle({ title: String(text).slice(0, 500) }).catch(() => {}); }
  let menuIds = [];
  async function menu(items) {
    for (const id of menuIds) await browser.menus.remove(id).catch(() => {});
    menuIds = [];
    let n = 0;
    for (const it of items) {
      const id = it.type === 'separator' ? `sep-${n++}` : `rf-${it.id}`;
      browser.menus.create({ id, type: it.type === 'separator' ? 'separator' : 'normal', title: it.title || '', contexts: ['browser_action'] });
      menuIds.push(id);
    }
  }
  browser.menus.onClicked.addListener((info) => {
    const id = String(info.menuItemId || '');
    if (id.startsWith('rf-')) host.menuClick(id.slice(3));
  });
  ACTION.onClicked.addListener(() => showMain());

  // ---------------------------------------------------------------- notifications, links, language
  function notify(title, body) {
    browser.notifications.create('rf-alarm', { type: 'basic', title: String(title), message: String(body), iconUrl: browser.runtime.getURL('assets/icon.png') }).catch(() => {});
  }
  browser.notifications.onClicked.addListener((id) => { if (id === 'rf-alarm' && popups.alarm != null) browser.windows.update(popups.alarm, { focused: true, state: 'normal' }).catch(() => {}); });
  function openUrl(url) {
    // Thunderbird opens web links in the system browser
    if (browser.windows.openDefaultBrowser) browser.windows.openDefaultBrowser(url).catch(() => {});
    else browser.tabs.create({ url }).catch(() => {});
  }
  async function loadDict(lang) {
    const r = await fetch(browser.runtime.getURL(`src/ui/locales/${lang}.json`));
    return r.ok ? r.json() : {};
  }
  // the pages read the language synchronously before they render (bridge.js), from this page's localStorage
  function languageChanged(info) { try { localStorage.setItem('rf.i18n', JSON.stringify(info)); } catch (e) { /* the pages fall back to English */ } }

  // ---------------------------------------------------------------- the host
  const OS = { win: 'windows', mac: 'macos', linux: 'linux' };
  let host = null;
  const started = (async () => {
    const info = await browser.runtime.getPlatformInfo().catch(() => ({ os: 'win' }));
    host = RFHost.createHost({
      platform: 'thunderbird', os: OS[info.os] || 'linux', version: RF_VERSION, dataLabel: DATA_LABEL,
      files, emit, windows, notify, badge, tooltip, menu, openUrl, loadDict, languageChanged,
      systemLocale: () => browser.i18n.getUILanguage() || navigator.language || 'en',
    });
    await host.start();
  })().catch((e) => console.error('ReminderFoxAgain could not start', e));

  browser.runtime.onMessage.addListener((msg, sender) => {
    if (!msg || typeof msg !== 'object') return undefined;
    if (msg.rf === 'ready') { started.then(() => pageReady(msg.page, sender.tab && sender.tab.id)); if (msg.page === 'main' && sender.tab) mainTab = sender.tab.id; return Promise.resolve(true); }
    if (msg.rf !== 'call') return undefined;
    return started.then(() => host.call(msg.ch, msg.args))
      .then((value) => ({ ok: true, value: value === undefined ? null : value }), (err) => ({ ok: false, error: (err && err.message) || String(err) }));
  });

  // alarms: after the computer wakes or is unlocked, check at once (as the desktop app does after resume/unlock)
  if (browser.idle && browser.idle.onStateChanged) browser.idle.onStateChanged.addListener((s) => { if (s === 'active' && host) setTimeout(() => host.checkAlarms(), 1000); });
  // first install: open the welcome page
  browser.runtime.onInstalled.addListener((d) => { if (d.reason === 'install') started.then(() => showMain()); });
}());
