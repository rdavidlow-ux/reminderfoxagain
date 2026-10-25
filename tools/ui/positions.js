// E2E: starting positions of every filter, restore on return, unchanged after ticking, restored after visiting To-Do's.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const lv = $('listView');
const setFilter = async (f) => { $('remFilter').value = f; $('remFilter').dispatchEvent(new Event('change')); await sleep(500); };
const headH = () => { const th = lv.querySelector('thead th'); return th ? th.getBoundingClientRect().height : 0; };
function expectedTop() {
  const trs = [...lv.querySelectorAll('tbody tr[data-start]')];
  if (!trs.length) return 0;
  const t0 = RF.startOfDay(new Date()).getTime();
  let best = null; let bd = Infinity; let bs = 0;
  for (const tr of trs) {
    const s = RF.startOfDay(Number(tr.dataset.start)).getTime();
    const d = Math.abs(s - t0);
    if (d < bd || (d === bd && s >= t0 && bs < t0)) { best = tr; bd = d; bs = s; }
  }
  const prev = best.previousElementSibling;
  const target = prev && prev.classList.contains('sep') ? prev : best;
  const top = target.getBoundingClientRect().top - lv.getBoundingClientRect().top + lv.scrollTop - headH();
  return Math.round(Math.max(0, Math.min(top, lv.scrollHeight - lv.clientHeight)));
}
const near = (a, b) => Math.abs(a - b) <= 2;
try {
  for (const f of ['upcoming', 'today', 'week', 'day', 'month', 'all', 'important']) {
    await setFilter(f);
    const got = Math.round(lv.scrollTop); const want = expectedTop();
    check(`first visit ${f}`, near(got, want) ? 'closest to today under the header' : `scrollTop ${got} vs ${want}`, 'closest to today under the header');
  }
  await setFilter('past');
  check('first visit past', lv.scrollTop + lv.clientHeight >= lv.scrollHeight - 2 ? 'bottom' : `scrollTop ${lv.scrollTop}`, 'bottom');
  const starts = [...lv.querySelectorAll('tbody tr[data-start]')].map((tr) => Number(tr.dataset.start));
  check('past oldest first', starts.every((s, i) => i === 0 || s >= starts[i - 1]), true);
  const t0p = RF.startOfDay(new Date()).getTime();
  const repeatsPast = (await window.rf.history(t0p)).length;
  check('past rows: 18 one-offs and every past bill', starts.length, 18 + repeatsPast);
  check('past bills listed', repeatsPast >= 16, true);
  await setFilter('all');
  const allStarts = [...lv.querySelectorAll('tbody tr[data-start]')].map((tr) => Number(tr.dataset.start));
  check('all oldest first', allStarts.every((s, i) => i === 0 || s >= allStarts[i - 1]), true);
  lv.scrollTop = 333; await sleep(100);
  const mark = Math.round(lv.scrollTop);
  await setFilter('past');
  await setFilter('all');
  check('restored on return', Math.round(lv.scrollTop), mark);
  const vis = [...lv.querySelectorAll('tbody tr[data-start]')].find((tr) => { const r = tr.getBoundingClientRect(); const c = lv.getBoundingClientRect(); return r.top > c.top + 60 && r.bottom < c.bottom; });
  vis.querySelector('input[data-act=done]').click();
  await sleep(900);
  check('unchanged after ticking', Math.round(lv.scrollTop), mark);
  await window.__rf.setTab('todos'); await sleep(300);
  await window.__rf.setTab('reminders'); await sleep(500);
  check("restored after visiting To-Do's", Math.round(lv.scrollTop), mark);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
