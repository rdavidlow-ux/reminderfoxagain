// E2E (the Android app on a phone, 390×844, and the same checks on a tablet): the Calendar view, the ＋ button,
// cards, full-screen dialogs, the item menu from the bottom, Back, the alarm sheet and the scheduled notifications.
// Run by mobile/test/e2e.sh with mobile/test/run.js.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ANDROID ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const R = window.__rf;
const T = (s) => RF.T(s);
const shown = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
try {
  const phone = window.innerWidth < 720;
  const size = phone ? 'phone' : 'tablet';
  const key = (d) => RF.dayKey(d);

  // what the Android app leaves out
  check(`${size}: no email features`, ['openEmail', 'sendByEmail', 'invite'].filter((k) => window.rf[k]).join(',') || 'none', 'none');
  check(`${size}: the host is Android`, `${document.documentElement.dataset.host} ${(await window.rf.meta()).platform}`, 'android android');

  // a phone: an app bar with the view's name, search and a ⋮ menu, and a navigation bar instead of the tabs
  if (phone) {
    const nav = document.querySelector('.rfa-nav');
    check('phone: the navigation bar', shown(nav) ? [...nav.querySelectorAll('[data-nav]')].map((b) => b.dataset.nav).join(',') : 'hidden', 'reminders,todos,month,calendar');
    check('phone: no tabs, no status bar, no desktop header buttons', ['.tabs', '.status', '#quickBtn', '#settingsBtn', '.brand'].filter((q) => shown(document.querySelector(q))).join(',') || 'none', 'none');
    check('phone: the title', $('rfaTitle').textContent, T('Reminders'));
    nav.querySelector('[data-nav="calendar"]').click(); await sleep(600);
    check('phone: the bar opens the Calendar', `${R.S.tab} ${$('rfaTitle').textContent} ${nav.querySelector('[aria-selected="true"]').dataset.nav}`, `calendar ${T('Calendar')} calendar`);
    nav.querySelector('[data-nav="todos"]').click(); await sleep(600);
    check('phone: the lists: the list picker is the title', `${R.S.tab} ${!!$('rfaTitle').querySelector('#todoList')}`, 'todos true');
    nav.querySelector('[data-nav="month"]').click(); await sleep(600);
    check('phone: Month, Week or Day: its name', $('rfaTitle').textContent, document.querySelector('.tab[data-tab="month"]').textContent);
    nav.querySelector('[data-nav="reminders"]').click(); await sleep(600);
    check('phone: back to Reminders, the list picker back in its tab', `${R.S.tab} ${!!document.querySelector('.tab-list #todoList')}`, 'reminders true');
    // search: the icon opens the field, ✕ closes and clears it
    document.querySelector('[data-ab="search"]').click(); await sleep(300);
    check('phone: search opens', `${shown($('search'))} ${document.activeElement === $('search')}`, 'true true');
    $('search').value = 'stand-up'; $('search').dispatchEvent(new Event('input', { bubbles: true })); await sleep(900);
    const found = [...document.querySelectorAll('#listView tbody tr[data-key] .t')].map((t) => t.textContent);
    check('phone: search finds', found.length > 0 && found.every((t) => /stand-up/i.test(t)), true);
    document.querySelector('[data-ab="close"]').click(); await sleep(900);
    check('phone: ✕ closes and clears it', `${shown($('search'))} ${$('search').value === ''}`, 'false true');
    // the ⋮ menu: what the header and the status bar had
    document.querySelector('[data-ab="more"]').click(); await sleep(300);
    const items = [...document.querySelectorAll('.rfa-more [data-more]')].map((b) => b.dataset.more).join(',');
    check('phone: the ⋮ menu', items, 'quickBtn,alarmList,alarmState,openFolder,settingsBtn');
    document.querySelector('.rfa-more [data-more="settingsBtn"]').click(); await sleep(600);
    check('phone: ⋮ → Settings', !!document.querySelector('dialog[open]'), true);
    window.RFA_BACK(); await sleep(400);
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
  }

  // the alarm sheet: the sample has alarms due, so it is open; Back puts it away
  const sheet = () => document.querySelector('.rfa-sheet.rfa-alarm');
  check(`${size}: the alarm sheet shows what is due`, !!sheet() && sheet().classList.contains('open') && !!sheet().querySelector('iframe[src="alarm.html"]'), true);
  window.RFA_BACK(); await sleep(500);
  check(`${size}: Back puts the alarm sheet away`, window.RFHOST.sheetOpen('alarm'), false);

  // the Calendar view
  const tabs = [...document.querySelectorAll('.tabs .tab')].map((t) => t.dataset.tab).join(',');
  check(`${size}: the tabs`, tabs, 'reminders,todos,month,calendar');
  check(`${size}: no calendar panel beside the list`, shown(document.querySelector('aside.side')), false);
  check(`${size}: no panel button`, shown($('sideToggle')), false);
  document.querySelector('.tab[data-tab="calendar"]').click(); await sleep(700);
  check(`${size}: Calendar: the mini calendar and the agenda`, `${shown($('mcal'))} ${shown($('agenda'))}`, 'true true');
  check(`${size}: Calendar: no list, no month grid, no toolbars`, ['listView', 'monthView', 'tbReminders', 'tbTodos', 'tbMonth'].filter((id) => shown($(id))).join(',') || 'none', 'none');
  check(`${size}: Calendar: the tab is selected`, document.querySelector('.tab[data-tab="calendar"]').getAttribute('aria-selected'), 'true');
  const side = document.querySelector('aside.side').getBoundingClientRect();
  check(`${size}: Calendar: the panel uses the width`, side.width > window.innerWidth * 0.9, true);
  const head = () => $('agenda').querySelector('h3 span').textContent;
  const today = new Date();
  check(`${size}: Calendar: today's agenda`, head().startsWith(T('Today')), true);
  const item = [...$('agenda').querySelectorAll('.item')].find((i) => /Thanksgiving/.test(i.textContent));
  check(`${size}: Calendar: today's items are listed`, !!item, true);
  // a day picked in the mini calendar: its agenda
  const other = new Date(today.getFullYear(), today.getMonth(), today.getDate() === 15 ? 16 : 15);
  const cell = $('mcal').querySelector(`[data-day="${key(other)}"]`);
  cell.click(); await sleep(600);
  check(`${size}: Calendar: a day picked in the mini calendar`, `${R.S.selDay} ${head()}`, `${key(other)} ${RF.fmt.long(other)}`);
  $('mcal').querySelector('[data-cal="today"]').click(); await sleep(600);
  check(`${size}: Calendar: Today`, R.S.selDay, key(today));
  // an item opens in the editor; Back closes it, then Back goes to Reminders
  [...$('agenda').querySelectorAll('.item')].find((i) => /Thanksgiving/.test(i.textContent)).click(); await sleep(700);
  check(`${size}: Calendar: an item opens`, $('editor').open && $('edSummary').value, "Thanksgiving dinner at Mom's");
  window.RFA_BACK(); await sleep(500);
  check(`${size}: Back closes the editor`, $('editor').open, false);
  window.RFA_BACK(); await sleep(600);
  check(`${size}: Back goes to Reminders`, R.S.tab, 'reminders');
  // the view keeps working with the other tabs
  await R.setTab('month'); await sleep(500);
  document.querySelector('.tab[data-tab="calendar"]').click(); await sleep(500);
  check(`${size}: Calendar again after Month`, `${shown($('mcal'))} ${shown($('monthView'))}`, 'true false');
  await R.setTab('reminders'); await sleep(600);

  // the ＋ button
  const fab = document.querySelector('.rfa-fab-btn');
  check(`${size}: the ＋ button instead of ＋ Reminder and ＋ List Item`, `${shown(fab)} ${shown($('addReminder'))} ${shown($('addTodo'))}`, 'true false false');
  fab.click(); await sleep(300);
  const menu = [...document.querySelectorAll('.rfa-fab-menu [data-fab]')].filter(shown).map((b) => b.textContent.replace(/\s+/g, ' ').trim()).join(' | ');
  check(`${size}: its menu`, menu, `＋ ${T('Reminder')} | ＋ ${T('List Item')}`);
  document.querySelector('.rfa-fab-menu [data-fab="addReminder"]').click(); await sleep(700);
  check(`${size}: ＋ Reminder opens a new reminder`, $('editor').open && $('edSummary').value === '', true);
  check(`${size}: the ＋ button hides behind a dialog`, shown(fab), false);
  const ed = $('editor').getBoundingClientRect();
  check(`${size}: the editor ${phone ? 'fills the screen' : 'is a window'}`, phone ? Math.round(ed.width) === window.innerWidth && Math.round(ed.height) >= window.innerHeight - 2 : ed.width < window.innerWidth, true);
  $('edCancel').click(); await sleep(400);

  // the list: cards on a phone, the table on a tablet
  const row = document.querySelector('#listView tbody tr[data-key]');
  check(`${size}: list rows`, getComputedStyle(row).display, phone ? 'grid' : 'table-row');
  check(`${size}: the column headings`, shown(document.querySelector('#listView thead')), !phone);
  check(`${size}: nothing wider than the screen`, document.documentElement.scrollWidth <= window.innerWidth, true);
  // an item's menu (a long press): from the bottom on a phone
  row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 200 })); await sleep(500);
  const ctx = document.querySelector('.ctx:not(.hidden)');
  check(`${size}: the item's menu opens`, !!ctx, true);
  if (ctx && phone) check(`${size}: from the bottom, full width`, `${Math.round(ctx.getBoundingClientRect().bottom) === window.innerHeight} ${Math.round(ctx.getBoundingClientRect().width) === window.innerWidth}`, 'true true');
  window.RFA_BACK(); await sleep(300);
  check(`${size}: Back closes the menu`, !!document.querySelector('.ctx:not(.hidden)'), false);
  // a tap opens the row on a phone (a double-click on a tablet, as on the desktop)
  if (phone) {
    row.querySelector('.c-desc').click(); await sleep(700);
    check(`${size}: a tap opens the item`, $('editor').open, true);
    $('edCancel').click(); await sleep(400);
  }

  // Settings: what doesn't apply here is hidden
  $('settingsBtn').click(); await sleep(600);
  check(`${size}: desktop-only settings hidden`, ['stStart', 'stTray', 'stFolder', 'stBackups', 'stPath'].filter((id) => shown($(id))).join(',') || 'none', 'none');
  check(`${size}: where the data is`, document.getElementById('rfaPath').textContent, T('Your reminders are kept on this device, with a backup every day.'));
  window.RFA_BACK(); await sleep(400);

  // alarms as scheduled notifications: every alarm of the next 14 days, with Snooze, Done and Open
  await window.RFHOST.schedule(); await sleep(300);
  const sch = window.RFA_SCHEDULED || [];
  const now = Date.now();
  check(`${size}: alarms scheduled as notifications`, sch.length > 5, true);
  check(`${size}: all ahead, within 14 days, with actions`, sch.every((n) => +n.schedule.at > now && +n.schedule.at < now + 15 * 864e5 && n.actionTypeId === 'alarm' && n.extra.key && n.schedule.allowWhileIdle), true);
  check(`${size}: ids are unique`, new Set(sch.map((n) => n.id)).size, sch.length);
  await window.rf.quickAdd({ text: 'Android quick alarm', at: now + 5 * 60000 }); await sleep(1500);
  await window.RFHOST.schedule();
  const q = (window.RFA_SCHEDULED || []).find((n) => n.title === 'Android quick alarm');
  check(`${size}: a new quick alarm is scheduled`, !!q && Math.abs(+q.schedule.at - (now + 5 * 60000)) < 2000, true);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
