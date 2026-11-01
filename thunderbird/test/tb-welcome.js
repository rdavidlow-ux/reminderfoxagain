// E2E TB (a brand-new installation): the welcome page has its own option for the ReminderFox add-on's file; it says
// where the file is, then opens the file picker (which takes prefs.js too), as Settings → Data → Import from
// ReminderFox… does.  Run: run.js --sample empty tb-welcome.js
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(200); } return false; };
try {
  await until(() => document.querySelector('.welcome'));
  check('a new installation shows the welcome page', !!document.querySelector('.welcome'), true);
  const opts = () => [...document.querySelectorAll('.welcome .opt')].map((o) => o.querySelector('b').textContent);
  check('its options', opts().join(' | '), 'Import from your ReminderFox add-on | Import a reminderfox.ics or other calendar file… | Start with an empty list');
  let picked = null;
  const pickClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () { if (this.type === 'file') { picked = this.accept; return; } return pickClick.call(this); };
  document.querySelector('.welcome .tb-old').click(); await sleep(500);
  check('the ReminderFox option says where the file is', !!$('confirm').open && /reminderfox folder of your Thunderbird or Firefox profile/.test($('cfBody').textContent), true);
  check('… nothing picked yet', picked, null);
  [...$('cfFoot').querySelectorAll('button')].find((b) => b.textContent === 'Choose the file…').click(); await sleep(600);
  HTMLInputElement.prototype.click = pickClick;
  check('"Choose the file…" opens the picker for .ics and prefs.js', !!picked && /\.ics/.test(picked) && /\.js/.test(picked), true);
  check('the welcome page stays until a file is imported', !!document.querySelector('.welcome .tb-old'), true);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
