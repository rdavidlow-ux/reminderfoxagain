// E2E (0.9.0): the wording and shortcuts of the platform the app runs on (RF_FAKE_PLATFORM=darwin|linux), the note
// for a Linux desktop without tray icons (RF_FAKE_TRAYLESS=1) and start at login.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const label = (id) => $(id).closest('label').textContent.trim();
try {
  const meta = await window.rf.meta();
  const P = document.documentElement.dataset.platform;
  const de = RF.i18n.lang === 'de';
  check('platform from the host', `${meta.platform} ${RF.platform}`, `${P} ${P}`);
  const W = {
    windows: { start: 'Start ReminderFoxAgain when Windows starts', tray: 'Keep running in the system tray when the window is closed', add: 'New reminder (Ctrl+N)', quick: 'Quick alarm: a one-off alarm in a few minutes (Ctrl+Q)', folder: 'Show the reminders file in File Explorer' },
    macos: { start: 'Start ReminderFoxAgain when you log in', tray: 'Keep running in the menu bar when the window is closed', add: 'New reminder (⌘N)', quick: 'Quick alarm: a one-off alarm in a few minutes (⇧⌘A)', folder: 'Show the reminders file in Finder' },
    linux: { start: 'Start ReminderFoxAgain when you log in', tray: 'Keep running in the system tray when the window is closed', add: 'New reminder (Ctrl+N)', quick: 'Quick alarm: a one-off alarm in a few minutes (Ctrl+Q)', folder: 'Show the reminders file in your file manager' },
  }[P];
  if (de) {
    check('German: start at login', label('stStart'), P === 'windows' ? $('stStart').closest('label').textContent.trim() : 'ReminderFoxAgain bei der Anmeldung starten');
    check('German: shortcut in a title', /\((⌘|Ctrl\+)N\)$/.test($('addReminder').title) && !/New reminder/.test($('addReminder').title), true);
    check('German: ⌘ on macOS', $('addReminder').title.includes('⌘'), P === 'macos');
  } else {
    check('start at login', label('stStart'), W.start);
    check('keep running', label('stTray'), W.tray);
    check('Add reminder title', $('addReminder').title, W.add);
    check('Quick alarm title', $('quickBtn').title, W.quick);
    check('the date format follows the system', RF.DATE_FORMATS[0][1].startsWith(P === 'windows' ? 'As in Windows' : 'As in your system'), true);
  }
  // the tray-less note (Linux, GNOME without the extension)
  $('settingsBtn').click(); await sleep(400);
  console.log(`E2E tray icons missing: ${meta.trayMissing} (expected ${meta.trayMissing})`);
  check('the tray-less note shown just then', !$('stTrayNote').hidden, meta.trayMissing);
  if (meta.trayMissing) check('closing the window quits there', `${$('stTray').checked} ${meta.settings.closeToTray}`, 'false false');
  $('settingsDlg').close(); await sleep(200);
  // start at login (RF_TEST_AUTOSTART): ticked by default, written by the host; untick and tick again
  $('settingsBtn').click(); await sleep(300);
  const sw = $('stStart'); sw.checked = false; sw.dispatchEvent(new Event('change', { bubbles: true })); await sleep(500);
  sw.checked = true; sw.dispatchEvent(new Event('change', { bubbles: true })); await sleep(500);
  $('settingsDlg').close(); await sleep(200);
  check('start at login kept on', (await window.rf.meta()).settings.startWithWindows, true);
} catch (e) { console.log(`E2E ERROR ${e.message}`); }
