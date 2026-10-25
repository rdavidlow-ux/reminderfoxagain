// E2E: the add-on's "remind daily until completed", ages in titles and "show in tooltip", through the UI.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const rowOf = (title) => [...document.querySelectorAll('#listView tbody tr')].find((tr) => tr.querySelector('.t') && tr.querySelector('.t').textContent === title);
try {
  const today = RF.startOfDay(new Date());
  const ago = RF.dayKey(RF.addDays(today, -3));
  const year = today.getFullYear();
  // a flagged reminder missed three days ago, with an alarm at the time
  await window.rf.save({ kind: 'event', summary: 'Call the bank', date: ago, time: '00:01', untilDone: true, alarm: { minutes: 0 } });
  await window.rf.save({ kind: 'event', summary: "Mom's <1960> birthday", date: RF.dayKey(today).replace(/^\d{4}/, '1960'), allDay: true, repeat: { freq: 'YEARLY', end: 'never' } });
  await window.rf.save({ kind: 'todo', summary: 'Buy stamps', showInTooltip: true });
  await sleep(800);
  $('remFilter').value = 'upcoming'; $('remFilter').dispatchEvent(new Event('change')); await sleep(500);
  const bank = rowOf('Call the bank');
  check('missed flagged reminder is in Upcoming', !!bank, true);
  check('shown on today', bank && bank.classList.contains('today') && bank.classList.contains('carried'), true);
  check('overdue badge', bank && bank.querySelector('.flag.overdue').textContent, `Overdue since ${RF.fmt.date(ago)}`);
  check('acts on the missed occurrence', bank && RF.dayKey(Number(bank.dataset.start)), ago);
  const st = await window.rf.alarmState();
  check('daily alarm is due today', st.alarms.some((a) => a.summary === 'Call the bank' && a.carried && RF.dayKey(a.at) === RF.dayKey(today)), true);
  check('agenda shows it today', [...document.querySelectorAll('#agenda .item.carried b')].some((b) => b.textContent === 'Call the bank'), true);
  const age = year - 1960;
  const sfx = age % 100 >= 11 && age % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[age % 10] || 'th');
  check('age in the title', !!rowOf(`Mom's ${age}${sfx} birthday`), true);
  // ticking stops the daily reminder
  bank.querySelector('input[data-act=done]').click();
  await sleep(900);
  check('ticked: no longer carried', !rowOf('Call the bank') || !rowOf('Call the bank').classList.contains('carried'), true);
  check('ticked: alarm gone', (await window.rf.alarmState()).alarms.some((a) => a.summary === 'Call the bank'), false);
  // the editor shows the raw title with a preview, and the flags
  const mom = (await window.rf.all()).find((d) => d.summary === "Mom's <1960> birthday");
  await window.__rf.openEditor({ uid: mom.uid }); await sleep(300);
  check('editor keeps the raw title', $('edSummary').value, "Mom's <1960> birthday");
  check('editor previews the age', $('edAgeNote').textContent.startsWith(`Shows as: Mom's ${age}${sfx} birthday`), true);
  check('until-done box on reminders', !$('edRucWrap').classList.contains('hidden') && $('edTipWrap').classList.contains('hidden'), true);
  $('edRuc').checked = true; $('edSave').click(); await sleep(700);
  check('flag saved from the editor', (await window.rf.get(mom.uid)).untilDone, true);
  // to-do tooltip flag
  await window.__rf.setTab('todos'); await sleep(400);
  const stamps = rowOf('Buy stamps');
  check('tooltip badge on the to-do', stamps && stamps.querySelector('.flag').textContent, 'Tooltip');
  const r = stamps.getBoundingClientRect();
  stamps.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: r.left + 200, clientY: r.top + 10 }));
  await sleep(300);
  const tipBtn = document.querySelector('#ctx button[data-ctx=tip]');
  check('context menu toggle', tipBtn && tipBtn.textContent, '✓ Show in the tray tooltip');
  tipBtn.click(); await sleep(700);
  check('tooltip flag cleared', (await window.rf.all()).find((d) => d.summary === 'Buy stamps').showInTooltip, false);
  // the add-on's own file: its birthday is flagged
  const res = await window.rf.importPath((await window.rf.meta()).dataFile.replace(/reminders\.ics$/, 'addon-sample.ics')); // copied there by e2e.sh
  check('add-on file imported', res && res.added, 6);
  check('add-on birthday keeps its flag', (await window.rf.get('1234567890')).untilDone, true);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
