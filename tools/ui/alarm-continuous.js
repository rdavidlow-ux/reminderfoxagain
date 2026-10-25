// E2E (runs inside the alarm window, 0.8.0): "Repeat the sound: continuously" keeps ringing until you snooze, open,
// finish or dismiss an alarm (or hide the window); a new alarm starts it again.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
try {
  await window.rf.setSettings({ resoundMinutes: -1, alarmTone: 'beeps' }); await sleep(600);
  check('alarms showing', document.querySelectorAll('.card').length > 0, true);
  window.__rfAlarm.ring(); await sleep(400);
  check('ringing', window.__rfRinging, true);
  await sleep(RF.TONES.find((t) => t.id === 'beeps').dur * 1000 + 2000);
  check('still ringing after the sound ended (it repeats)', window.__rfRinging, true);
  document.querySelector('.card [data-act=open]').click(); await sleep(400);
  check('Open stops it', window.__rfRinging, false);
  check('the alarm stays in the window', document.querySelectorAll('.card').length > 0, true);
  window.__rfAlarm.ring(); await sleep(400);
  check('a new alarm rings again', window.__rfRinging, true);
  const amt = document.querySelector('.card [data-act=snoozeAmount]');
  amt.value = 'abc'; amt.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('.card [data-act=snooze]').click(); await sleep(300);
  check('an invalid snooze does not stop it', window.__rfRinging, true);
  window.__rfAlarm.ring(); await sleep(200);
  check('ringing once, not twice', window.__rfRinging, true);
  amt.value = '5'; amt.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#hide').click(); await sleep(400);
  check('hiding the window stops it', window.__rfRinging, false);
  await window.rf.setSettings({ resoundMinutes: 2 }); await sleep(400);
  window.__rfAlarm.ring(); await sleep(300);
  check('every 2 minutes: no endless loop', window.__rfRinging, false);
  await window.rf.setSettings({ resoundMinutes: 0, alarmTone: 'chime' });
} catch (e) { console.log(`E2E ERROR ${e.message}`); }
