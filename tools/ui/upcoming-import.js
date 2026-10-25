// E2E: Upcoming and the other future lists project every repeat (Settings → Lists → Future dates to show),
// month headings count their reminders, Plan ahead is gone, Import and Export live in Settings → Data.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const filter = async (f) => { $('remFilter').value = f; $('remFilter').dispatchEvent(new Event('change')); await sleep(600); };
const count = (title) => [...document.querySelectorAll('#listView tbody tr .t')].filter((t) => t.textContent === title).length;
try {
  const t0 = RF.startOfDay(new Date());
  const until = (months) => { const b = new Date(t0); b.setMonth(b.getMonth() + months); return b; };
  const expected = async (title, months) => (await window.rf.range(t0.getTime(), until(months).getTime(), { includeTodos: false })).filter((r) => r.summary === title).length;
  check('Plan ahead removed', [...$('remFilter').options].some((o) => o.value === 'plan') || !!$('planWrap'), false);
  await filter('upcoming');
  check('Upcoming: 12 months of weekday stand-ups', count('Team stand-up'), await expected('Team stand-up', 12));
  check('Upcoming: recycling every 2 weeks', count('Recycling & green bin'), await expected('Recycling & green bin', 12));
  check('Upcoming: book club every month', count('Book club'), await expected('Book club', 12));
  check('Upcoming: one-offs once', count('Dentist — Dr. Patel'), 1);
  const rows = document.querySelectorAll('#listView tbody tr[data-key]').length;
  const seps = [...document.querySelectorAll('#listView tr.sep .sep-count')].map((x) => parseInt(x.textContent, 10));
  check('every month heading has a count', seps.length, document.querySelectorAll('#listView tr.sep').length);
  check('month counts add up to the list', seps.reduce((a, b) => a + b, 0), rows);
  check('hint counts the rows', $('remHint').textContent, `${rows} reminders`);
  await filter('all');
  check('All: future stand-ups projected', [...document.querySelectorAll('#listView tbody tr')].filter((tr) => tr.querySelector('.t') && tr.querySelector('.t').textContent === 'Team stand-up' && Number(tr.dataset.start) >= t0.getTime()).length, await expected('Team stand-up', 12));
  $('search').value = 'recycling'; $('search').dispatchEvent(new Event('input')); await sleep(700);
  check('search: future dates projected', [...document.querySelectorAll('#listView tbody tr')].filter((tr) => tr.querySelector('.t') && Number(tr.dataset.start) >= t0.getTime()).length, await expected('Recycling & green bin', 12));
  $('search').value = ''; $('search').dispatchEvent(new Event('input')); await sleep(700);
  await window.__rf.setSetting({ views: [{ name: 'Home', criteria: [{ field: 'categories', value: 'Home' }], date: null, includeTodos: false }] }); await window.__rf.refresh();
  await filter('view:0');
  check('view without dates: projected', count('Recycling & green bin'), await expected('Recycling & green bin', 12));
  await filter('upcoming');
  $('settingsBtn').click(); await sleep(300); window.__rfx.showPanel('lists'); await sleep(100);
  check('setting default', $('stRepeatAhead').value, 'm12');
  $('stRepeatAhead').value = 'm3'; $('stRepeatAhead').dispatchEvent(new Event('change')); await sleep(800);
  check('3 months', count('Team stand-up'), await expected('Team stand-up', 3));
  $('stRepeatAhead').value = 'm24'; $('stRepeatAhead').dispatchEvent(new Event('change')); await sleep(900);
  check('2 years', count('Book club'), await expected('Book club', 24));
  $('stRepeatAhead').value = 'n1'; $('stRepeatAhead').dispatchEvent(new Event('change')); await sleep(800);
  check('only the next date', count('Team stand-up'), 1);
  $('settingsDlg').close(); await window.__rf.setSetting({ repeatAhead: 'm12', views: [] }); await window.__rf.refresh();
  // Import and Export in Settings → Data
  check('no Import/Export in the top bar', !$('importBtn') && !$('exportBtn'), true);
  $('settingsBtn').click(); await sleep(300);
  window.__rfx.showPanel('data'); await sleep(100);
  check('About thanks ReminderFox', /tribute to the original ReminderFox.*Tom Mutdosch and Daniel Lee with Guenter Wahl/.test($('stAbout').textContent), true);
  check('import button wording', $('stOldRf').textContent, 'Import from ReminderFox…');
  check('Settings → Data has import, ReminderFox, export', ['stImport', 'stOldRf', 'stExport'].every((id) => $(id) && $(id).offsetWidth > 0), true);
  $('stExport').click(); await sleep(300);
  check('export dialog opens over Settings', `${$('exportDlg').open} ${$('settingsDlg').open}`, 'true true');
  $('exportDlg').close(); $('settingsDlg').close(); await sleep(200);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true })); await sleep(300);
  check('Ctrl+E still exports', $('exportDlg').open, true);
  $('exportDlg').close();
} catch (e) { console.log(`E2E ERROR ${e && e.stack}`); }
