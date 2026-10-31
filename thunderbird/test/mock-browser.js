'use strict';
// A stand-in for the Thunderbird WebExtension API (the parts the add-on uses), for running the built add-on in
// Chromium (thunderbird/test/run.js). Injected into every page before its scripts. The background page is /_bg.html;
// the add-on's pages are opened by the test runner when the background page asks for a tab or a window.
// Messages travel on a BroadcastChannel, as runtime messages do between extension pages.
(function () {
  const IS_BG = location.pathname === '/_bg.html';
  const params = new URLSearchParams(location.search);
  const TAB = Number(params.get('tab')) || 0;
  const ch = new BroadcastChannel('rf-mock');
  const listeners = (name) => { const ls = []; return { addListener: (f) => ls.push(f), removeListener: (f) => { const i = ls.indexOf(f); if (i >= 0) ls.splice(i, 1); }, hasListener: (f) => ls.includes(f), _fire: (...a) => ls.map((f) => f(...a)), _ls: ls, name }; };
  const onMessage = listeners('runtime.onMessage');
  let seq = 0;
  const pending = new Map();
  ch.onmessage = async (e) => {
    const d = e.data;
    if (IS_BG && d.type === 'msg') {
      let value;
      for (const r of onMessage._fire(d.msg, { tab: d.tab ? { id: d.tab } : undefined, url: d.url })) if (r !== undefined) { value = await r; break; }
      ch.postMessage({ type: 'resp', id: d.id, to: d.from, value });
    } else if (!IS_BG && d.type === 'resp' && d.to === PAGE_ID && pending.has(d.id)) {
      pending.get(d.id)(d.value); pending.delete(d.id);
    } else if (!IS_BG && d.type === 'evt') {
      onMessage._fire(d.msg, {});
    }
  };
  const PAGE_ID = `${location.pathname}#${TAB}#${Math.random()}`;
  const sendMessage = (msg) => {
    if (IS_BG) { ch.postMessage({ type: 'evt', msg }); return Promise.resolve(); }
    return new Promise((res) => { const id = ++seq; pending.set(id, res); ch.postMessage({ type: 'msg', id, from: PAGE_ID, tab: TAB, url: location.href, msg }); });
  };
  const ok = (v) => Promise.resolve(v);

  // the background page's view of tabs and windows; the runner opens and closes the real pages
  const state = { tabs: new Map(), windows: new Map(), next: 100, requests: [], badge: '', title: '', menus: [], notes: [], urls: [] };
  const onRemovedWin = listeners('windows.onRemoved');
  const onRemovedTab = listeners('tabs.onRemoved');
  const onClicked = listeners('browserAction.onClicked');
  const onMenu = listeners('menus.onClicked');
  const abs = (u) => new URL(u, location.origin).href;
  window.__mock = {
    state,
    // the runner: a page it opened, or one the person closed
    opened: (kind, id, url) => { if (kind === 'tab') state.tabs.set(id, { id, url, windowId: 1 }); },
    closed: (kind, id) => { if (kind === 'tab') { state.tabs.delete(id); onRemovedTab._fire(id); } else { state.windows.delete(id); onRemovedWin._fire(id); } },
    clickButton: () => onClicked._fire({}),
    clickMenu: (id) => onMenu._fire({ menuItemId: id }),
  };
  const seed = window.__seed || {};
  const store = new Map(Object.entries(seed.storage || {}));
  window.browser = {
    runtime: {
      getURL: (p) => abs(`/${p}`),
      sendMessage,
      onMessage,
      getPlatformInfo: () => ok({ os: seed.os || 'linux' }),
      onInstalled: listeners('runtime.onInstalled'),
    },
    i18n: { getUILanguage: () => seed.uiLanguage || 'en-CA' },
    storage: { local: {
      get: (k) => { const out = {}; for (const key of k == null ? [...store.keys()] : [].concat(k)) if (store.has(key)) out[key] = JSON.parse(JSON.stringify(store.get(key))); return ok(out); },
      set: (o) => { for (const [k, v] of Object.entries(o)) store.set(k, JSON.parse(JSON.stringify(v))); return ok(); },
      remove: (k) => { for (const key of [].concat(k)) store.delete(key); return ok(); },
    } },
    tabs: {
      create: ({ url }) => { const id = state.next++; state.tabs.set(id, { id, url: abs(url), windowId: 1 }); state.requests.push({ kind: 'tab', id, url: abs(url) }); return ok({ id, windowId: 1 }); },
      get: (id) => (state.tabs.has(id) ? ok(state.tabs.get(id)) : Promise.reject(new Error('no tab'))),
      query: () => ok([...state.tabs.values()]),
      update: (id) => ok(state.tabs.get(id)),
      onRemoved: onRemovedTab,
    },
    windows: {
      create: (o) => { const id = state.next++; state.windows.set(id, { id, ...o, url: abs(o.url) }); state.requests.push({ kind: 'window', id, url: abs(o.url), width: o.width, height: o.height }); return ok({ id }); },
      get: (id) => (state.windows.has(id) ? ok(state.windows.get(id)) : Promise.reject(new Error('no window'))),
      update: (id, o) => { if (state.windows.has(id)) Object.assign(state.windows.get(id), o); return ok(); },
      remove: (id) => { if (state.windows.has(id)) { state.windows.delete(id); state.requests.push({ kind: 'close', id }); onRemovedWin._fire(id); } return ok(); },
      onRemoved: onRemovedWin,
      openDefaultBrowser: (url) => { state.urls.push(url); return ok(); },
    },
    browserAction: {
      setBadgeText: ({ text }) => { state.badge = text; return ok(); },
      setBadgeBackgroundColor: () => ok(),
      setTitle: ({ title }) => { state.title = title; return ok(); },
      onClicked,
    },
    menus: {
      create: (o) => { state.menus.push(o); return o.id; },
      remove: (id) => { state.menus = state.menus.filter((m) => m.id !== id); return ok(); },
      onClicked: onMenu,
    },
    notifications: { create: (id, o) => { state.notes.push(o); return ok(id); }, onClicked: listeners('notifications.onClicked') },
    idle: { onStateChanged: listeners('idle.onStateChanged') },
  };
}());
