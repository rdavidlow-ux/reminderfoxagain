// E2E (scrollable Month view): weeks run on above and below the month in focus; desktop app and Thunderbird add-on.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const R = window.__rf;
try {
  const key = (d) => RF.dayKey(d);
  const now = new Date();
  const monthStart = (d, n = 0) => new Date(d.getFullYear(), d.getMonth() + n, 1);
  const title = (d) => new Intl.DateTimeFormat(RF.LOCALE, { month: 'long', year: 'numeric' }).format(d);
  // an item 45 days ago and one 70 days ahead
  const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 45);
  const ahead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 70);
  await window.rf.save({ kind: 'event', summary: 'Scroll test: long ago', date: key(past), allDay: true });
  await window.rf.save({ kind: 'event', summary: 'Scroll test: far ahead', date: key(ahead), allDay: true });
  await R.setTab('month'); await sleep(900);
  const g = $('monthGrid');
  const step = () => g.firstElementChild.getBoundingClientRect().height + 1;
  const topDay = () => { const r = g.getBoundingClientRect(); const el = document.elementFromPoint(r.left + 20, r.top + 8); const c = el && el.closest('.cell'); return c ? c.dataset.day : null; };
  const has = (t) => [...g.querySelectorAll('.ev')].some((e) => e.textContent.includes(t));
  check('the Month view scrolls', g.scrollHeight > g.clientHeight * 2, true);
  check('the title is this month', $('mTitle').textContent, title(now));
  check('about six weeks fill the view', Math.round(g.clientHeight / step()), 6);
  const wk = [...g.children].slice(0, 7).map((c) => c.dataset.day);
  check('the top week holds the 1st', (() => { const r = g.getBoundingClientRect(); const row = [...g.children].filter((c) => Math.abs(c.getBoundingClientRect().top - r.top) < step() / 2).map((c) => c.dataset.day); return row.includes(key(monthStart(now))); })(), true);
  check('weeks before this month are there to scroll to', wk[0] < key(monthStart(now)), true);
  check('the 1st of a month shows its name', g.querySelector(`.cell[data-day="${key(monthStart(now, 1))}"] .num`).textContent, `${new Intl.DateTimeFormat(RF.LOCALE, { month: 'short' }).format(monthStart(now, 1)).replace(/\.$/, '')} 1`);
  check('other months are dimmed', `${g.querySelector(`.cell[data-day="${key(monthStart(now, 1))}"]`).classList.contains('out')} ${g.querySelector(`.cell[data-day="${key(now)}"]`).classList.contains('out')}`, 'true false');
  check('past and coming items are in it', `${has('Scroll test: long ago')} ${has('Scroll test: far ahead')}`, 'true true');
  // scroll down five weeks: the next month is in focus
  g.scrollTop += step() * 5; await sleep(700);
  check('scrolling down: next month in the title', $('mTitle').textContent, title(monthStart(now, 1)));
  check('… and no longer dimmed', g.querySelector(`.cell[data-day="${key(monthStart(now, 1))}"]`).classList.contains('out'), false);
  // to the bottom: more weeks load
  const n0 = g.children.length;
  for (let i = 0; i < 4; i++) { g.scrollTop = g.scrollHeight; await sleep(700); }
  check('near the end, more weeks load', g.children.length > n0, true);
  // to the top: more weeks load above, and what was at the top stays put
  g.scrollTop = g.scrollHeight / 2; await sleep(500);
  for (let i = 0; i < 12 && g.children[0].dataset.day >= wk[0]; i++) { g.scrollTop = 0; await sleep(700); }
  check('near the start, earlier weeks load', g.children[0].dataset.day < wk[0], true);
  check('… without jumping to the top', g.scrollTop > step() * 3, true);
  // ‹ › Today and Page Up / Page Down move a month, with that month's 1st in the top week
  $('mToday').click(); await sleep(1300);
  check('Today: back to this month', $('mTitle').textContent, title(now));
  check('… with today in view', (() => { const c = g.querySelector('.cell.today').getBoundingClientRect(); const r = g.getBoundingClientRect(); return c.top >= r.top - 1 && c.bottom <= r.bottom + 1; })(), true);
  $('mNext').click(); await sleep(1300);
  check('› next month', $('mTitle').textContent, title(monthStart(now, 1)));
  const td = topDay();
  check('… its 1st in the top week', td <= key(monthStart(now, 1)) && key(monthStart(now, 1)) <= key(new Date(new Date(td.replace(/-/g, '/')).getTime() + 6 * 864e5)), true);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })); await sleep(1300);
  check('Page Down: the month after', $('mTitle').textContent, title(monthStart(now, 2)));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true })); await sleep(1300);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true })); await sleep(1300);
  $('mPrev').click(); await sleep(1300);
  check('Page Up twice and ‹: the month before this one', $('mTitle').textContent, title(monthStart(now, -1)));
  // a change to the data keeps the view where it is
  const before = g.scrollTop;
  await window.rf.save({ kind: 'event', summary: 'Scroll test: added', date: key(now), allDay: true }); await R.refresh(); await sleep(800);
  check('a change keeps the place', Math.abs(g.scrollTop - before) < 2, true);
  // Go to a date far away
  await R.goToDate(key(new Date(now.getFullYear() + 2, 2, 15))); await sleep(1300);
  check('Go to: the month far away', $('mTitle').textContent, title(new Date(now.getFullYear() + 2, 2, 1)));
  check('… with that day picked', !!g.querySelector(`.cell.picked[data-day="${key(new Date(now.getFullYear() + 2, 2, 15))}"]`), true);
  // clicking a day still picks it; a chip still opens it
  $('mToday').click(); await sleep(1300);
  const chip = [...g.querySelectorAll('.ev')].find((e) => e.textContent.includes('Scroll test: added'));
  chip.click(); await sleep(600);
  check('a chip opens the editor', $('edSummary').value, 'Scroll test: added');
  $('edCancel').click(); await sleep(300);
  for (const it of await window.rf.all()) if (/^Scroll test:/.test(it.summary)) await window.rf.remove(it.uid);
  await R.setTab('reminders'); await sleep(300);
} catch (e) { console.log(`E2E ERROR ${e.message}`); }
