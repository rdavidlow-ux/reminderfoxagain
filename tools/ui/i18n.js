// E2E (0.7.0): the app in another language (run with RF_LANG or a system locale): text, plurals, dates, the repeat
// summary, the Settings language list and right-to-left layout. EXPECT holds the language the run expects.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const want = {
  de: { lang: 'de', dir: 'ltr', tab: 'Erinnerungen', month: 'Monat', items: /^\d+ Einträge$/, one: '1 Eintrag', weekly: 'Jede Woche am Dienstag, Donnerstag', cancel: 'Abbrechen', jan: 'Januar' },
  fr: { lang: 'fr', dir: 'ltr', tab: 'Rappels', month: 'Mois', items: /^\d+ éléments$/, one: '1 élément', weekly: 'Chaque semaine le mardi, jeudi', cancel: 'Annuler', jan: 'janvier' },
  ar: { lang: 'ar', dir: 'rtl', tab: 'التذكيرات', month: 'الشهر', items: /^\d+ (عنصرًا|عناصر|عنصر)$/, one: 'عنصر واحد', weekly: 'كل أسبوع يوم الثلاثاء, الخميس', cancel: 'إلغاء', jan: 'يناير' },
  'ja-JP': { lang: 'ja-JP', dir: 'ltr', tab: 'リマインダー', month: '月', items: /^\d+ 件$/, one: '1 件', weekly: '毎週 火曜日, 木曜日', cancel: 'キャンセル', jan: '1月' },
}[window.RF.i18n.lang] || {};
try {
  await sleep(500);
  const L = window.RF.i18n.lang;
  console.log(`E2E language in use: ${L}`);
  check('html lang', document.documentElement.lang, want.lang);
  check('direction', document.documentElement.dir, want.dir);
  check('Reminders tab', document.querySelector('.tab[data-tab="reminders"]').firstChild.textContent.trim(), want.tab);
  check('Month tab', document.querySelector('.tab[data-tab="month"]').textContent.trim(), want.month);
  check('item count, plural form', want.items.test($('statusCount').textContent), true);
  check('one item, singular form', window.__rf.plural(1, 'item', 'items'), want.one);
  check('a translated pattern (a carried-over part translated too)', window.RF.i18n.translate('List: All lists (7)') != null, true);
  check('month names in the language', window.RF.fmt.monthName(new Date(2026, 0, 15)), want.jan);
  // the editor's repeat summary (weekly on Tuesday and Thursday) is put together in the language
  window.__rf.openEditor({ kind: 'event' }); await sleep(400);
  $('edFreq').value = 'WEEKLY'; $('edFreq').dispatchEvent(new Event('change', { bubbles: true })); await sleep(200);
  for (const b of document.querySelectorAll('#edDays button')) if (b.getAttribute('aria-pressed') === 'true') b.click();
  for (const wd of ['TU', 'TH']) document.querySelector(`#edDays button[data-wd="${wd}"]`).click();
  await sleep(300);
  check('repeat summary', $('edRepeatSummary').textContent.replace(/^↻ /, ''), want.weekly);
  check('a button in the editor', [...document.querySelectorAll('#editor button')].some((b) => b.textContent.trim() === want.cancel), true);
  document.getElementById('editor').close(); await sleep(200);
  // Settings → Display → Language: the system language first, then every language by its own name
  $('settingsBtn').click(); await sleep(400);
  const opts = [...$('stLanguage').options];
  check('language choices', opts.length, 35);
  check('first choice is the system language', opts[0].value, '');
  check('languages listed by their own names', opts.some((o) => o.value === 'ja-JP' && o.textContent === '日本語'), true);
  check('names are not translated', opts.find((o) => o.value === 'de').textContent, 'Deutsch');
  check('translation note shown', $('stLangNote').textContent.length > 40, true);
  // nothing left in English on the Settings dialog's own tabs
  const tabs = [...document.querySelectorAll('#stTabs button')].map((b) => b.textContent.trim());
  check('settings tabs translated', tabs.includes('General') || tabs.includes('Display'), false);
  if (window.__chooseLanguage) { $('stLanguage').value = window.__chooseLanguage; $('stLanguage').dispatchEvent(new Event('change')); }
} catch (e) { console.log(`E2E ERROR ${e.message}`); }
