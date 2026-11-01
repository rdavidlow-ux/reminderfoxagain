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
  // Thunderbird keeps Ctrl+N… for itself: the tooltips show the add-on's own shortcuts
  check('tooltip: new reminder', $('addReminder').title, 'New reminder (Alt+Shift+A)');
  check('tooltip: quick alarm', $('quickBtn').title, 'Quick alarm: a one-off alarm in a few minutes (Alt+Shift+Q)');
  check('tooltip: search', $('search').title, 'Search (Alt+Shift+K)');
  // none of the add-on's shortcuts is Alt+Shift and the access key of a Thunderbird menu (File, Edit, View, Go,
  // Message, Events and Tasks, Tools, Help): Thunderbird opens the menu instead
  const keys = (await (await fetch('/manifest.json')).json()).commands;
  check('no shortcut on a menu\'s letter', Object.values(keys).map((c) => c.suggested_key.default).filter((k) => /^Alt\+Shift\+[FEVGMNTH]$/.test(k)).join(', ') || 'none', 'none');
  check('the new-item shortcuts', ['new-reminder', 'new-list-item', 'search', 'go-to', 'export'].map((n) => keys[n].suggested_key.default).join(' '), 'Alt+Shift+A Alt+Shift+O Alt+Shift+K Alt+Shift+J Alt+Shift+X');
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
  check('desktop-only settings hidden', ['stStart', 'stTray', 'stFolder', 'stBackups', 'stPath'].filter((id) => $(id) && $(id).offsetParent !== null).join(',') || 'none', 'none');
  check('the storage note', ($('tbPath') || {}).textContent, 'Your reminders are kept in your Thunderbird profile, with a backup every day.');
  check('import, Import from ReminderFox and export stay', ['stImport', 'stOldRf', 'stExport'].every((id) => $(id) && getComputedStyle($(id)).display !== 'none'), true);
  check('its add-on tooltip', $('stOldRf').title, 'Pick the reminderfox.ics the ReminderFox add-on kept in your Firefox or Thunderbird profile');
  // Import from ReminderFox…: first where the file is, then the file picker (prefs.js allowed with it)
  let picked = null;
  const pickClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () { if (this.type === 'file') { picked = this.accept; return; } return pickClick.call(this); };
  $('stOldRf').click();
  await sleep(400);
  check('Import from ReminderFox… says where the file is', !!$('confirm').open && /reminderfox folder of your Thunderbird or Firefox profile/.test($('cfBody').textContent), true);
  check('… and nothing is picked yet', picked, null);
  [...$('cfFoot').querySelectorAll('button')].find((b) => b.textContent === 'Choose the file…').click();
  await sleep(400);
  HTMLInputElement.prototype.click = pickClick;
  check('"Choose the file…" opens the file picker for .ics and prefs.js', !!picked && /\.ics/.test(picked) && /\.js/.test(picked), true);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(300);
  // a map link opens in the system browser
  check('map link accepted', await window.rf.openUrl('https://www.openstreetmap.org/search?query=Toronto'), true);
  // the pop-up and a quick alarm two seconds from now
  await window.rf.showSlider();
  await window.rf.quickAdd({ text: 'Smoke test quick alarm', at: Date.now() + 2000 });
  await sleep(4500);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
