// E2E (the original ReminderFox's repeat choices): Yearly, Yearly by day, Monthly, Monthly by day, Weekly, Biweekly,
// Daily and More repeat options…; each names its day, saves the rule it says and opens on the same choice again.
// Desktop app, Thunderbird add-on and the Android app.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const R = window.__rf;
const set = (id, v, ev = 'change') => { const el = $(id); el.value = v; el.dispatchEvent(new Event(ev, { bubbles: true })); };
const shown = (id) => { const el = $(id); return !!el && el.getClientRects().length > 0; };
const label = (v) => $('edFreq').querySelector(`option[value="${v}"]`).textContent;
const rule = (r) => (r ? [r.freq, r.interval || 1, r.mode || '-', r.mode === 'weekday' ? `${r.nth}${r.wd}` : '-', (r.byday || []).join('+') || '-', r.end || 'never'].join(' ') : 'none');
try {
  const DAY = '2026-11-10'; // a Tuesday, the 2nd of November
  await R.openEditor({ kind: 'event', date: DAY }); await sleep(500);
  const values = [...$('edFreq').options].filter((o) => !o.hidden).map((o) => o.value || 'none').join(',');
  check('the choices of the original ReminderFox', values, 'none,YEARLY,YEARLY_DAY,MONTHLY,MONTHLY_DAY,WEEKLY,BIWEEKLY,DAILY,MORE');
  check('each names its day', [label('YEARLY'), label('YEARLY_DAY'), label('MONTHLY'), label('MONTHLY_DAY'), label('WEEKLY'), label('BIWEEKLY')].join(' | '),
    'Yearly: On November 10 | Yearly by day: On the 2nd Tuesday of November | Monthly: On day 10 | Monthly by day: On the 2nd Tuesday | Weekly: Tuesday | Biweekly: Every 2 weeks on Tuesday');
  set('edFreq', 'BIWEEKLY');
  check('a choice: no extra settings', ['edEveryRow', 'edWeekRow', 'edMonthRow', 'edEndsRow'].filter(shown).join(',') || 'none', 'none');
  check('… and says what it does', $('edRepeatSummary').textContent, '↻ Every 2 weeks on Tuesday');
  $('editor').close(); await sleep(300);

  // each choice saves the rule it names, and the item opens on it again
  const WANT = {
    YEARLY: 'YEARLY 1 date - - never', YEARLY_DAY: 'YEARLY 1 weekday 2TU - never', MONTHLY: 'MONTHLY 1 date - - never',
    MONTHLY_DAY: 'MONTHLY 1 weekday 2TU - never', WEEKLY: 'WEEKLY 1 - - TU never', BIWEEKLY: 'WEEKLY 2 - - TU never', DAILY: 'DAILY 1 - - - never',
  };
  for (const [v, want] of Object.entries(WANT)) {
    await R.openEditor({ kind: 'event', date: DAY }); await sleep(400);
    set('edSummary', `Repeat ${v}`, 'input');
    set('edFreq', v);
    $('edSave').click(); await sleep(700);
    const it = (await window.rf.all()).find((d) => d.summary === `Repeat ${v}`);
    check(`${v}: saved`, it ? rule(it.repeat) : 'missing', want);
    if (it) { await R.openEditor({ uid: it.uid }); await sleep(500); check(`${v}: opens on it again`, $('edFreq').value, v); $('editor').close(); await sleep(300); }
  }

  // a date in the 5th week: "by day" means the last week day of the month
  await R.openEditor({ kind: 'event', date: '2026-11-29' }); await sleep(400); // the 5th Sunday
  check('5th week: the last Sunday', `${label('YEARLY_DAY')} | ${label('MONTHLY_DAY')}`, 'Yearly by day: On the last Sunday of November | Monthly by day: On the last Sunday');
  set('edSummary', 'Repeat last Sunday', 'input'); set('edFreq', 'MONTHLY_DAY'); $('edSave').click(); await sleep(700);
  const last = (await window.rf.all()).find((d) => d.summary === 'Repeat last Sunday');
  check('5th week: saved as the last Sunday', last ? rule(last.repeat) : 'missing', 'MONTHLY 1 weekday -1SU - never');

  // More repeat options… starts from the choice it replaces, and shows every n, the days and the end
  await R.openEditor({ kind: 'event', date: DAY }); await sleep(400);
  set('edFreq', 'BIWEEKLY');
  $('edFreq').dispatchEvent(new Event('focus')); set('edFreq', 'MORE'); await sleep(200);
  check('More repeat options…: from Biweekly', `${$('edUnitSel').value} ${$('edInterval').value} ${[...$('edDays').querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.wd).join('+')}`, 'WEEKLY 2 TU');
  check('… shows every n, the days and the end', ['edEveryRow', 'edWeekRow', 'edEndsRow'].filter(shown).join(','), 'edEveryRow,edWeekRow,edEndsRow');
  check('… the unit says "weeks"', $('edUnitSel').selectedOptions[0].textContent, 'weeks');
  set('edUnitSel', 'MONTHLY'); set('edInterval', '3', 'input'); await sleep(200);
  check('… every 3 months, by date or by week day', `${shown('edMonthRow')} ${$('edRepeatSummary').textContent}`, 'true ↻ Every 3 months on day 10');
  set('edSummary', 'Repeat every 3 months', 'input'); $('edSave').click(); await sleep(700);
  const q = (await window.rf.all()).find((d) => d.summary === 'Repeat every 3 months');
  check('… saved', q ? rule(q.repeat) : 'missing', 'MONTHLY 3 date - - never');
  // a rule only More repeat options… can show opens there (every 3 days; weekly on two days; weekly until a date)
  for (const [name, rep] of [['every 3 days', { freq: 'DAILY', interval: 3, end: 'never' }], ['two days', { freq: 'WEEKLY', interval: 1, byday: ['TU', 'TH'], end: 'never' }],
    ['until', { freq: 'WEEKLY', interval: 1, byday: ['TU'], end: 'until', until: '2027-03-01' }]]) {
    const uid = await window.rf.save({ kind: 'event', summary: `Repeat ${name}`, date: DAY, allDay: true, repeat: rep }); await sleep(300);
    await R.openEditor({ uid }); await sleep(500);
    check(`${name}: opens on More repeat options…`, `${$('edFreq').value} ${shown('edEveryRow')}`, 'MORE true');
    $('editor').close(); await sleep(300);
  }
  for (const d of (await window.rf.all()).filter((x) => /^Repeat /.test(x.summary))) await window.rf.remove(d.uid);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
