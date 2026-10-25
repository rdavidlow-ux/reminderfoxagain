// E2E (runs inside the alarm window): snooze amount/unit controls.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
try {
  const card = document.querySelector('.card');
  const amt = card.querySelector('[data-act=snoozeAmount]');
  const unit = card.querySelector('[data-act=snoozeUnit]');
  const btn = card.querySelector('[data-act=snooze]');
  check('defaults', RF.snooze.label(amt.value, unit.value), '10 minutes');
  check('footer', document.getElementById('snoozeAll').textContent, 'Snooze all 10 minutes');
  const set = (v, u) => { amt.value = v; if (u) unit.value = u; amt.dispatchEvent(new Event('input', { bubbles: true })); };
  const states = [];
  for (const [v, u] of [['0', 'minutes'], ['abc', 'minutes'], ['1000', 'seconds'], ['45', 'seconds'], ['2', 'hours']]) { set(v, u); states.push(btn.disabled ? 'off' : 'on'); }
  check('Snooze button for 0, abc, 1000, 45 s, 2 h', states.join(','), 'off,off,off,on,on');
  set('abc');
  check('bad amount marked', amt.classList.contains('bad'), true);
  set('45', 'seconds');
  check('good amount not marked', amt.classList.contains('bad'), false);
  const kids = [...card.querySelector('.actions').children].filter((el) => el.offsetWidth > 0);
  const tops = new Set(kids.map((el) => Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)));
  check('controls on one row', tops.size === 1 ? 'yes' : `no (${tops.size} rows)`, 'yes');
  // snooze until a time of day
  unit.value = 'until'; unit.dispatchEvent(new Event('change', { bubbles: true })); await sleep(100);
  check('until: time box', amt.classList.contains('at') && /^\d\d:00$/.test(amt.value), true);
  const rowsUntil = new Set([...card.querySelector('.actions').children].filter((el) => el.offsetWidth > 0).map((el) => Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)));
  check('until: controls on one row', rowsUntil.size === 1 ? 'yes' : `no (${rowsUntil.size} rows)`, 'yes');
  const inMin = (txt) => { amt.value = txt; amt.dispatchEvent(new Event('input', { bubbles: true })); const s = RF.snooze.untilSeconds(txt); return btn.disabled ? 'off' : Math.round(s / 60); };
  const soon = new Date(Date.now() + 90 * 60000);
  check('until in 90 minutes', Math.abs(inMin(`${RF.pad(soon.getHours())}:${RF.pad(soon.getMinutes())}`) - 90) <= 1, true);
  check('until rejects nonsense', inMin('25:99'), 'off');
  unit.value = 'seconds'; unit.dispatchEvent(new Event('change', { bubbles: true })); await sleep(100);
  check('back to a number', amt.classList.contains('at'), false);
  set('45', 'seconds');
  console.log('E2E clicking Snooze (45 seconds): the window closes when nothing else is due');
  btn.click();
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
