// E2E (item colours): past items look like the others in the built-in themes; a theme of your own colours items by
// completed / not completed, starred / not starred and past / today / coming.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const R = window.__rf;
try {
  const key = (n) => RF.dayKey(new Date(Date.now() + n * 864e5));
  const add = (summary, n, extra = {}) => window.rf.save({ kind: 'event', summary, date: key(n), allDay: true, categories: [], ...extra });
  await add('Colour test: past', -3);
  await add('Colour test: coming', 3, { allDay: false, time: '10:00' }); // timed: all-day chips are drawn on the accent colour
  await add('Colour test: today', 0);
  await add('Colour test: starred', 5, { important: true });
  const done = await add('Colour test: done', 4);
  await window.rf.complete(done, true);
  await R.setTab('reminders');
  $('remFilter').value = 'all'; $('remFilter').dispatchEvent(new Event('change')); await sleep(800);
  const row = (t) => [...document.querySelectorAll('#listView tbody tr')].find((r) => (r.querySelector('.t') || {}).textContent === t);
  const col = (t, sel = '.t') => { const r = row(t); return r ? getComputedStyle(r.querySelector(sel)).color : 'missing'; };
  const rgb = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
  // built-in themes: a past item (not completed, not starred) has the colour of a coming one
  for (const th of ['fox', 'light', 'dark', 'ocean', 'contrast']) {
    await R.setSetting({ theme: th }); await sleep(500);
    check(`${th}: past text like coming text`, col('Colour test: past') === col('Colour test: coming'), true);
    check(`${th}: past date like coming date`, col('Colour test: past', '.c-date') === col('Colour test: coming', '.c-date'), true);
    check(`${th}: completed and starred keep their own colours`, col('Colour test: done') !== col('Colour test: coming') && col('Colour test: starred') !== col('Colour test: coming'), true);
  }
  // a theme of your own with item colours
  const base = RF.THEME_COLORS.fox;
  await R.setSetting({ customThemes: [{ id: 'ct', name: 'Colour test', ...base, itPast: '#aa0000', itDone: '#00aa00', itImp: '#0000aa', itFuture: '#555555', itToday: '#884400' }], theme: 'custom:ct' }); await sleep(700);
  check('own theme: past', col('Colour test: past'), rgb('#aa0000'));
  check('own theme: coming', col('Colour test: coming'), rgb('#555555'));
  check('own theme: today', col('Colour test: today'), rgb('#884400'));
  check('own theme: starred wins over coming', col('Colour test: starred'), rgb('#0000aa'));
  check('own theme: completed wins over all', col('Colour test: done'), rgb('#00aa00'));
  // Not completed and Not starred: the fallbacks below the more particular colours
  await R.setSetting({ customThemes: [{ id: 'ct', name: 'Colour test', ...base, itOpen: '#336633', itPlain: '#663366' }] }); await sleep(700);
  check('own theme: not starred', `${col('Colour test: past')} ${col('Colour test: coming')}`, `${rgb('#663366')} ${rgb('#663366')}`);
  await R.setSetting({ customThemes: [{ id: 'ct', name: 'Colour test', ...base, itOpen: '#336633' }] }); await sleep(700);
  check('own theme: not completed', col('Colour test: coming'), rgb('#336633'));
  // the Month view and the theme editor
  await R.setTab('month'); await sleep(800);
  // the test item can be hidden behind "+n more" on a busy day, so a sample stand-up (timed, open, not starred) stands in
  const evs = [...document.querySelectorAll('#monthGrid .ev')];
  const chip = evs.find((c) => c.textContent.includes('Colour test: coming')) || evs.find((c) => c.textContent.includes('Team stand-up'));
  check('the Month view uses them too', chip ? getComputedStyle(chip).color : 'missing', rgb('#336633'));
  await R.setTab('reminders'); await sleep(400);
  const p = window.__rfx.editTheme('ct'); await sleep(600);
  const d = $('themeDlg');
  check('the theme editor has the seven item colours', d.querySelectorAll('[data-use]').length, 7);
  check('… set ones ticked, the rest not', [...d.querySelectorAll('[data-use]')].filter((c) => c.checked).map((c) => c.dataset.use).join(','), 'itOpen');
  const past = d.querySelector('[data-use=itPast]');
  past.click(); d.querySelector('#th-itPast').value = '#990099'; d.querySelector('#th-itPast').dispatchEvent(new Event('input', { bubbles: true })); await sleep(300);
  check('ticking Past shows it at once', col('Colour test: past'), rgb('#990099'));
  $('thSave').click(); await p; await sleep(600);
  check('saved with the theme', ((await window.rf.meta()).settings.customThemes[0] || {}).itPast, '#990099');
  // clean up
  await R.setSetting({ theme: '', customThemes: [] });
  for (const it of await window.rf.all()) if (/^Colour test:/.test(it.summary)) await window.rf.remove(it.uid);
} catch (e) { console.log(`E2E ERROR ${e.message}`); }
