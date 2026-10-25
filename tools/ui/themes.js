// E2E: every theme applies, text contrast is readable (AAA 7:1 for high contrast, AA 4.5:1 otherwise),
// and starred items use a colour of their own in the list, the month grid and the agenda.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(rgb(a)); const y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const col = (el, p = 'color') => getComputedStyle(el)[p];
const bgOf = (el) => { for (; el; el = el.parentElement) { const c = getComputedStyle(el).backgroundColor; const a = (c.match(/[\d.]+/g) || [])[3]; if (c && c !== 'transparent' && a !== '0') return c; } return 'rgb(255,255,255)'; };
try {
  check('theme count (Default + 5)', RF.THEMES.length, 6);
  for (const t of RF.THEMES) {
    await window.rf.setSettings({ theme: t.id });
    await sleep(500);
    await window.__rf.setTab('reminders'); await sleep(400);
    const name = t.id || 'default';
    check(`${name}: applied`, document.documentElement.dataset.theme || '', t.id);
    const need = t.id === 'contrast' ? 7 : 4.5;
    const bg = bgOf(document.body);
    const trs = [...document.querySelectorAll('#listView tbody tr[data-key]')];
    const imp = trs.find((tr) => tr.classList.contains('important') && !tr.classList.contains('done') && !tr.classList.contains('today'));
    const plain = trs.find((tr) => !tr.classList.contains('important') && !tr.classList.contains('done') && !tr.classList.contains('today') && !tr.classList.contains('past'));
    const cellBg = bgOf(imp.querySelector('td.c-desc'));
    const tPlain = col(plain.querySelector('.t')); const tImp = col(imp.querySelector('.t'));
    check(`${name}: body text contrast >= ${need}`, ratio(col(document.body), bg) >= need, true);
    check(`${name}: starred title contrast >= ${need}`, ratio(tImp, cellBg) >= need, true);
    check(`${name}: starred rows in their own colour`, tImp !== tPlain && tImp !== col(document.querySelector('.tab[aria-selected=true]')), true);
    await window.__rf.setTab('month'); await sleep(500);
    const ev = document.querySelector('#monthGrid .ev.important'); const evPlain = document.querySelector('#monthGrid .ev:not(.important):not(.allday):not(.todo)');
    check(`${name}: starred month chips differ`, !!ev && col(ev, 'backgroundColor') !== col(evPlain, 'backgroundColor'), true);
  }
  const ag = document.querySelector('#agenda .item.important');
  check('agenda marks starred items', !!ag, true);
  await window.rf.setSettings({ theme: '' });
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
