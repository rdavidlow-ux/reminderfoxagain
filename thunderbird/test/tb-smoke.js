// E2E (Thunderbird add-on, run by thunderbird/test/run.js in the main tab): what the add-on does its own way.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E TB ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
try {
  const m = await window.rf.meta();
  check('platform', m.platform, 'thunderbird');
  check('page marked as the add-on', document.documentElement.dataset.host, 'thunderbird');
  check('reminders loaded from storage', m.count > 0, true);
  check('"Data file" saves a copy', $('openFolder').title, 'Save a copy of your reminders file');
  // a new reminder goes through the background page into storage
  await window.rf.save({ kind: 'event', summary: 'Smoke test reminder', date: '2026-12-01', allDay: true });
  // export: the page saves the file as a download
  const saved = [];
  const blobs = new Map();
  const click = HTMLAnchorElement.prototype.click;
  const make = URL.createObjectURL;
  URL.createObjectURL = (b) => { const u = make(b); blobs.set(u, b); return u; };
  HTMLAnchorElement.prototype.click = function () { saved.push({ name: this.download, blob: blobs.get(this.href) }); };
  const name = await window.rf.exportIcs({});
  await window.rf.openDataFolder();
  HTMLAnchorElement.prototype.click = click;
  URL.createObjectURL = make;
  check('export returns the file name', /^reminderfoxagain-\d{4}-\d{2}-\d{2}\.ics$/.test(name), true);
  check('export and "Data file" saved two files', saved.map((s) => s.name.replace(/\d{4}-\d{2}-\d{2}/, 'DATE')).join(', '), 'reminderfoxagain-DATE.ics, reminders-DATE.ics');
  const text = await saved[0].blob.text();
  check('the exported file is a calendar with the new reminder', text.startsWith('BEGIN:VCALENDAR') && text.includes('Smoke test reminder'), true);
  // Settings: the desktop-only choices are hidden; the add-on says where the data is
  await window.__rf.openSettings?.();
  if (!$('stImport') || $('stImport').offsetParent === null) { const b = $('settingsBtn'); if (b) b.click(); await sleep(400); }
  for (const btn of document.querySelectorAll('[data-panel="data"], [data-p="data"]')) btn.click();
  await sleep(300);
  check('desktop-only settings hidden', ['stStart', 'stTray', 'stFolder', 'stBackups', 'stOldRf', 'stPath'].filter((id) => $(id) && $(id).offsetParent !== null).join(',') || 'none', 'none');
  check('the storage note', ($('tbPath') || {}).textContent, 'Your reminders are kept in your Thunderbird profile, with a backup every day.');
  check('import and export stay', ['stImport', 'stExport'].every((id) => !!$(id)), true);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(300);
  // a map link opens in the system browser
  check('map link accepted', await window.rf.openUrl('https://www.openstreetmap.org/search?query=Toronto'), true);
  // the pop-up and a quick alarm two seconds from now
  await window.rf.showSlider();
  await window.rf.quickAdd({ text: 'Smoke test quick alarm', at: Date.now() + 2000 });
  await sleep(4500);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
