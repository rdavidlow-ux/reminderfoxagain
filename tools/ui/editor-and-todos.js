// E2E: build a weekly reminder in the editor, tick to-dos, check the due alarm, snooze it, search.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const set = (id, v, ev = 'input') => { const el = $(id); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event(ev, { bubbles: true })); };
try {
  await window.__rf.openEditor({ kind: 'event' });
  await sleep(200);
  set('edSummary', 'Piano lesson');
  set('edAllDay', false, 'change');
  set('edTime', '16:15');
  set('edEndTime', '17:00');
  set('edFreq', 'WEEKLY', 'change');
  for (const b of document.querySelectorAll('#edDays button[aria-pressed="true"]')) b.click();
  document.querySelector('#edDays button[data-wd="TU"]').click();
  document.querySelector('#edDays button[data-wd="TH"]').click();
  set('edEnds', 'count', 'change');
  set('edCount', '8');
  set('edAlarm', '30', 'change');
  check('editor summary', $('edRepeatSummary').textContent, '↻ Every week on Tuesday, Thursday, 8 times');
  $('edSave').click();
  await sleep(700);
  const piano = (await window.rf.all()).find((d) => d.summary === 'Piano lesson');
  check('saved repeat', piano && piano.repeatText, 'Weekly on Tue, Thu, 8 times');
  check('saved alarm', piano && piano.alarm && piano.alarm.minutes, 30);

  await window.__rf.setTab('todos');
  await sleep(400);
  const rowOf = (title) => [...document.querySelectorAll('#listView tbody tr')].find((tr) => tr.querySelector('.t').textContent === title);
  rowOf('Back up photos').querySelector('input[data-act=done]').click();
  await sleep(700);
  const bp = (await window.rf.all()).find((d) => d.summary === 'Back up photos');
  check('to-do ticked', bp.completed, true);
  const before = (await window.rf.all()).find((d) => d.summary === 'Water the plants').date;
  rowOf('Water the plants').querySelector('input[data-act=done]').click();
  await sleep(700);
  const after = (await window.rf.all()).find((d) => d.summary === 'Water the plants');
  check('repeating to-do moved (days)', Math.round((RF.parseKey(after.date) - RF.parseKey(before)) / 86400000), 3);
  check('repeating to-do still open', after.completed, false);
  check('toast', document.querySelector('.toast').textContent, 'Done — moved to the next date');

  const st = await window.rf.alarmState();
  // "Call the pharmacy" is always due; after 15:30 the sample's 17:30 dinner (2-hour alarm) is due too
  check('due alarm', st.alarms.some((a) => a.summary === 'Call the pharmacy'), true);
  let all = true;
  for (const a of st.alarms) all = (await window.rf.snooze(a.key, 1800)) && all;
  check('snooze accepted', all, true);
  check('alarms due after snooze', (await window.rf.alarmState()).alarms.length, 0);

  await window.__rf.setTab('reminders');
  set('search', 'pharmacy');
  await sleep(600);
  check('search rows', document.querySelectorAll('#listView tbody tr[data-key]').length, 1);
  check('search hint', $('remHint').textContent, 'Searching all reminders · 1 reminder');
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
