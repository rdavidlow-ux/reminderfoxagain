'use strict';
/* global RFCap */
// ReminderFoxAgain for Android: the main page on a phone or tablet (loaded after features.js, with android.css).
// - The calendar panel (mini months and the picked day's agenda) is a view of its own, the Calendar tab, beside
//   Reminders, the lists and Month/Week/Day; there is no panel beside the list.
// - "＋ Reminder" and "＋ List Item" become one round ＋ button with a small menu.
// - Touch: a long press opens an item's menu (as a sheet from the bottom); a tap on a row opens it on a phone.
// - The Back button closes what is open (a menu, a dialog, the alarm sheet), then goes back to Reminders.
// - Settings that don't apply on a phone are hidden; importing from the ReminderFox add-on says how to get its file.
(function () {
  const $ = (id) => document.getElementById(id);
  const A = () => window.__rf || {};
  const T = (s) => (window.RF && window.RF.T ? window.RF.T(s) : s);
  const phone = () => window.matchMedia('(max-width: 719px)').matches;

  // ---------------------------------------------------------------- the Calendar view
  const monthTab = document.querySelector('.tab[data-tab="month"]');
  if (monthTab && !document.querySelector('.tab[data-tab="calendar"]')) {
    const b = document.createElement('button');
    b.className = 'tab';
    b.setAttribute('role', 'tab');
    b.dataset.tab = 'calendar';
    b.setAttribute('aria-selected', 'false');
    b.textContent = 'Calendar'; // translated by i18n-dom.js
    monthTab.after(b);
  }
  document.body.dataset.tab = 'reminders';

  // ---------------------------------------------------------------- the phone's app bar, ⋮ menu and navigation bar
  // (shown by android.css below 720 px; on a tablet the desktop's header, tabs and status bar stay)
  const ICON = {
    search: '<path d="M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.06-1.06-4.43-4.43A6.5 6.5 0 0 0 10.5 4Zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"/>',
    close: '<path d="m6.4 5.3 5.6 5.6 5.6-5.6 1.1 1.1-5.6 5.6 5.6 5.6-1.1 1.1-5.6-5.6-5.6 5.6-1.1-1.1 5.6-5.6-5.6-5.6z"/>',
    more: '<circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>',
    reminders: '<path d="M12 3a6 6 0 0 0-6 6v3.6L4.3 15.4A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.6L18 12.6V9a6 6 0 0 0-6-6Zm0 1.5A4.5 4.5 0 0 1 16.5 9v4l1.3 2.5H6.2L7.5 13V9A4.5 4.5 0 0 1 12 4.5ZM9.8 18.5a2.3 2.3 0 0 0 4.4 0Z"/>',
    todos: '<path d="M4 6.2 5.1 5l1.6 1.6L9.6 3.7l1.1 1.1-4 4Zm8 .3h8V8h-8Zm-8 5.7L5.1 11l1.6 1.6 2.9-2.9 1.1 1.1-4 4Zm8 .3h8V14h-8Zm-7.5 4h4v4h-4Zm1.5 1.5v1h1v-1Zm6-1h8V20h-8Z"/>',
    month: '<path d="M7 2.5h1.5V4h7V2.5H17V4h1.5A2.5 2.5 0 0 1 21 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-12A2.5 2.5 0 0 1 5.5 4H7Zm-1.5 3A1 1 0 0 0 4.5 6.5V9h15V6.5a1 1 0 0 0-1-1Zm-1 5v8a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-8ZM7 12h2v2H7Zm4 0h2v2h-2Zm4 0h2v2h-2Zm-8 3.5h2v2H7Zm4 0h2v2h-2Z"/>',
    calendar: '<path d="M7 2.5h1.5V4h7V2.5H17V4h1.5A2.5 2.5 0 0 1 21 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-12A2.5 2.5 0 0 1 5.5 4H7Zm-1.5 3A1 1 0 0 0 4.5 6.5V9h15V6.5a1 1 0 0 0-1-1Zm-1 5v8a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-8ZM8 12.5h8V14H8Zm0 3h5V17H8Z"/>',
  };
  const svg = (n) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICON[n]}</svg>`;
  const top = document.querySelector('.top');
  const bar = document.createElement('div');
  bar.className = 'rfa-appbar';
  window.RF.setHTML(bar, '<div class="rfa-title" id="rfaTitle"></div>' +
    `<button type="button" class="rfa-icon" data-ab="search" title="Search" aria-label="Search">${svg('search')}</button>` +
    `<button type="button" class="rfa-icon" data-ab="close" title="Close" aria-label="Close">${svg('close')}</button>` +
    `<button type="button" class="rfa-icon" data-ab="more" title="More" aria-label="More">${svg('more')}</button>`);
  top.prepend(bar);
  // the search field sits in the app bar on a phone, and where the desktop has it on a tablet
  const search = top.querySelector('.search');
  const searchHome = search ? search.parentElement : null;
  const searchNext = search ? search.nextElementSibling : null;
  function placeSearch() {
    if (!search) return;
    if (phone()) { if (search.parentElement !== bar) bar.querySelector('[data-ab="close"]').before(search); }
    else if (search.parentElement !== searchHome) { searchHome.insertBefore(search, searchNext); top.classList.remove('rfa-searching'); }
  }
  const more = document.createElement('div');
  more.className = 'rfa-more';
  more.hidden = true;
  more.setAttribute('role', 'menu');
  document.body.appendChild(more);
  const closeMore = () => { more.hidden = true; };
  // the ⋮ menu: what the desktop has in its header and status bar, with the same words
  const MORE = [['quickBtn', 'Quick alarm'], ['alarmList', 'Alarms'], ['alarmState', null], ['openFolder', null], ['settingsBtn', 'Settings']];
  function openMore() {
    window.RF.setHTML(more, MORE.map(([id, w]) => { const el = $(id); if (!el) return ''; const text = w ? T(w) : el.textContent.replace(/^[^\p{L}\p{N}]+/u, '').trim(); return `<button type="button" role="menuitem" data-more="${id}">${window.RF.esc(text)}</button>`; }).join(''));
    more.hidden = false;
  }
  more.addEventListener('click', (e) => { const b = e.target.closest('[data-more]'); if (!b) return; closeMore(); $(b.dataset.more).click(); });
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ab]');
    if (!b) return;
    if (b.dataset.ab === 'more') { if (more.hidden) openMore(); else closeMore(); return; }
    if (b.dataset.ab === 'search') { top.classList.add('rfa-searching'); $('search').focus(); return; }
    if (b.dataset.ab === 'close') {
      top.classList.remove('rfa-searching');
      if ($('search').value) { $('search').value = ''; $('search').dispatchEvent(new Event('input', { bubbles: true })); }
    }
  });
  document.addEventListener('click', (e) => { if (!more.hidden && !more.contains(e.target) && !e.target.closest('[data-ab="more"]')) closeMore(); }, true);

  // the navigation bar: Reminders, the lists, Month (or Day or Week) and the Calendar
  const nav = document.createElement('nav');
  nav.className = 'rfa-nav';
  nav.setAttribute('aria-label', 'Views');
  const NAV = [['reminders', 'Reminders'], ['todos', 'Lists'], ['month', null], ['calendar', 'Calendar']];
  window.RF.setHTML(nav, NAV.map(([t, w]) => `<button type="button" data-nav="${t}" aria-selected="false"><span class="pill">${svg(t)}</span><span class="l"${w ? '' : ' translate="no"'}>${w ? window.RF.esc(w) : ''}</span></button>`).join(''));
  document.body.appendChild(nav);
  nav.addEventListener('click', (e) => { const b = e.target.closest('[data-nav]'); if (b) A().setTab(b.dataset.nav); });

  // the title: the view's name; for the lists, the list picker itself
  const listSel = $('todoList');
  const listHome = listSel ? listSel.parentElement : null;
  function chrome() {
    placeSearch();
    const tab = document.body.dataset.tab || 'reminders';
    const monthName = monthTab ? monthTab.textContent.trim() : 'Month';
    nav.querySelector('[data-nav="month"] .l').textContent = monthName;
    for (const b of nav.querySelectorAll('[data-nav]')) b.setAttribute('aria-selected', String(b.dataset.nav === tab));
    const title = $('rfaTitle');
    if (phone() && tab === 'todos' && listSel) { if (listSel.parentElement !== title) { title.textContent = ''; title.appendChild(listSel); } return; }
    if (listSel && listSel.parentElement !== listHome) listHome.appendChild(listSel);
    const names = { reminders: T('Reminders'), month: monthName, calendar: T('Calendar') };
    title.textContent = names[tab] || '';
  }
  new MutationObserver(chrome).observe(document.body, { attributes: true, attributeFilter: ['data-tab'] });
  if (monthTab) new MutationObserver(chrome).observe(monthTab, { childList: true, characterData: true, subtree: true });
  window.matchMedia('(max-width: 719px)').addEventListener('change', chrome);
  setTimeout(chrome, 0);

  // ---------------------------------------------------------------- the ＋ button
  const fab = document.createElement('div');
  fab.className = 'rfa-fab';
  window.RF.setHTML(fab, '<div class="rfa-fab-menu" hidden>' +
    '<button type="button" class="btn" data-fab="addReminder"><span class="k">＋</span> Reminder</button>' +
    '<button type="button" class="btn" data-fab="addTodo"><span class="k">＋</span> List Item</button></div>' +
    '<button type="button" class="rfa-fab-btn" aria-label="New" title="New">＋</button>');
  document.body.appendChild(fab);
  const fabMenu = fab.querySelector('.rfa-fab-menu');
  const closeFab = () => { fabMenu.hidden = true; fab.classList.remove('open'); };
  fab.querySelector('.rfa-fab-btn').addEventListener('click', () => { fabMenu.hidden = !fabMenu.hidden; fab.classList.toggle('open', !fabMenu.hidden); });
  fabMenu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fab]');
    if (!b) return;
    closeFab();
    $(b.dataset.fab).click();
  });
  document.addEventListener('click', (e) => { if (!fab.contains(e.target)) closeFab(); });

  // ---------------------------------------------------------------- touch: long press = the item's menu
  let pressTimer = null; let pressAt = null;
  const LONG = 500;
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    const row = e.target.closest('#listView tbody tr[data-key], .ev, .agenda .item');
    if (!row || e.touches.length > 1) return;
    pressAt = { x: t.clientX, y: t.clientY, row };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      if (!pressAt) return;
      pressAt.fired = true;
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: pressAt.x, clientY: pressAt.y }));
    }, LONG);
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!pressAt) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - pressAt.x) > 10 || Math.abs(t.clientY - pressAt.y) > 10) { clearTimeout(pressTimer); pressAt = null; }
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    clearTimeout(pressTimer);
    if (pressAt && pressAt.fired) e.preventDefault(); // no click after the menu opened
    pressAt = null;
  });
  // on a phone a tap on a row opens it (the desktop opens it with a double-click); the tick box and star still tick
  const list = $('listView');
  list.addEventListener('click', (e) => {
    if (!phone()) return;
    const tr = e.target.closest('tbody tr[data-key]');
    if (!tr || e.target.closest('input, button, a, select, .c-imp')) return;
    tr.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY }));
  });

  // ---------------------------------------------------------------- Back
  function back() {
    const ctx = document.querySelector('.ctx:not(.hidden)');
    if (ctx) { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); document.body.click(); ctx.classList.add('hidden'); return true; }
    if (!fabMenu.hidden) { closeFab(); return true; }
    if (!more.hidden) { closeMore(); return true; }
    if (top.classList.contains('rfa-searching')) { bar.querySelector('[data-ab="close"]').click(); return true; }
    const open = [...document.querySelectorAll('dialog[open]')];
    if (open.length) {
      const d = open[open.length - 1];
      const ev = new Event('cancel', { cancelable: true });
      d.dispatchEvent(ev);
      if (!ev.defaultPrevented && d.open) d.close();
      return true;
    }
    const H = window.RFHOST;
    if (H && H.sheetOpen('alarm')) { H.hideSheet('alarm'); return true; }
    if (H && H.sheetOpen('slider')) { H.closeSheet('slider', true); return true; }
    if (A().S && A().S.tab !== 'reminders') { A().setTab('reminders'); return true; }
    return false;
  }
  window.RFA_BACK = back; // for the UI checks
  if (window.RFCap && RFCap.Capacitor.isNativePlatform()) {
    RFCap.App.addListener('backButton', () => { if (!back()) RFCap.App.minimizeApp().catch(() => {}); });
  }

  // ---------------------------------------------------------------- settings and import
  const path = $('stPath');
  if (path && !$('rfaPath')) {
    const note = document.createElement('div');
    note.className = 'note';
    note.id = 'rfaPath';
    note.textContent = 'Your reminders are kept on this device, with a backup every day.';
    path.after(note);
  }
  const whereIsIt = () => A().confirmDlg('Import from ReminderFox',
    '<div>Copy reminderfox.ics from your computer\'s Firefox or Thunderbird profile (its reminderfox folder) to this device, then choose it here.</div>' +
    '<div class="note">Pick the profile folder\'s prefs.js with it to bring your list names too.</div>',
    [{ label: 'Cancel', value: null }, { label: 'Choose the file…', cls: 'primary', value: 'pick' }]);
  const oldRf = $('stOldRf');
  if (oldRf) {
    let go = false;
    oldRf.addEventListener('click', async (e) => {
      if (go) { go = false; return; }
      e.stopImmediatePropagation();
      if ((await whereIsIt()) !== 'pick') return;
      go = true;
      oldRf.click();
    }, true);
  }
  // the welcome page of a new installation: its own option for the ReminderFox add-on's file
  const addOld = () => {
    const pick = list.querySelector('.welcome .opt[data-w="pick"]:not(.rfa-old)');
    if (!pick || list.querySelector('.welcome .rfa-old')) return;
    const opt = pick.cloneNode(false);
    opt.classList.add('rfa-old');
    window.RF.setHTML(opt, '<span style="font-size:22px">🦊</span><div><b>Import from your ReminderFox add-on</b><small>Pick the reminderfox.ics the ReminderFox add-on kept in your Firefox or Thunderbird profile</small></div>');
    pick.before(opt);
  };
  new MutationObserver(addOld).observe(list, { childList: true, subtree: true });
  addOld();
  let goOld = false;
  list.addEventListener('click', async (e) => {
    const opt = e.target.closest('.welcome .rfa-old');
    if (!opt) return;
    if (goOld) { goOld = false; return; }
    e.stopImmediatePropagation();
    if ((await whereIsIt()) !== 'pick') return;
    goOld = true;
    opt.click();
  }, true);
  void T;
}());
