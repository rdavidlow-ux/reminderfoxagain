// E2E: in "All reminders", un-tick one past month of a bill, then tick the upcoming one.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
try {
  $('remFilter').value = 'all';
  $('remFilter').dispatchEvent(new Event('change'));
  await sleep(600);
  const NAME = 'Toronto Hydro';
  const rows = () => [...document.querySelectorAll('#listView tbody tr[data-key]')].filter((tr) => tr.querySelector('.t').textContent === NAME);
  const t0 = RF.startOfDay(new Date()).getTime();
  const pastRows = rows().filter((tr) => Number(tr.dataset.start) < t0);
  check('past months shown', pastRows.length >= 2, true);
  check('past months ticked', pastRows.every((tr) => tr.querySelector('input').checked), true);
  check('completion note shown', /^✓ Completed /.test((pastRows[0].querySelector('.done-at') || {}).textContent || ''), true);
  const target = pastRows[0].dataset.key;
  pastRows[0].querySelector('input[data-act=done]').click();
  await sleep(800);
  const after = rows().filter((tr) => Number(tr.dataset.start) < t0);
  check('rows un-ticked', after.filter((tr) => !tr.querySelector('input').checked).map((tr) => tr.dataset.key === target ? 'that one' : 'another').join(',') || 'none', 'that one');
  check('others still ticked', after.filter((tr) => tr.dataset.key !== target).every((tr) => tr.querySelector('input').checked), true);
  const up = rows().find((tr) => Number(tr.dataset.start) >= t0 && !tr.querySelector('input').checked);
  const uid = up.dataset.uid; const day = RF.dayKey(Number(up.dataset.start));
  up.querySelector('input[data-act=done]').click();
  await sleep(800);
  const at = (await window.rf.get(uid)).doneLog[day];
  check('upcoming ticked with a fresh time', typeof at === 'number' && Math.abs(Date.now() - at) < 60000 ? 'fresh' : String(at), 'fresh');
  const upRow = rows().find((tr) => RF.dayKey(Number(tr.dataset.start)) === day);
  check('upcoming row shows completion', /^✓ Completed /.test((upRow.querySelector('.done-at') || {}).textContent || ''), true);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
