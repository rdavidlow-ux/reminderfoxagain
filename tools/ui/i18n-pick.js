// E2E (0.7.0): picking a language in Settings → Display saves it; the windows reload in that language (i18n.js checks
// the next start, which runs on the same data).
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
try {
  await sleep(500);
  check('starts in the system language', window.RF.i18n.lang, 'en');
  $('settingsBtn').click(); await sleep(400);
  check('system language selected', $('stLanguage').value, '');
  check('system language named', $('stLanguage').options[0].textContent, 'System language (English)');
  await sleep(300); // let the lines above reach the log: choosing a language reloads the window
  $('stLanguage').value = 'ja-JP';
  $('stLanguage').dispatchEvent(new Event('change'));
} catch (e) { console.log(`E2E ERROR ${e.message}`); }
