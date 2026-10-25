// E2E (0.8.0, 0.8.1): Show completed in the Reminders and Month toolbars, columns chosen in Settings → Display, the View
// section with Manage reminders (saved filters), Order by every column in the lists, and the alarm sounds.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const R = window.__rf;
const change = async (el, v, ms = 500) => { if (v !== undefined) { if (el.type === 'checkbox') el.checked = v; else el.value = v; } el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(ms); };
const titles = () => [...document.querySelectorAll('#listView tbody tr[data-uid] .t')].map((t) => t.textContent);
const shown = (sel) => { const el = document.querySelector(sel); return !!el && el.offsetWidth > 0; };
try {
  const all = await window.rf.all();
  const uidOf = (s) => all.find((d) => d.summary === s).uid;
  // ---------- Reminders: Show completed
  await R.setTab('reminders');
  await change($('remFilter'), 'all', 700);
  check('Reminders: Show completed is there and ticked', `${shown('#remDone')} ${$('remDone').checked}`, 'true true');
  await window.rf.complete(uidOf('Car service'), true); await R.refresh(); await sleep(600);
  check('a completed reminder shows', titles().includes('Car service'), true);
  await change($('remDone'), false, 800);
  check('unticked: completed reminders hidden', `${titles().includes('Car service')} ${(await window.rf.meta()).settings.hideCompleted}`, 'false true');
  check('open ones still there', titles().includes('Dentist — Dr. Patel'), true);
  await change($('remFilter'), 'past', 700);
  check('hidden in Past too', titles().includes('Car service'), false);
  await change($('remDone'), true, 800);
  check('ticked again: shown', titles().includes('Car service'), true);
  // ---------- Month: Show completed (ticked at every start, 0.8.1)
  await R.setTab('month'); await sleep(600);
  const chips = () => [...document.querySelectorAll('#monthGrid .ev')].map((c) => c.textContent);
  check('Month: Show completed is there, ticked', `${shown('#mDone')} ${$('mDone').checked}`, 'true true');
  const renew = uidOf('Renew passport');
  await window.rf.complete(renew, true); await R.refresh(); await sleep(700);
  check('ticked: completed list item shown', chips().some((t) => t.includes('Renew passport')), true);
  check('ticked: completed reminder shown, struck', !!document.querySelector('#monthGrid .ev.done'), true);
  await change($('mDone'), false, 800);
  check('unticked: completed list item not in the month', chips().some((t) => t.includes('Renew passport')), false);
  check('unticked: completed reminder not in the month', chips().some((t) => t.includes('Car service')), false);
  check('not kept as a setting (ticked again at the next start)', 'monthShowDone' in (await window.rf.meta()).settings, false);
  await change($('mDone'), true, 600);
  await window.rf.complete(renew, false); await window.rf.complete(uidOf('Car service'), false); await R.refresh(); await sleep(500);
  // ---------- Settings: the View section
  $('settingsBtn').click(); await sleep(400);
  const tabNames = [...$('stTabs').querySelectorAll('button')].map((b) => b.textContent).join(',');
  check('settings sections', tabNames, 'General,Alarms,Display,View,Data');
  $('stTabs').querySelector('[data-st=lists]').click(); await sleep(200);
  const firstRow = [...$('settingsDlg').querySelector('[data-st-panel=lists] .row').querySelectorAll('button')].map((b) => b.textContent).join(' | ');
  check('Manage reminders first', firstRow, 'Manage reminders… | Manage lists… | Manage categories…');
  check('no Hide completed reminders here (it is in the toolbar)', !!$('stHideDone'), false);
  // ---------- columns
  $('stTabs').querySelector('[data-st=display]').click(); await sleep(200);
  const remCols = [...$('stColsRem').querySelectorAll('input')];
  check('Reminders columns offered', remCols.length, 9);
  check('description cannot be hidden', `${$('stColsRem').querySelector('[data-col=desc]').disabled} ${$('stColsRem').querySelector('[data-col=desc]').checked}`, 'true true');
  check('lists offer Due by, no Day', `${$('stColsTodo').querySelectorAll('input').length} ${$('stColsTodo').textContent.includes('Due by')} ${!!$('stColsTodo').querySelector('[data-col=day]')}`, '8 true false');
  await change($('stColsRem').querySelector('[data-col=day]'), false, 400);
  await change($('stColsRem').querySelector('[data-col=repeat]'), false, 400);
  check('hidden columns saved', (await window.rf.meta()).settings.remColumnsHidden.join(','), 'day,repeat');
  $('settingsDlg').close();
  await R.setTab('reminders'); await change($('remFilter'), 'upcoming', 700);
  check('Day and Repeat hidden in Reminders', `${shown('#listView th.c-day')} ${shown('#listView td.c-repeat')} ${shown('#listView th.c-date')}`, 'false false true');
  await R.showList("To-Do's"); await R.setTab('todos'); await sleep(600);
  check('lists keep their own columns', shown('#listView th.c-repeat'), true);
  await R.setSetting({ todoColumnsHidden: ['cat', 'alarm'] }); R.applyColumns(); await sleep(200);
  check('Category and Alarm hidden in the list', `${shown('#listView th.c-cat')} ${shown('#listView th.c-alarm')}`, 'false false');
  await R.setTab('reminders'); await sleep(500);
  check('…but not in Reminders', shown('#listView th.c-cat'), true);
  const wide = $('listView').scrollWidth <= $('listView').clientWidth + 1;
  check('no sideways scroll with hidden columns', wide, true);
  await R.setSetting({ remColumnsHidden: [], todoColumnsHidden: [] }); R.applyColumns();
  // ---------- Manage reminders: saved filters
  await R.setSetting({ views: [{ name: 'Birthdays', criteria: [{ field: 'categories', value: 'Birthday' }], date: null, includeTodos: false }] }); await R.refresh(); await sleep(400);
  const opts = [...$('remFilter').querySelectorAll('optgroup, option')].map((o) => o.label || o.textContent);
  check('Show list: Saved filters, then Manage reminders…', `${opts.includes('Saved filters')} ${opts[opts.length - 1]}`, 'true Manage reminders…');
  await change($('remFilter'), 'view:0', 700);
  check('hint names the saved filter', /^Saved filter “Birthdays” · /.test($('remHint').textContent), true);
  await change($('remFilter'), 'manage', 600);
  const vd = $('viewsDlg');
  check('Manage reminders opens', `${!!vd && vd.open} ${vd && vd.querySelector('h2').textContent}`, 'true Manage reminders');
  check('it speaks of saved filters, not views', `${/saved filter/.test(vd.textContent)} ${/\bviews?\b/i.test(vd.textContent)}`, 'true false');
  vd.querySelector('[data-a=edit]').click(); await sleep(400);
  const ed = $('viewEdDlg');
  check('editor title', ed.querySelector('h2').textContent, 'Edit saved filter');
  ed.close(); vd.close(); await sleep(200);
  await R.setSetting({ views: [] }); await R.refresh();
  // ---------- Order by every column, before Show completed
  await R.setTab('todos'); await sleep(500);
  const sort = $('todoSort');
  check('Order offers every column', [...sort.options].map((o) => o.value).join(','), 'manual,date,time,summary,important,completed,repeat,category,alarm');
  check('Order comes before Show completed', !!(sort.compareDocumentPosition($('showDone')) & Node.DOCUMENT_POSITION_FOLLOWING), true);
  const top = () => titles()[0];
  if (!$('showDone').checked) await change($('showDone'), true, 500);
  await change(sort, 'summary', 600);
  check('by description: A to Z', titles().filter((t) => t !== 'Book flu shot').join(' | '), 'Back up photos | Renew passport | Water the plants');
  check('completed stay at the bottom', titles()[titles().length - 1], 'Book flu shot');
  await change(sort, 'completed', 600);
  check('by Completed: completed first', top(), 'Book flu shot');
  await change(sort, 'category', 600);
  check('by category: categorised first', top(), 'Back up photos');
  await change(sort, 'repeat', 600);
  check('by repeat: repeating first', top(), 'Water the plants');
  await change(sort, 'important', 600);
  check('by important: starred first', top(), 'Renew passport');
  check('order remembered', (await window.rf.meta()).settings.todoSort, 'important');
  await change(sort, 'date', 500);
  // ---------- sounds
  check('built-in sounds', RF.TONES.map((t) => t.id).join(','), 'chime,bell,marimba,beeps,clock');
  check('every sound has a length', RF.TONES.every((t) => t.dur > 1 && t.dur < 4), true);
  check('Repeat offers continuously', [...$('stResound').options].some((o) => o.value === '-1' && o.textContent === 'Continuously until cleared'), true);
  $('settingsBtn').click(); await sleep(300);
  $('stTabs').querySelector('[data-st=alarms]').click(); await sleep(200);
  await change($('stTone'), 'marimba', 500);
  check('sound picked', (await window.rf.meta()).settings.alarmTone, 'marimba');
  check('no own file listed yet', [...$('stTone').options].some((o) => o.value === 'file'), false);
  await change($('stTone'), 'chime', 300);
  RF.stopSound();
  $('settingsDlg').close();
} catch (e) { console.log(`E2E ERROR ${e.message}`); }
