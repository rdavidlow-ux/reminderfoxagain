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
