// E2E TB (a brand-new installation, with the original ReminderFox add-on's file in the profile): the welcome page
// offers that file on its own, found by the add-on's experiment, and imports it with the add-on's list names; Settings →
// Data → Import from ReminderFox… finds it too.  Run: run.js --sample empty --rffile tb-welcome.js
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(200); } return false; };
try {
  await until(() => document.querySelector('.welcome'));
  check('a new installation shows the welcome page', !!document.querySelector('.welcome'), true);
  const old = document.querySelector('.welcome .opt[data-w=old]');
  check('the ReminderFox file is offered on its own', old ? old.querySelector('b').textContent : 'missing', 'Import from your ReminderFox add-on');
  check('… with where it was found', !!old && old.textContent.includes('/reminderfox/reminderfox.ics'), true);
  check('choosing another file is still there', !!document.querySelector('.welcome .opt[data-w=pick]'), true);
  old.click();
  await until(() => $('importDlg') && $('importDlg').open);
  check('the import dialog opens with it', $('importDlg') && $('importDlg').open ? $('importDlg').querySelector('b').textContent : 'not open', 'reminderfox.ics');
  $('imGo').click();
  await until(async () => (await window.rf.meta()).count > 0);
  const m = await window.rf.meta();
  check('its reminders and list items are imported', m.count > 0, true);
  check('… with the add-on\'s list names', ['Errands', 'Home', 'Movies to see', 'Gift ideas'].every((l) => (m.settings.lists || []).includes(l)), true);
  await sleep(800);
  check('the welcome page is gone', !document.querySelector('.welcome'), true);
  // Settings → Data → Import from ReminderFox…: the file found, as on the desktop
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  check('its tooltip', $('stOldRf').title, 'Find the reminderfox.ics the ReminderFox add-on kept in your Firefox or Thunderbird profile');
  $('stOldRf').click();
  await until(() => $('confirm').open);
  check('Import from ReminderFox… lists the file found', /Found 1 file from the ReminderFox add-on/.test($('cfBody').textContent) && $('cfBody').textContent.includes('reminderfox.ics'), true);
  check('… to import or choose another', [...$('cfFoot').querySelectorAll('button')].map((b) => b.textContent).join(' | '), 'Cancel | Choose another file… | Import newest');
  [...$('cfFoot').querySelectorAll('button')].find((b) => b.textContent === 'Cancel').click();
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
