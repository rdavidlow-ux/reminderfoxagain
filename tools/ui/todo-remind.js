// E2E (0.4.0): a to-do's date is "due by"; its reminders are a plan (start, time, how often); a to-do can be
// scheduled as a reminder once the exact date is known.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const set = (id, v) => { const el = $(id); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
const R = window.__rf;
const rowOf = (title) => [...document.querySelectorAll('#listView tbody tr')].find((tr) => tr.querySelector('.t') && tr.querySelector('.t').textContent === title);
const find = async (title) => (await window.rf.all()).find((d) => d.summary === title);
try {
  const t0 = RF.startOfDay(new Date());
  const dueKey = RF.dayKey(RF.addDays(t0, 10));
  await R.setTab('todos'); await sleep(400);
  // the editor for a to-do
  await R.openEditor({ kind: 'todo' }); await sleep(300);
  check('date is "Due by"', $('edDateLbl').textContent, 'Due by');
  check('no-time box reads "Any time"', $('edAllDayTxt').textContent, 'Any time');
  check('remind box instead of the alarm row', `${$('edRemindBox').classList.contains('hidden')} ${$('edAlarmRow').classList.contains('hidden')}`, 'false true');
  check('schedule button for to-dos', $('edSchedule').classList.contains('hidden'), false);
  $('edSummary').value = 'File the expense report';
  set('edNoDate', false); set('edDate', dueKey); await sleep(100);
  check('start choices with a due date', [...$('edRmStart').options].map((o) => o.value).join(','), 'none,b0,b1,b2,b3,b7,b14,b30,date');
  set('edRmStart', 'b7'); set('edRmAt', '09:00'); set('edRmEvery', 'day'); set('edRmAfter', false); await sleep(100);
  const first = RF.addDays(RF.parseKey(dueKey), -7);
  check('summary', $('edRmSummary').textContent, `Every day at ${RF.fmt.time(first.getTime() + 9 * 3600e3)}, from ${RF.fmt.long(first)}, until it's done or due (${RF.fmt.date(RF.parseKey(dueKey))}).`);
  check('"also after the due date" offered', $('edRmAfterWrap').classList.contains('hidden'), false);
  $('edSave').click(); await sleep(800);
  const d1 = await find('File the expense report');
  check('plan saved', JSON.stringify(d1.remind), JSON.stringify({ start: 'before', days: 7, date: null, at: '09:00', every: 'day', afterDue: false }));
  check('due by date saved', d1.date, dueKey);
  check('list flag', rowOf('File the expense report').querySelector('.flag.remind').textContent, '🔔 daily from 7 d before');
  check('column heading', document.querySelector('#listView th.c-date').textContent, 'Due by');
  // reopen: the plan is shown again
  await R.openEditor({ uid: d1.uid }); await sleep(300);
  check('reopened', `${$('edRmStart').value} ${$('edRmAt').value} ${$('edRmEvery').value} ${$('edRmAfter').checked}`, 'b7 09:00 day false');
  // no due date: "starting on…" a date, from today
  set('edNoDate', true); await sleep(150);
  check('start choices without a due date', [...$('edRmStart').options].map((o) => o.value).join(','), 'none,date');
  check('becomes "starting on" today', `${$('edRmStart').value} ${$('edRmDate').value}`, `date ${RF.dayKey(t0)}`);
  check('no "after the due date" without one', $('edRmAfterWrap').classList.contains('hidden'), true);
  $('editor').close(); await sleep(200);
  // reminders go off as planned: a plan that started a minute ago, every day
  const now = new Date(Date.now() - 60000);
  await window.rf.save({ kind: 'todo', summary: 'Call the plumber', date: null, categories: [],
    remind: { start: 'date', date: RF.dayKey(now), at: `${RF.pad(now.getHours())}:${RF.pad(now.getMinutes())}`, every: 'day', afterDue: true } });
  await sleep(1500);
  const st = await window.rf.alarmState();
  const al = st.alarms.find((a) => a.summary === 'Call the plumber');
  check('to-do reminder is due', !!al && al.kind, 'todo');
  // an old single alarm becomes "once, on the due date at 9:00"
  await window.rf.save({ kind: 'todo', summary: 'Old style', date: dueKey, allDay: true, time: null, categories: [], alarm: { minutes: -540 } });
  await sleep(500);
  await R.openEditor({ uid: (await find('Old style')).uid }); await sleep(300);
  check('old alarm shown as a plan', `${$('edRmStart').value} ${$('edRmAt').value} ${$('edRmEvery').value}`, 'b0 09:00 once');
  $('edSave').click(); await sleep(700);
  const os = await find('Old style');
  check('saved unchanged: still an ordinary alarm (add-on format)', `${JSON.stringify(os.alarm)} ${os.remind}`, '{"minutes":-540} null');
  // schedule as a reminder from the right-click menu
  await R.refresh(); await sleep(300);
  const tr = rowOf('File the expense report');
  const rc = tr.getBoundingClientRect(); tr.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: rc.left + 300, clientY: rc.top + 10 })); await sleep(300);
  document.querySelector('#ctx button[data-ctx=schedule]').click(); await sleep(300);
  check('dialog starts on the due date', $('scDate').value, dueKey);
  const exact = RF.dayKey(RF.addDays(t0, 8));
  set('scDate', exact); set('scTime', '14:00'); set('scAlarm', '30'); await sleep(100);
  $('scGo').click(); await sleep(900);
  const ev = await find('File the expense report');
  check('now a reminder', `${ev.kind} ${ev.date} ${ev.time} ${ev.alarm && ev.alarm.minutes} ${ev.list} ${ev.remind}`, `event ${exact} 14:00 30 null null`);
  check('same item (UID kept)', ev.uid, d1.uid);
  check('gone from the to-do list', !!rowOf('File the expense report'), false);
  check('in the calendar on that day', (await window.rf.range(RF.parseKey(exact).getTime(), RF.addDays(RF.parseKey(exact), 1).getTime(), { includeTodos: true })).some((r) => r.uid === ev.uid && r.kind === 'event'), true);
  // from the editor, with unsaved edits
  await window.rf.save({ kind: 'todo', summary: 'Book the venue', date: null, categories: ['Party'], notes: 'Ask about parking', list: "To-Do's" });
  await sleep(500);
  await R.openEditor({ uid: (await find('Book the venue')).uid }); await sleep(300);
  $('edSummary').value = 'Book the venue (hall)';
  $('edSchedule').click(); await sleep(300);
  check('dialog from the editor', $('scheduleDlg').open, true);
  set('scAllDay', true); await sleep(100);
  check('all-day alarm choices', [...$('scAlarm').options].map((o) => o.value).join(','), ',-540,900');
  set('scAlarm', '900');
  $('scGo').click(); await sleep(900);
  check('editor closed', $('editor').open, false);
  const v = await find('Book the venue (hall)');
  check('scheduled with the edits', `${v && v.kind} ${v && v.allDay} ${v && v.alarm && v.alarm.minutes} ${v && v.notes}`, 'event true 900 Ask about parking');
} catch (e) { console.log(`E2E ERROR ${e && e.stack}`); }
