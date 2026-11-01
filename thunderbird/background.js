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
    if (ch === 'data:changed') scheduleTags();   // the tags on emails follow the items
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
      const icons = it.contexts ? { 16: 'assets/tb/icon-16.png', 32: 'assets/tb/icon-32.png' } : undefined;
      browser.menus.create({ id, type: it.type === 'separator' ? 'separator' : 'normal', title: it.title || '', contexts: it.contexts || ['browser_action'], ...(icons ? { icons } : {}), ...(it.targetUrlPatterns ? { targetUrlPatterns: it.targetUrlPatterns } : {}) });
      menuIds.push(id);
    }
  }
  browser.menus.onClicked.addListener((info, tab) => {
    const id = String(info.menuItemId || '');
    if (id === 'rf-mail-reminder') reminderFromEmail(info, 'event');
    else if (id === 'rf-mail-todo') reminderFromEmail(info, 'todo');
    else if (id === 'rf-sel-reminder') reminderFromSelection(info, tab, 'event');
    else if (id === 'rf-sel-todo') reminderFromSelection(info, tab, 'todo');
    else if (id === 'rf-link-ics') importLink(info);
    else if (id.startsWith('rf-')) host.menuClick(id.slice(3));
  });

  // ---------------------------------------------------------------- "Add reminder…" / "Add list item…" on an email
  // The right-clicked email's subject becomes the description; the first date ahead in the subject, else in the text,
  // becomes the reminder's date or the list item's "due by" (with the time and place, if any). The person checks it in
  // the editor and saves. kind: 'event' (a reminder) or 'todo' (an item in the list being shown)
  async function reminderFromEmail(info, kind) {
    const sel = info.selectedMessages && info.selectedMessages.messages;
    const msg = sel && sel.length ? sel[0] : null;
    if (!msg) return;
    let body = '';
    try { body = textOf(await browser.messages.getFull(msg.id)); } catch (e) { /* the subject alone */ }
    const date = msg.date instanceof Date ? msg.date.getTime() : Number(new Date(msg.date)) || Date.now();
    const p = await host.call('mail:reminder', [{ subject: msg.subject || '', date, body, messageId: msg.headerMessageId || '' }, kind]);
    await showMain();
    emit('ui:new', p, 'main');
  }
  // open the email an item came from, by its Message-ID, in a Thunderbird tab (any account it is in)
  async function openEmail(messageId) {
    const headerMessageId = String(messageId).trim().replace(/^<|>$/g, '');
    try {
      await browser.messageDisplay.open({ headerMessageId, location: 'tab', active: true });
    } catch (e) {
      throw new Error('The email this came from was not found. It may have been deleted, or it is in an account that is not set up in this Thunderbird.');
    }
  }
  // the readable text of a message: its plain-text parts, else its HTML parts without the markup
  function textOf(part) {
    const plain = []; const html = [];
    (function walk(p) {
      if (!p) return;
      const type = String(p.contentType || '').toLowerCase();
      if (p.body && type === 'text/plain') plain.push(p.body);
      else if (p.body && type === 'text/html') html.push(p.body);
      for (const c of p.parts || []) walk(c);
    }(part));
    if (plain.length) return plain.join('\n');
    const doc = new DOMParser().parseFromString(html.join('\n'), 'text/html');
    for (const el of doc.querySelectorAll('script, style')) el.remove();
    for (const el of doc.querySelectorAll('br, p, div, li, tr, h1, h2, h3, blockquote')) el.append('\n');
    for (const q of doc.querySelectorAll('blockquote[type="cite"]')) q.remove(); // quoted replies
    return doc.body ? doc.body.textContent : '';
  }
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
      files, emit, windows, notify, badge, tooltip, menu, openUrl, loadDict, languageChanged, openEmail,
      onSettings: (settings, patch) => onSettings(settings, patch),
      systemLocale: () => browser.i18n.getUILanguage() || navigator.language || 'en',
    });
    await host.start();
  })().catch((e) => console.error('ReminderFoxAgain could not start', e));

  browser.runtime.onMessage.addListener((msg, sender) => {
    if (!msg || typeof msg !== 'object') return undefined;
    if (msg.rf === 'ready') { started.then(() => pageReady(msg.page, sender.tab && sender.tab.id)); if (msg.page === 'main' && sender.tab) mainTab = sender.tab.id; return Promise.resolve(true); }
    if (msg.rf === 'tb') {   // the add-on's own channels (Thunderbird's email, compose and address-book APIs)
      return started.then(() => TB[msg.ch](...(msg.args || [])))
        .then((value) => ({ ok: true, value: value === undefined ? null : value }), (err) => ({ ok: false, error: (err && err.message) || String(err) }));
    }
    if (msg.rf !== 'call') return undefined;
    return started.then(() => host.call(msg.ch, msg.args))
      .then((value) => ({ ok: true, value: value === undefined ? null : value }), (err) => ({ ok: false, error: (err && err.message) || String(err) }));
  });

  // ---------------------------------------------------------------- keyboard shortcuts
  // Thunderbird keeps Ctrl+N, Ctrl+T, Ctrl+Q… for itself. The add-on's shortcuts (manifest "commands", Alt+Shift and the
  // same letter by default) bring the tab to the front and press the desktop key in it, so app.js handles it as before.
  // The pages show the shortcuts Thunderbird has now (people can change them) in place of "Ctrl+N" in their tooltips.
  let SHORTCUTS = {};
  const shortcutsReady = fetch(browser.runtime.getURL('tb/shortcuts.json')).then((r) => r.json()).then((j) => { SHORTCUTS = j; }).catch(() => {});
  async function publishKeys() {
    if (!browser.commands) return;
    await shortcutsReady;
    const keys = {};
    for (const c of await browser.commands.getAll().catch(() => [])) {
      const letter = (SHORTCUTS[c.name] || {}).letter;
      if (letter) keys[letter] = c.shortcut || '';
    }
    try { localStorage.setItem('rf.keys', JSON.stringify(keys)); } catch (e) { /* the tooltips keep the desktop keys */ }
  }
  if (browser.commands) {
    browser.commands.onCommand.addListener(async (name) => {
      await shortcutsReady;
      const letter = (SHORTCUTS[name] || {}).letter;
      if (!letter) return;
      await started;
      await showMain();
      emit('host:key', { key: letter.toLowerCase() }, 'main');
    });
    if (browser.commands.onChanged) browser.commands.onChanged.addListener(() => publishKeys());
    publishKeys();
  }

  // ---------------------------------------------------------------- what Thunderbird makes possible
  // 1 Send++ · 2 tags on emails · 3 send an item by email · 4 birthdays from address books · 5 selected text and .ics
  // links · 6 invitations and their replies. The rules are in the host core (src/host/core.js) and the store; this part
  // only talks to Thunderbird.
  const t = (text, vars) => host.call('host:t', [text, vars]);
  const ical = (text, name, method) => new File([text], name, { type: `text/calendar;charset=utf-8${method ? `;method=${method}` : ''}` });
  const findMessage = async (mid) => {
    const headerMessageId = String(mid || '').trim().replace(/^<|>$/g, '');
    if (!headerMessageId) return null;
    const r = await browser.messages.query({ headerMessageId }).catch(() => null);
    return (r && r.messages && r.messages[0]) || null;
  };
  // the account to send from: the default account's default identity
  async function identity() {
    let acc = null;
    try { acc = browser.accounts.getDefault ? await browser.accounts.getDefault() : null; } catch (e) { /* none */ }
    if (!acc) { const all = await browser.accounts.list().catch(() => []); acc = all.find((a) => a.identities && a.identities.length) || null; }
    if (!acc) return null;
    let id = null;
    try { id = browser.identities && browser.identities.getDefault ? await browser.identities.getDefault(acc.id) : null; } catch (e) { /* older */ }
    return id || (acc.identities || [])[0] || null;
  }

  // 3. an item as an email: a new message with the item as text and as an .ics attachment, for the person to send
  // 6. an invitation: the item records the attendees; the message goes to them from your account
  const TB = {
    sendItem: async (uid) => {
      const m = await host.call('mail:item', [uid]);
      await browser.compose.beginNew({ subject: m.subject, plainTextBody: m.body, isPlainText: true, attachments: [{ file: ical(m.ics, m.file) }] });
      return true;
    },
    invite: async (uid, emails) => {
      const me = await identity();
      const inv = await host.call('mail:invite', [uid, me ? { email: me.email, name: me.name } : null, emails]);
      await browser.compose.beginNew({ identityId: me.id, to: inv.to, subject: inv.subject, plainTextBody: inv.body, isPlainText: true, attachments: [{ file: ical(inv.ics, inv.file, 'REQUEST') }] });
      return inv.to;
    },
    // people from the address books for the invitation dialog: [{name, email}]
    contacts: async (text) => {
      const q = String(text || '').trim();
      if (q.length < 2 || !browser.addressBooks) return [];
      const found = await browser.addressBooks.contacts.quickSearch(q).catch(() => []);
      const out = [];
      for (const c of found) {
        const v = c.vCard || (c.properties && c.properties.vCard) || '';
        const name = (/^FN(?:;[^:]*)?:(.*)$/im.exec(v) || [])[1] || (c.properties && c.properties.DisplayName) || '';
        const mails = [...v.matchAll(/^EMAIL(?:;[^:]*)?:(.*)$/gim)].map((m) => m[1].trim());
        if (!mails.length && c.properties && c.properties.PrimaryEmail) mails.push(c.properties.PrimaryEmail);
        for (const email of mails) out.push({ name: name.trim(), email });
      }
      return out.slice(0, 8);
    },
  };

  // 1. Send++: "Remind me" in the compose window; after the email is sent, the editor opens for a reminder linked to it
  const remindTabs = new Set(); const pendingSend = new Map();
  if (browser.composeAction) {
    browser.composeAction.onClicked.addListener((tab) => {
      const on = !remindTabs.has(tab.id);
      if (on) remindTabs.add(tab.id); else remindTabs.delete(tab.id);
      browser.composeAction.setBadgeText({ tabId: tab.id, text: on ? '✓' : '' }).catch(() => {});
      browser.composeAction.setBadgeBackgroundColor({ tabId: tab.id, color: '#e26e26' }).catch(() => {});
    });
    started.then(() => titleCompose());
  }
  async function titleCompose() {
    if (!browser.composeAction) return;
    try {
      await browser.composeAction.setTitle({ title: await t('After sending, add a reminder for this email') });
      if (browser.composeAction.setLabel) await browser.composeAction.setLabel({ label: await t('Remind me') });
    } catch (e) { /* older Thunderbird */ }
  }
  if (browser.compose && browser.compose.onBeforeSend) {
    browser.compose.onBeforeSend.addListener((tab, details) => {
      if (!remindTabs.has(tab.id)) return undefined;
      const body = details.plainTextBody || (details.body ? new DOMParser().parseFromString(details.body, 'text/html').body.textContent : '');
      pendingSend.set(tab.id, { subject: details.subject || '', body });
      return undefined;
    });
    browser.compose.onAfterSend.addListener(async (tab, info) => {
      const p = pendingSend.get(tab.id);
      pendingSend.delete(tab.id); remindTabs.delete(tab.id);
      if (!p || (info && info.error)) return;
      const mid = (info && (info.headerMessageId || (info.messages && info.messages[0] && info.messages[0].headerMessageId))) || '';
      const r = await host.call('mail:reminder', [{ subject: p.subject, body: p.body, date: Date.now(), messageId: mid }, 'event']);
      await showMain();
      emit('ui:new', r, 'main');
    });
  }

  // 2. tags: emails that have an open reminder or list item get the ReminderFoxAgain tag, and lose it when it is done
  const TAG = { key: 'reminderfoxagain', name: 'ReminderFoxAgain', color: '#E26E26' };
  let tagOn = true; let tagTimer = null; let tagRunning = false;
  const tagged = new Set((() => { try { return JSON.parse(localStorage.getItem('rf.tagged') || '[]'); } catch (e) { return []; } })());
  const saveTagged = () => { try { localStorage.setItem('rf.tagged', JSON.stringify([...tagged])); } catch (e) { /* ignore */ } };
  async function ensureTag() {
    const api = browser.messages.tags || null;
    const list = api ? await api.list() : await browser.messages.listTags();
    if (list.some((x) => x.key === TAG.key)) return;
    if (api) await api.create(TAG.key, TAG.name, TAG.color); else await browser.messages.createTag(TAG.key, TAG.name, TAG.color);
  }
  async function setTag(mid, on) {
    const m = await findMessage(mid);
    if (!m) return false;
    const tags = new Set(m.tags || []);
    if (on === tags.has(TAG.key)) return true;
    if (on) tags.add(TAG.key); else tags.delete(TAG.key);
    await browser.messages.update(m.id, { tags: [...tags] });
    return true;
  }
  async function syncTags() {
    if (tagRunning) { scheduleTags(); return; }
    tagRunning = true;
    try {
      const { open } = await host.call('mail:linked');
      const want = new Set(tagOn ? open : []);
      if (want.size) await ensureTag();
      for (const mid of want) if (!tagged.has(mid) && await setTag(mid, true).catch(() => false)) tagged.add(mid);
      for (const mid of [...tagged]) if (!want.has(mid)) { await setTag(mid, false).catch(() => {}); tagged.delete(mid); }
      saveTagged();
    } catch (e) { console.error('tags', e); } finally { tagRunning = false; }
  }
  function scheduleTags() { clearTimeout(tagTimer); tagTimer = setTimeout(syncTags, 1500); }

  // 4. birthdays from the address books (Settings, off at first): kept in step while it is on
  let bdayOn = false; let bdayTimer = null;
  async function syncBirthdays() {
    if (!bdayOn || !browser.addressBooks) return;
    const contacts = [];
    const walk = (nodes) => { for (const n of nodes || []) { if (n.type === 'contact') contacts.push({ id: n.id, vcard: n.vCard || (n.properties && n.properties.vCard) || propsVcard(n.properties || {}) }); walk(n.contacts); } };
    walk(await browser.addressBooks.list(true).catch(() => []));
    await host.call('contacts:sync', [contacts, true]);
  }
  // an older Thunderbird's contact fields as a small vCard
  const propsVcard = (p) => `BEGIN:VCARD\r\nFN:${p.DisplayName || [p.FirstName, p.LastName].filter(Boolean).join(' ')}\r\n${p.BirthMonth && p.BirthDay ? `BDAY:${p.BirthYear || '--'}${String(p.BirthMonth).padStart(2, '0')}${String(p.BirthDay).padStart(2, '0')}\r\n` : ''}END:VCARD`;
  const scheduleBirthdays = () => { clearTimeout(bdayTimer); bdayTimer = setTimeout(() => syncBirthdays().catch((e) => console.error('birthdays', e)), 2000); };
  if (browser.addressBooks && browser.addressBooks.contacts) {
    for (const ev of ['onCreated', 'onUpdated', 'onDeleted']) if (browser.addressBooks.contacts[ev]) browser.addressBooks.contacts[ev].addListener(() => { if (bdayOn) scheduleBirthdays(); });
  }

  // the settings for 2 and 4 (in Settings → General, added by tb.js)
  function onSettings(settings, patch) {
    const tag = settings.tbTagEmails !== false; const bday = !!settings.tbBirthdays;
    const tagChanged = tag !== tagOn; const bdayChanged = bday !== bdayOn;
    tagOn = tag; bdayOn = bday;
    if (patch === null || tagChanged) scheduleTags();
    if ((patch === null && bday) || (bdayChanged && bday)) scheduleBirthdays();
    if (patch && 'language' in patch) setTimeout(titleCompose, 800);
  }

  // 5. text selected in an email: a reminder or list item from the selection, linked to that email
  async function reminderFromSelection(info, tab, kind) {
    const text = String(info.selectionText || '').trim();
    if (!text) return;
    let msg = null;
    try { msg = tab && browser.messageDisplay ? await browser.messageDisplay.getDisplayedMessage(tab.id) : null; } catch (e) { /* not an email */ }
    const first = text.split(/\n/)[0].slice(0, 120);
    const date = msg && msg.date ? (msg.date instanceof Date ? msg.date.getTime() : Number(new Date(msg.date))) : Date.now();
    const p = await host.call('mail:reminder', [{ subject: first, body: text, date, messageId: (msg && msg.headerMessageId) || '' }, kind]);
    await showMain();
    emit('ui:new', p, 'main');
  }
  // an .ics link: read it (asking once for that site) and open the import dialog with it
  async function importLink(info) {
    let url = String(info.linkUrl || '').replace(/^webcals?:/i, 'https:');
    try {
      const origin = new URL(url).origin;
      if (browser.permissions && !(await browser.permissions.contains({ origins: [`${origin}/*`] }))) {
        if (!(await browser.permissions.request({ origins: [`${origin}/*`] }))) return;
      }
      const r = await fetch(url, { credentials: 'omit' });
      if (!r.ok) throw new Error(String(r.status));
      const text = await r.text();
      const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'calendar.ics');
      const tokens = await host.call('upload', [[{ name: /\.(ics|ical)$/i.test(name) ? name : `${name}.ics`, text }]]);
      await showMain();
      emit('ui:importFiles', { tokens }, 'main');
    } catch (e) {
      notify(await t('That calendar could not be read.'), url);
    }
  }

  // 6. replies to invitations: new mail with a calendar reply (METHOD:REPLY) records the answer on the item
  function calendarParts(part, out = []) {
    if (!part) return out;
    if (/^text\/calendar/i.test(part.contentType || '') && part.body) out.push(part.body);
    for (const c of part.parts || []) calendarParts(c, out);
    return out;
  }
  if (browser.messages.onNewMailReceived) {
    browser.messages.onNewMailReceived.addListener(async (folder, list) => {
      await started;
      for (const m of (list && list.messages) || []) {
        try {
          const texts = calendarParts(await browser.messages.getFull(m.id));
          if (!texts.length && browser.messages.listAttachments) {
            for (const a of await browser.messages.listAttachments(m.id)) {
              if (/calendar/i.test(a.contentType || '') || /\.ics$/i.test(a.name || '')) texts.push(await (await browser.messages.getAttachmentFile(m.id, a.partName)).text());
            }
          }
          for (const x of texts) if (/METHOD:REPLY/i.test(x)) await host.call('mail:reply', [x]);
        } catch (e) { console.error('reply', e); }
      }
    });
  }

  // alarms: after the computer wakes or is unlocked, check at once (as the desktop app does after resume/unlock)
  if (browser.idle && browser.idle.onStateChanged) browser.idle.onStateChanged.addListener((s) => { if (s === 'active' && host) setTimeout(() => host.checkAlarms(), 1000); });
  // first install: open the welcome page
  browser.runtime.onInstalled.addListener((d) => { if (d.reason === 'install') started.then(() => showMain()); });
}());
