// E2E: past occurrences of repeating reminders (ticked or not) show in All reminders and Past, as in the calendar.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const filter = async (f) => { $('remFilter').value = f; $('remFilter').dispatchEvent(new Event('change')); await sleep(600); };
const rowsOf = (title) => [...document.querySelectorAll('#listView tbody tr')].filter((tr) => tr.querySelector('.t') && tr.querySelector('.t').textContent === title);
try {
  const t0 = RF.startOfDay(new Date());
  const y = RF.addDays(t0, -1);
  const first = new Date(y); first.setFullYear(first.getFullYear() - 2);
  const uid = await window.rf.save({ kind: 'event', summary: 'Netflix (auth payment)', date: RF.dayKey(first), allDay: true, time: null,
    repeat: { freq: 'MONTHLY', interval: 1, mode: 'date', end: 'never' }, alarm: null, categories: [] });
  await sleep(600);
  const past = (await window.rf.range(first.getTime(), t0.getTime(), { includeTodos: false })).filter((r) => r.uid === uid);
  check('calendar has yesterday', past.at(-1).date, RF.dayKey(y));
  await filter('all');
  const all = rowsOf('Netflix (auth payment)');
  const yearOn = new Date(t0); yearOn.setMonth(yearOn.getMonth() + 12);
  const future = (await window.rf.range(t0.getTime(), yearOn.getTime(), { includeTodos: false })).filter((r) => r.uid === uid).length;
  check('All: every past occurrence plus 12 months ahead', all.length, past.length + future);
  const yRow = all.find((tr) => Number(tr.dataset.start) === past.at(-1).start);
  check('yesterday listed', !!yRow, true);
  check('yesterday not ticked, shown as past', `${yRow.querySelector('input[data-act=done]').checked} ${yRow.classList.contains('past')}`, 'false true');
  await filter('past');
  const p = rowsOf('Netflix (auth payment)');
  check('Past: every past occurrence', p.length, past.length);
  check('Past keeps one-offs', rowsOf('Car service').length, 1);
  check('Past has nothing upcoming', [...document.querySelectorAll('#listView tbody tr[data-start]')].every((tr) => Number(tr.dataset.start) < t0.getTime()), true);
  // tick yesterday's from the Past list: it stays listed, ticked
  p.at(-1).querySelector('input[data-act=done]').click(); await sleep(900);
  const p2 = rowsOf('Netflix (auth payment)');
  check('ticked and still listed', `${p2.length} ${p2.at(-1).querySelector('input[data-act=done]').checked}`, `${past.length} true`);
  // Settings → Lists: limit to the last 3 months
  await window.__rf.setSetting({ pastRepeatDays: 90 }); await window.__rf.refresh(); await filter('all');
  const recent = past.filter((r) => r.start >= t0.getTime() - 90 * 864e5).length;
  check('limited to 3 months back (and 12 ahead)', rowsOf('Netflix (auth payment)').length, recent + future);
  check('the ticked one is among them', rowsOf('Netflix (auth payment)').filter((tr) => tr.querySelector('input[data-act=done]').checked).length, 1);
  check('setting control', (await window.rf.meta()).settings.pastRepeatDays, 90);
} catch (e) { console.log(`E2E ERROR ${e && e.stack}`); }
