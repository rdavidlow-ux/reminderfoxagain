// E2E (Alarms view): every alarm ringing, snoozed or to come, in the desktop app and the Thunderbird add-on.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const R = window.__rf;
const until = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(300); } return false; };
try {
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  // a reminder ringing now (its alarm a minute ago), one with an alarm in 3 hours, and a quick alarm in 2 hours
  const ringAt = new Date(Date.now() + 60000);
  await window.rf.save({ kind: 'event', summary: 'Alarm view: ringing now', date: key(ringAt), time: hm(ringAt), allDay: false, alarm: { minutes: 2 } });
  const later = new Date(Date.now() + 3 * 3600000 + 30 * 60000);
  await window.rf.save({ kind: 'event', summary: 'Alarm view: later today', date: key(later), time: hm(later), allDay: false, alarm: { minutes: 30 } });
  await window.rf.quickAdd({ text: 'Alarm view: quick', at: Date.now() + 2 * 3600000 });
  await until(async () => (await window.rf.alarmState()).alarms.some((a) => a.summary === 'Alarm view: ringing now'));
  // the status bar's "⏰ Alarms" opens it
  check('status bar link', $('alarmList').textContent, '⏰ Alarms');
  $('alarmList').click(); await sleep(800);
  const d = $('alarmsDlg');
  check('the Alarms view opens', !!d && d.open, true);
  $('alSpan').value = '7'; $('alSpan').dispatchEvent(new Event('change')); await sleep(800);
  const rows = () => [...d.querySelectorAll('.al-row')].map((r) => ({ title: r.querySelector('b').textContent, cls: [...r.classList].find((c) => c.startsWith('al-') && c !== 'al-row'), acts: [...r.querySelectorAll('button[data-al]')].map((b) => b.textContent).join('/'), el: r }));
  const find = (t) => rows().find((r) => r.title === t);
  const ring = find('Alarm view: ringing now');
  check('ringing, with Snooze, Dismiss and Open', ring ? `${ring.cls} ${ring.acts}` : 'none', 'al-ringing Snooze/Dismiss/Open');
  const cls = rows().map((r) => r.cls);
  check('ringing ones first', cls.lastIndexOf('al-ringing') < cls.findIndex((c) => c !== 'al-ringing' && c !== 'al-snoozed') || !cls.some((c) => c !== 'al-ringing'), true);
  check('a quick alarm to come: Cancel and Open', (find('Alarm view: quick') || {}).acts, 'Cancel/Open');
  check('a reminder to come: Skip and Open', (find('Alarm view: later today') || {}).acts, 'Skip/Open');
  const order = rows().map((r) => r.title).filter((t) => t.startsWith('Alarm view'));
  check('in the order they ring', order.join(' | '), 'Alarm view: ringing now | Alarm view: quick | Alarm view: later today');
  // snooze from the view: it moves to snoozed, then Ring now brings it back
  find('Alarm view: ringing now').el.querySelector('[data-al=snooze]').click(); await sleep(900);
  check('snoozed from the view', `${find('Alarm view: ringing now').cls} ${find('Alarm view: ringing now').acts}`, 'al-snoozed Ring now/Dismiss/Open');
  find('Alarm view: ringing now').el.querySelector('[data-al=now]').click();
  await until(async () => (find('Alarm view: ringing now') || {}).cls === 'al-ringing', 6000);
  check('Ring now: ringing again', (find('Alarm view: ringing now') || {}).cls, 'al-ringing');
  find('Alarm view: ringing now').el.querySelector('[data-al=dismiss]').click(); await sleep(900);
  check('dismissed: gone from the view', !!find('Alarm view: ringing now'), false);
  // skip, then undo
  find('Alarm view: later today').el.querySelector('[data-al=dismiss]').click(); await sleep(900);
  check('skipped: shown struck, with Undo skip', `${find('Alarm view: later today').cls} ${find('Alarm view: later today').acts}`, 'al-skipped Undo skip/Open');
  find('Alarm view: later today').el.querySelector('[data-al=unskip]').click(); await sleep(900);
  check('undo skip', find('Alarm view: later today').cls, 'al-upcoming');
  // cancel the quick alarm
  find('Alarm view: quick').el.querySelector('[data-al=dismiss]').click(); await sleep(900);
  check('quick alarm cancelled', `${!!find('Alarm view: quick')} ${(await window.rf.quickList()).some((x) => x.text === 'Alarm view: quick')}`, 'false false');
  // the span: in the next 24 hours the later reminder is still there; the choice is kept
  $('alSpan').value = '1'; $('alSpan').dispatchEvent(new Event('change')); await sleep(800);
  check('next 24 hours', !!find('Alarm view: later today'), true);
  // Open shows the reminder in the editor
  find('Alarm view: later today').el.querySelector('[data-al=open]').click(); await sleep(800);
  check('Open: the editor with that reminder', `${d.open} ${$('edSummary').value}`, 'false Alarm view: later today');
  $('edCancel').click(); await sleep(400);
  // the keyboard shortcut opens it again, with the span remembered where the browser keeps it
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, bubbles: true, cancelable: true })); await sleep(800);
  check('Ctrl+L opens it', $('alarmsDlg').open, true);
  check('the span is remembered', $('alSpan').value, '1');
  $('alarmsDlg').close();
  // clean up
  for (const it of await window.rf.all()) if (/^Alarm view:/.test(it.summary)) await window.rf.remove(it.uid);
} catch (e) { console.log(`E2E ERROR ${e.message}`); }
