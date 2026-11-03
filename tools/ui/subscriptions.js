// E2E (calendar subscriptions): subscribe by web address, show per view, read-only items, copy, manage, remove;
// in the desktop app (tools/sample-calendar.js serves the calendar) and the Thunderbird add-on (run.js serves it).
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const R = window.__rf;
const until = async (fn, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(250); } return false; };
try {
  const TB = document.documentElement.dataset.host === 'thunderbird';
  const base = TB ? location.origin : 'http://127.0.0.1:8765';
  await R.setTab('reminders'); await sleep(400);
  $('remFilter').value = 'upcoming'; $('remFilter').dispatchEvent(new Event('change')); await sleep(500);
  // 📅 Calendars in the Reminders toolbar: none yet, and a way to subscribe
  const btn = document.querySelector('[data-calview=list]');
  check('the Calendars button is in the Reminders toolbar', !!btn && btn.offsetParent !== null, true);
  btn.click(); await sleep(300);
  check('no subscriptions yet', $('calPop').textContent.includes('No calendar subscriptions yet'), true);
  $('calPop').querySelector('[data-calact=add]').click(); await sleep(500);
  const d = $('subsDlg');
  check('Subscribe opens the subscriptions dialog', !!d && d.open, true);
  // a page that isn't a calendar says so
  $('subUrl').value = `${base}/_cal/missing.ics`; $('subAdd').click();
  await until(() => $('subAdd').disabled === false && $('subMsg').textContent && !/Subscribing/.test($('subMsg').textContent));
  check('a wrong address says so', $('subMsg').classList.contains('warn'), true);
  // subscribe (webcal:// works as https:// does; here the test server is plain http)
  $('subUrl').value = `${base}/_cal/holidays.ics`; $('subAdd').click();
  await until(() => /Subscribed/.test($('subMsg').textContent));
  check('subscribed', $('subMsg').textContent, 'Subscribed to “Sample holidays” (4 events).');
  if (TB) check('the add-on asked for that site only', await browser.permissions.contains({ origins: [`${location.origin}/*`] }), true);
  await until(() => $('subList').querySelectorAll('.sub-row').length === 1);
  check('listed with its name and address', `${$('subList').querySelector('[data-f=name]').value} ${$('subList').querySelector('.sub-url').textContent}`, `Sample holidays ${base}/_cal/holidays.ics`);
  d.close(); await sleep(800);
  // its events in the Reminders view, marked and read-only
  const subRows = () => [...document.querySelectorAll('#listView tbody tr.subcal')];
  const titles = () => subRows().map((r) => r.querySelector('.t').textContent);
  await until(() => subRows().length > 0);
  check('its coming events in the Reminders view', titles().filter((t) => /\(sample\)/.test(t)).sort().join(' | '), "City marathon (sample) | Founders' Day (sample) | Lantern Night (sample)");
  const row = subRows().find((r) => r.querySelector('.t').textContent === "Founders' Day (sample)");
  check('marked with the calendar\'s name', row.querySelector('.subcal-name').textContent, 'Sample holidays');
  check('it can be ticked', row.querySelector('input[data-act=done]').disabled, false);
  check('in the subscription\'s colour', !!row.style.getPropertyValue('--sub-c'), true);
  // ticked: marked completed, and still ticked after the calendar is fetched again (the calendar itself is unchanged)
  const subRow = (t) => subRows().find((r) => r.querySelector('.t').textContent === t);
  subRow("Founders' Day (sample)").querySelector('input[data-act=done]').click(); await sleep(900);
  check('ticked: completed', subRow("Founders' Day (sample)").classList.contains('done') && subRow("Founders' Day (sample)").querySelector('input[data-act=done]').checked, true);
  check('… with when it was ticked', !!subRow("Founders' Day (sample)").querySelector('.done-at'), true);
  await window.rf.subsRefresh((await window.rf.subsList())[0].id); await sleep(1200);
  check('… still ticked after a refresh', !!subRow("Founders' Day (sample)") && subRow("Founders' Day (sample)").classList.contains('done'), true);
  check('… the others are not', subRow('Lantern Night (sample)').classList.contains('done'), false);
  subRow("Founders' Day (sample)").querySelector('input[data-act=done]').click(); await sleep(900);
  check('unticked again', subRow("Founders' Day (sample)").classList.contains('done'), false);
  $('remFilter').value = 'past'; $('remFilter').dispatchEvent(new Event('change')); await sleep(700);
  check('the past one under Past', titles().includes('Spring Fair (sample)'), true);
  $('remFilter').value = 'upcoming'; $('remFilter').dispatchEvent(new Event('change')); await sleep(700);
  // and in the Month view
  await R.setTab('month'); await sleep(900);
  const chips = () => [...document.querySelectorAll('#monthGrid .ev.subcal')].map((c) => c.textContent);
  check('in the Month view', chips().some((t) => t.includes('Lantern Night (sample)')), true);
  // hidden from the Month view only, from its own Calendars button
  document.querySelector('[data-calview=month]').click(); await sleep(300);
  const box = $('calPop').querySelector('input[data-sub]');
  check('the Month view\'s Calendars lists it, ticked', `${!!box} ${box && box.checked}`, 'true true');
  box.click(); await sleep(1200);
  check('unticked: gone from the Month view', chips().length, 0);
  check('… the button shows that some are hidden', document.querySelector('[data-calview=month]').classList.contains('has-hidden'), true);
  document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await sleep(200);
  await R.setTab('reminders'); await sleep(800);
  check('… still in the Reminders view', titles().includes("Founders' Day (sample)"), true);
  await R.setTab('month'); await sleep(500);
  document.querySelector('[data-calview=month]').click(); await sleep(300);
  $('calPop').querySelector('input[data-sub]').click(); await sleep(1200);
  check('ticked again: back in the Month view', chips().some((t) => t.includes('Lantern Night (sample)')), true);
  document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await sleep(200);
  // opened: read-only, with Copy to my reminders
  const chip = [...document.querySelectorAll('#monthGrid .ev.subcal')].find((c) => c.textContent.includes('Lantern Night (sample)'));
  chip.click(); await sleep(700);
  check('opened read-only', `${$('editor').classList.contains('readonly')} ${$('edSave').classList.contains('hidden')} ${$('edCopyMine').classList.contains('hidden')}`, 'true true false');
  check('… saying where it is from', $('edReadOnly').textContent, 'From “Sample holidays”, a calendar you subscribe to. It can\'t be changed here.');
  check('… with its details', `${$('edSummary').value} · ${$('edLocation').value}`, 'Lantern Night (sample) · Harbour Park');
  $('edCopyMine').click(); await sleep(900);
  const mine = (await window.rf.all()).find((x) => x.summary === 'Lantern Night (sample)');
  check('Copy to my reminders: your own copy', `${$('editor').open} ${!!mine} ${mine && mine.location}`, 'false true Harbour Park');
  if (mine) await window.rf.remove(mine.uid);
  // a normal reminder opens as before
  await R.openEditor({ kind: 'event' }); await sleep(400);
  check('your own reminders still open for editing', `${$('editor').classList.contains('readonly')} ${$('edSave').classList.contains('hidden')}`, 'false false');
  $('edCancel').click(); await sleep(300);
  // right-click on it in the list: Open, Mark completed and Copy
  await R.setTab('reminders'); await sleep(700);
  const r2 = subRows()[0];
  r2.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })); await sleep(400);
  check('its right-click menu', [...document.querySelectorAll('#ctx:not(.hidden) button')].map((b) => b.dataset.ctx).join(','), 'edit,toggle,mine');
  [...document.querySelectorAll('#ctx:not(.hidden) button')].find((b) => b.dataset.ctx === 'toggle').click(); await sleep(900);
  check('Mark completed from the menu', subRows()[0].classList.contains('done'), true);
  subRows()[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })); await sleep(400);
  [...document.querySelectorAll('#ctx:not(.hidden) button')].find((b) => b.dataset.ctx === 'toggle').click(); await sleep(900);
  check('Mark not completed from the menu', subRows()[0].classList.contains('done'), false);
  document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await sleep(200);
  // manage: rename and colour; Settings → Data has the way in too
  $('settingsBtn').click(); await sleep(400);
  $('stTabs').querySelector('[data-st=data]').click(); await sleep(200);
  check('Settings → Data → Calendar subscriptions…', !!$('stSubs') && $('stSubs').offsetParent !== null, true);
  $('stSubs').click(); await sleep(500);
  const name = $('subList').querySelector('[data-f=name]');
  name.value = 'Holidays'; name.dispatchEvent(new Event('change', { bubbles: true })); await sleep(600);
  const col = $('subList').querySelector('[data-f=color]');
  col.value = '#123456'; col.dispatchEvent(new Event('change', { bubbles: true })); await sleep(900);
  check('renamed and recoloured', `${(await window.rf.subsList())[0].name} ${(await window.rf.subsList())[0].color}`, 'Holidays #123456');
  // refresh now
  $('subList').querySelector('[data-sa=refresh]').click(); await sleep(1200);
  check('refreshed without a problem', (await window.rf.subsList())[0].error, '');
  // the option to mark past events completed: off at first; on, what is over counts as completed
  const auto = $('subList').querySelector('[data-f=autoDone]');
  check('"Mark past events completed" is there, off', `${!!auto} ${auto && auto.checked}`, 'true false');
  const pastDone = async () => (await window.rf.subsRange(Date.now() - 400 * 864e5, Date.now() + 400 * 864e5, 'month')).map((r) => `${r.summary.replace(' (sample)', '')}:${r.completed}`).filter((t) => /Spring Fair|Lantern Night/.test(t)).sort().join(' ');
  check('… past events not completed', await pastDone(), 'Lantern Night:false Spring Fair:false');
  auto.click(); await sleep(900);
  check('… on: the past one is completed, the coming one not', `${(await window.rf.subsList())[0].autoDone} ${await pastDone()}`, 'true Lantern Night:false Spring Fair:true');
  // remove
  $('subList').querySelector('[data-sa=remove]').click(); await sleep(400);
  [...$('cfFoot').querySelectorAll('button')].find((b) => b.textContent === 'Remove').click(); await sleep(1000);
  check('removed', `${(await window.rf.subsList()).length} ${$('subList').textContent.includes('No calendar subscriptions yet')}`, '0 true');
  $('subsDlg').close(); $('settingsDlg').close(); await sleep(800);
  check('… and its events are gone', subRows().length, 0);
} catch (e) { console.log(`E2E ERROR ${e.message}`); }
