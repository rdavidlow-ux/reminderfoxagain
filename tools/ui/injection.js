// E2E (security audit): text from the data that looks like HTML stays text. An item, a list, a category and a saved
// filter are named with markup; every tab, view and dialog that shows them is opened, and no element from that markup
// may appear in the page. Desktop app and Thunderbird add-on.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const R = window.__rf; const X = window.__rfx;
const BAD = (n) => `<img id="pwn${n}" src="x" onerror="window.__xss=${n}">"'><b id="pwnb${n}">x</b>`;
const found = () => document.querySelectorAll('[id^="pwn"]').length + [...document.querySelectorAll('iframe')].reduce((s, f) => { try { return s + f.contentDocument.querySelectorAll('[id^="pwn"]').length; } catch (e) { return s; } }, 0);
const closeAll = () => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); };
try {
  window.__xss = 0;
  const key = (d) => RF.dayKey(d);
  const now = new Date();
  const today = key(now);
  const list = `Errands ${BAD(1)}`;
  const cat = `Cat ${BAD(2)}`;
  await R.setSetting({ lists: [...(R.S.settings.lists || []), list], categories: [...(R.S.settings.categories || []), cat],
    views: [...(R.S.settings.views || []), { name: `View ${BAD(3)}`, match: 'all', rules: [] }] });
  const ev = await window.rf.save({ kind: 'event', summary: `Event ${BAD(4)}`, date: today, allDay: false, time: '10:00', location: `Place ${BAD(5)}`,
    notes: `Notes ${BAD(6)}`, categories: [cat], alarm: { minutes: 0 } });
  await window.rf.save({ kind: 'todo', summary: `Todo ${BAD(7)}`, date: today, allDay: true, list, categories: [cat], notes: BAD(8) });
  await R.refresh(); await sleep(600);
  const seen = [];
  const look = async (where, fn) => { try { await fn(); } catch (e) { seen.push(`${where}: ${e.message}`); } await sleep(700); const n = found(); if (n) seen.push(`${where}: ${n}`); closeAll(); };
  await look('Reminders', () => R.setTab('reminders'));
  await R.setTab('reminders'); await sleep(600);
  check('the markup is shown as text', $('listView').textContent.includes('Event <img id="pwn4"'), true);
  await look('search', async () => { const q = $('search') || document.querySelector('input[type=search]'); if (q) { q.value = 'pwn'; q.dispatchEvent(new Event('input', { bubbles: true })); } });
  await look('Lists', () => R.showList(list));
  for (const m of ['month', 'week', 'day']) {
    await look(`Month: ${m}`, async () => { await R.setTab('month'); await R.selectDay(today); const b = document.querySelector(`#calMode [data-cmode="${m}"]`); if (b) b.click(); });
  }
  await look('side panel', () => R.renderSide());
  await look('editor', () => R.openEditor({ uid: ev }));
  for (const f of ['openViews', 'openLists', 'openCategories', 'openAlarms', 'openQuick', 'openSubscriptions', 'openGoTo']) {
    if (typeof X[f] === 'function') await look(f, () => X[f]());
  }
  await look('saved filter', () => X.showView((R.S.settings.views || []).length - 1));
  await look('settings', () => X.fillSettings && X.fillSettings());
  check('no element from the data got into the page', seen.join('; ') || 'none', 'none');
  check('nothing from the data ran', window.__xss, 0);
  // a window can only name files picked in it: any other file is refused, not read
  const refused = async (p) => { try { await p; return 'opened'; } catch (e) { return 'refused'; } };
  const other = ['thunderbird', 'android'].includes(document.documentElement.dataset.host) ? 'upload:1/../../etc/hostname' : '/etc/hostname';
  check('a file not picked is not imported', await refused(window.rf.importPaths([other], {})), 'refused');
  check('… nor looked at', await refused(window.rf.previewImport([other])), 'refused');
  check('… nor restored from', await refused(window.rf.backupRestore(other)), 'refused');
  if (!['thunderbird', 'android'].includes(document.documentElement.dataset.host)) { // the desktop app's own wording
    let msg = ''; try { await window.rf.importPath('/etc/hostname'); } catch (e) { msg = e.message; }
    check('… and says why', msg, 'That file was not picked in ReminderFoxAgain, so it was not opened.');
    check('backups in the data folder are still listed', Array.isArray(await window.rf.backupList()), true);
  }
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
