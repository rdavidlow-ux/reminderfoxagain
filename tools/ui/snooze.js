// E2E: snooze rules in common.js and in the main process; a 3-second snooze comes back on time.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
try {
  const s = RF.snooze.seconds;
  check('RF.snooze.seconds', [s(10, 'minutes'), s(1, 'seconds'), s(999, 'hours'), s(0, 'seconds'), s(1000, 'seconds'), s('2.5', 'minutes'), s('', 'minutes'), s(5, 'days')].map((x) => (x == null ? '' : x)).join(','), '600,1,3596400,,,,,');
  const a = RF.snooze.fromSettings({ snoozeMinutes: 60 }); const b = RF.snooze.fromSettings({ snoozeMinutes: 25 }); const c = RF.snooze.fromSettings({});
  check('old setting conversion', [RF.snooze.label(a.amount, a.unit), RF.snooze.label(b.amount, b.unit), RF.snooze.label(c.amount, c.unit)].join(' | '), '1 hour | 25 minutes | 10 minutes');
  const st = await window.rf.alarmState();
  const key = st.alarms[0].key;
  check('main refuses 0 and 999 h + 1 s', [await window.rf.snooze(key, 0), await window.rf.snooze(key, 999 * 3600 + 1), await window.rf.snooze(key, 2.5)].join(','), 'false,false,false');
  const t0 = performance.now();
  check('3 s snooze accepted', await window.rf.snooze(key, 3), true);
  check('gone while snoozed', (await window.rf.alarmState()).alarms.some((x) => x.key === key), false);
  let back = null;
  while (performance.now() - t0 < 8000) {
    if ((await window.rf.alarmState()).alarms.some((x) => x.key === key)) { back = (performance.now() - t0) / 1000; break; }
    await sleep(50);
  }
  check('3 s snooze came back in 2.9–4.5 s', back != null && back >= 2.9 && back <= 4.5 ? 'yes' : `no (${back})`, 'yes');
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
