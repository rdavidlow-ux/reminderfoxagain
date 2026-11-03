// E2E (the Month tab's Day and Week views, and Show completed keeping the Reminders list where it was);
// desktop app and Thunderbird add-on.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const R = window.__rf;
try {
  const key = (d) => RF.dayKey(d);
  const now = new Date();
  const day = (n) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
  const T0 = key(now);

  // ---- Show completed in the Reminders list: the list stays where it was, and comes back to the same place
  const lv = $('listView');
  const topRow = () => {
    const th = lv.querySelector('thead th'); const h = th ? th.getBoundingClientRect().height : 0; const lt = lv.getBoundingClientRect().top;
    return [...lv.querySelectorAll('tbody tr[data-key]')].find((t) => t.getBoundingClientRect().bottom - lt > h + 2) || null;
  };
  const at = (tr) => (tr && tr.dataset.sort ? Number(tr.dataset.sort) : NaN);
  for (const f of ['all', 'past']) {
    $('remFilter').value = f; $('remFilter').dispatchEvent(new Event('change')); await sleep(800);
    if (!$('remDone').checked) { $('remDone').click(); await sleep(1200); }
    lv.scrollTop = Math.floor(lv.scrollHeight * 0.45); await sleep(400);
    const a = topRow();
    $('remDone').click(); await sleep(1200);
    const b = topRow();
    $('remDone').click(); await sleep(1200);
    const c = topRow();
    // the item that was at the top is still in view (when the shorter list can't scroll that far, lower down)
    const lr = lv.getBoundingClientRect();
    const same = a && lv.querySelector(`tbody tr[data-key="${CSS.escape(a.dataset.key)}"]`);
    const seen = !!same && same.getBoundingClientRect().bottom > lr.top + 30 && same.getBoundingClientRect().top < lr.bottom;
    check(`${f}: Show completed off keeps the same dates in view`, a && a.classList.contains('done') ? Math.abs(at(b) - at(a)) / 864e5 <= 35 : seen, true);
    check(`${f}: … and on again comes back to the same item`, !!(a && c && a.dataset.key === c.dataset.key), true);
  }

  // ---- Day and Week views
  await window.rf.save({ kind: 'event', summary: 'Week test: dentist', date: key(day(1)), allDay: false, time: '14:30', location: 'Main St' });
  await window.rf.save({ kind: 'event', summary: 'Week test: next week', date: key(day(7)), allDay: true });
  await R.setTab('month'); await sleep(800);
  const tab = document.querySelector('.tab[data-tab="month"]');
  const pick = async (m) => { document.querySelector(`#calMode [data-cmode="${m}"]`).click(); await sleep(700); };
  const box = $('calDays');
  const cols = () => [...box.querySelectorAll('.tg-col')].map((c) => c.dataset.day);
  const has = (t) => [...box.querySelectorAll('.ev,.item')].some((e) => e.textContent.includes(t));
  check('the Month view at first', `${tab.textContent} ${$('monthGrid').classList.contains('hidden')} ${box.classList.contains('hidden')}`, 'Month false true');

  await R.selectDay(T0);
  await pick('week');
  const ws = Number(R.S.settings.weekStart) || 0;
  const wk0 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() - ws + 7) % 7));
  check('Week: the tab and the switch', `${tab.textContent} ${document.querySelector('#calMode [aria-pressed="true"]').dataset.cmode}`, 'Week week');
  check('Week: the grid is hidden, seven days shown', `${$('monthGrid').classList.contains('hidden')} ${cols().length}`, 'true 7');
  check('Week: starts on the week start, with today in it', `${cols()[0]} ${cols().includes(T0)}`, `${key(wk0)} true`);
  check('Week: today is marked', box.querySelector('.col.today') ? box.querySelector('.col.today').dataset.day : '', T0);
  check('Week: the title names the week', $('mTitle').textContent, `${RF.fmt.date(wk0)} – ${RF.fmt.date(new Date(wk0.getFullYear(), wk0.getMonth(), wk0.getDate() + 6))}`);
  check('Week: ‹ › say week', `${$('mPrev').title} | ${$('mNext').title}`, 'Previous week | Next week');
  const inWeek = cols().includes(key(day(1)));
  check('Week: tomorrow\'s item is shown when tomorrow is in this week', has('Week test: dentist'), inWeek);
  $('mNext').click(); await sleep(700);
  check('Week: › moves a week', cols()[0], key(new Date(wk0.getFullYear(), wk0.getMonth(), wk0.getDate() + 7)));
  check('Week: the item a week from today is there', has('Week test: next week'), true);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true })); await sleep(700);
  check('Week: Page Up moves back a week', cols()[0], key(wk0));
  // the 24 hours: the grid is 24 hours tall and scrolls, starting near the morning
  const body = box.querySelector('.tg-body');
  const hourPx = box.querySelector('.tg-h').getBoundingClientRect().height;
  check('Week: 24 hours, in a view that scrolls', `${box.querySelectorAll('.tg-h').length} ${Math.round(box.querySelector('.tg-grid').getBoundingClientRect().height / hourPx)} ${body.scrollHeight > body.clientHeight}`, '24 24 true');
  // a click on a day picks it
  const other = box.querySelector(`.dh[data-day]:not(.picked)`);
  const od = other.dataset.day;
  other.click(); await sleep(600);
  check('Week: a click on a day picks it', `${R.S.selDay} ${!!box.querySelector(`.tg-col.picked[data-day="${od}"]`)}`, `${od} true`);
  // double-click at 3 PM in a day: a new reminder on that day at 3:00
  const oc = box.querySelector(`.tg-col[data-day="${od}"]`);
  body.scrollTop = 14 * hourPx; await sleep(300);
  const y = oc.getBoundingClientRect().top + 15 * hourPx + hourPx / 4;
  oc.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientY: y, clientX: oc.getBoundingClientRect().left + 5 })); await sleep(700);
  const ed = $('editor');
  check('Week: a double-click in the hours starts a reminder then', `${!!(ed && ed.open)} ${$('edDate') ? $('edDate').value : od} ${$('edTime') ? $('edTime').value : '15:00'}`, `true ${od} 15:00`);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(400);
  for (const d of document.querySelectorAll('dialog[open]')) d.close();

  await R.selectDay(key(day(1)));
  await pick('day');
  check('Day: the tab and one day', `${tab.textContent} ${cols().join(',')}`, `Day ${key(day(1))}`);
  check('Day: the title is the long date', $('mTitle').textContent, RF.fmt.long(day(1)));
  check('Day: ‹ › say day', `${$('mPrev').title} | ${$('mNext').title}`, 'Previous day | Next day');
  const it = [...box.querySelectorAll('.tev')].find((e) => e.textContent.includes('Week test: dentist'));
  check('Day: the item with its time and place', it ? `${it.querySelector('.tm').textContent} ${it.querySelector('small').textContent.includes('Main St')}` : 'none', `${RF.fmt.time(day(1).getTime() + 14.5 * 36e5)} true`);
  // placed at its start: 2:30 PM is 14.5 hours down; 30 minutes long (no end) = half an hour tall
  const col1 = box.querySelector('.tg-col');
  check('Day: placed at 2:30 PM', it ? Math.round((it.getBoundingClientRect().top - col1.getBoundingClientRect().top) / hourPx * 2) / 2 : 'none', 14.5);
  check('Day: the all-day row holds all-day items', [...box.querySelectorAll('.tg-ac .ev')].every((e) => !e.classList.contains('tev')), true);
  $('mPrev').click(); await sleep(600);
  check('Day: ‹ moves a day', `${cols().join(',')} ${R.S.selDay}`, `${T0} ${T0}`);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })); await sleep(600);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })); await sleep(600);
  check('Day: Page Down twice', cols().join(','), key(day(2)));
  $('mToday').click(); await sleep(600);
  check('Day: Today', cols().join(','), T0);
  await R.goToDate(key(day(40))); await sleep(700);
  check('Day: Go to a date', cols().join(','), key(day(40)));
  check('Day: an empty day has no items', box.querySelectorAll('.tev').length, 0);
  // the item opens in the editor
  await R.goToDate(key(day(1))); await sleep(600);
  [...box.querySelectorAll('.tev')].find((e) => e.textContent.includes('Week test: dentist')).click(); await sleep(700);
  check('Day: a click opens the item', /Week test: dentist/.test(($('eSummary') || $('edSummary') || { value: '' }).value || document.querySelector('dialog[open] input[type=text]')?.value || ''), true);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(400);
  for (const d of document.querySelectorAll('dialog[open]')) d.close();

  // the choice is remembered, and Month comes back on the picked day's month
  check('the view is remembered', localStorage.getItem('calMode'), 'day');
  await pick('month');
  const d40 = day(1);
  check('Month again: the picked day\'s month', `${tab.textContent} ${$('mTitle').textContent}`, `Month ${new Intl.DateTimeFormat(RF.LOCALE, { month: 'long', year: 'numeric' }).format(d40)}`);
  check('Month again: the grid is back', `${$('monthGrid').classList.contains('hidden')} ${box.classList.contains('hidden')} ${$('mPrev').title}`, 'false true Previous month');
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
