// E2E (0.8.1, bills sample): Show completed keeps your place in the list; a day picked in the calendar panel starts
// the Reminders list there; your own themes (new, live preview, contrast warnings, save, cancel, delete).
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const R = window.__rf; const X = window.__rfx;
const change = async (el, v, ms = 600) => { if (v !== undefined) { if (el.type === 'checkbox') el.checked = v; else el.value = v; } el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(ms); };
const lv = $('listView');
const head = () => { const th = lv.querySelector('thead th'); return th ? th.getBoundingClientRect().height : 0; };
// the first row at least half below the column headings
function firstRow() {
  const top = lv.getBoundingClientRect().top + head();
  return [...lv.querySelectorAll('tbody tr[data-key]')].find((tr) => tr.getBoundingClientRect().top + tr.offsetHeight / 2 > top) || null;
}
const dayOf = (tr) => RF.dayKey(Number(tr.dataset.sort));
try {
  // ---------- Show completed keeps your place
  await R.setTab('reminders');
  await change($('remFilter'), 'all', 900);
  const t0 = RF.startOfDay(new Date());
  const aim = RF.dayKey(RF.addDays(t0, 40));
  R.scrollToDay(aim); await sleep(300);
  const before = firstRow();
  check('scrolled to a day 40 days ahead', before && dayOf(before) >= aim, true);
  const doneAbove = [...lv.querySelectorAll('tbody tr.done')].length;
  check('ticked rows above it (bills paid in the past months)', doneAbove > 5, true);
  const key = before.dataset.key; const day = dayOf(before);
  await change($('remDone'), false, 900);
  const afterOff = firstRow();
  check('unticking Show completed keeps the same row at the top', afterOff && afterOff.dataset.key, key);
  await change($('remDone'), true, 900);
  const afterOn = firstRow();
  check('ticking it again keeps it too', afterOn && afterOn.dataset.key, key);
  check('…on the same day', afterOn && dayOf(afterOn), day);
  // a ticked row at the top goes away: the next row takes its place, not a year away
  const firstDone = lv.querySelector('tbody tr.done');
  lv.scrollTop = firstDone.getBoundingClientRect().top - lv.getBoundingClientRect().top + lv.scrollTop - head(); await sleep(200);
  const top = firstRow();
  check('a ticked row at the top', top.classList.contains('done'), true);
  const topDay = Number(top.dataset.sort);
  await change($('remDone'), false, 900);
  const next = firstRow();
  check('…is replaced by the next one after it', next && Number(next.dataset.sort) >= topDay && !next.classList.contains('done'), true);
  check('…within weeks, not a year', next && (Number(next.dataset.sort) - topDay) / 86400000 < 120, true);
  await change($('remDone'), true, 700);
  // ---------- a day picked in the mini calendar starts the Reminders list there
  await change($('remFilter'), 'upcoming', 900);
  const pick = async (k) => {
    for (let i = 0; i < 3 && !document.querySelector(`#mcal [data-day="${k}"]`); i++) { document.querySelector('#mcal [data-cal=next]').click(); await sleep(400); }
    document.querySelector(`#mcal [data-day="${k}"]`).click(); await sleep(500);
  };
  const k1 = RF.dayKey(RF.addDays(t0, 12));
  await pick(k1);
  const f1 = firstRow();
  check('Upcoming: the first row is on or after the picked day', f1 && dayOf(f1) >= k1, true);
  const rows = [...lv.querySelectorAll('tbody tr[data-key]')];
  const i1 = rows.indexOf(f1);
  check('…and the row above it is before that day', i1 > 0 && dayOf(rows[i1 - 1]) < k1, true);
  check('the day is selected in the calendar', R.S.selDay, k1);
  await change($('remFilter'), 'past', 900);
  await pick(k1);
  check('Past: a future day shows the end of the list', Math.abs(lv.scrollTop - (lv.scrollHeight - lv.clientHeight)) <= 2, true);
  await change($('remFilter'), 'day', 900);
  await pick(k1);
  check('Selected day still lists just that day', [...lv.querySelectorAll('tbody tr[data-key]')].every((tr) => dayOf(tr) === k1), true);
  await change($('remFilter'), 'upcoming', 700);
  // ---------- your own themes
  $('settingsBtn').click(); await sleep(300); X.showPanel('general');
  check('Edit and Delete off for a built-in theme', `${$('stThemeEdit').disabled} ${$('stThemeDel').disabled}`, 'true true');
  $('stThemeNew').click(); await sleep(400);
  const d = $('themeDlg');
  check('New theme opens', `${d.open} ${d.querySelector('h2').textContent}`, 'true New theme');
  check('five colours', d.querySelectorAll('input[type=color]').length, 5);
  const setHex = async (k, v) => { const el = d.querySelector(`[data-hex=${k}]`); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); await sleep(100); };
  await setHex('bg', '#0f1f14'); await setHex('surface', '#16301f'); await setHex('ink', '#e8f5e9'); await setHex('accent', '#43a047'); await setHex('star', '#ffca28');
  const css = (v) => document.documentElement.style.getPropertyValue(v).trim();
  check('the window shows it while editing', `${document.documentElement.dataset.theme} ${css('--fox')} ${css('color-scheme')}`, 'custom #43a047 dark');
  check('colours worked out from the five', /^#[0-9a-f]{6}$/.test(css('--line')) && css('--line') !== css('--surface'), true);
  check('no warning for readable colours', d.querySelector('#thWarn').textContent, '');
  await setHex('ink', '#203528');
  check('hard-to-read text is pointed out', /hard to read/.test(d.querySelector('#thWarn').textContent), true);
  await setHex('ink', '#e8f5e9');
  const bad = d.querySelector('[data-hex=star]'); bad.value = '#12'; bad.dispatchEvent(new Event('input', { bubbles: true })); await sleep(100);
  check('a bad colour code is marked and ignored', `${bad.classList.contains('bad')} ${css('--imp')}`, 'true #ffca28');
  d.querySelector('#thSave').click(); await sleep(400);
  check('a name is needed', d.open, true);
  d.querySelector('#thName').value = 'Dark';
  d.querySelector('#thSave').click(); await sleep(400);
  check('a built-in name is refused', d.open, true);
  d.querySelector('#thName').value = 'Forest';
  d.querySelector('#thSave').click(); await sleep(800);
  const st = (await window.rf.meta()).settings;
  check('saved and chosen', `${d.open} ${st.customThemes.length} ${st.customThemes[0].name} ${st.theme === `custom:${st.customThemes[0].id}`}`, 'false 1 Forest true');
  check('listed under Your themes', [...$('stTheme').querySelectorAll('optgroup option')].map((o) => o.textContent).join(), 'Forest');
  check('a swatch for it', !!$('stThemeSw').querySelector(`[data-theme-id="custom:${st.customThemes[0].id}"]`), true);
  check('Edit and Delete on for your theme', `${$('stThemeEdit').disabled} ${$('stThemeDel').disabled}`, 'false false');
  // edit, then cancel: the theme comes back as it was
  $('stThemeEdit').click(); await sleep(400);
  check('Edit shows its colours', d.querySelector('[data-hex=accent]').value, '#43a047');
  await setHex('accent', '#ff0000');
  check('preview while editing', css('--fox'), '#ff0000');
  d.querySelector('[data-x]').click(); await sleep(400);
  check('Cancel puts it back', css('--fox'), '#43a047');
  // a built-in theme clears the custom colours
  await change($('stTheme'), 'ocean', 500);
  check('a built-in theme again', `${document.documentElement.dataset.theme} ${css('--fox')}`, 'ocean ');
  await change($('stTheme'), `custom:${st.customThemes[0].id}`, 500);
  check('your theme again', css('--fox'), '#43a047');
  // delete it
  $('stThemeDel').click(); await sleep(300);
  check('asks first, Cancel focused', `${$('cfTitle').textContent} ${document.activeElement.textContent}`, 'Delete theme? Cancel');
  $('cfFoot').querySelector('.btn.danger').click(); await sleep(700);
  const st2 = (await window.rf.meta()).settings;
  check('deleted, back to Default', `${st2.customThemes.length} "${st2.theme}" ${document.documentElement.dataset.theme || 'none'} "${css('--fox')}"`, '0 "" none ""');
  $('settingsDlg').close();
} catch (e) { console.log(`E2E ERROR ${e.message}`); }
