'use strict';
/* global RF */
// ReminderFoxAgain alarm window: one card per due alarm.
(function () {
  const { fmt, esc, snooze } = RF;
  const $ = (id) => document.getElementById(id);
  const list = $('list');
  let alarms = [];
  let settings = {};
  const typed = new Map(); // key → {amount, unit} typed by the user while the alarm stays in the list

  const overdue = (a) => (a.carried ? ` · <span title="Reminds you every day until you tick Done">overdue since ${esc(fmt.date(a.overdueSince))}</span>` : '');
  function whenHtml(a, now = Date.now()) {
    const day = fmt.relDay(a.start);
    if (a.quick) return { late: false, html: `<b>Quick alarm</b> · set for ${esc(fmt.time(a.start))}` };
    // a to-do: the date is when it's due by
    if (a.kind === 'todo') {
      if (a.start == null) return { late: false, html: '<b>To-do</b> · no due date' };
      const t0 = RF.startOfDay(new Date(now)).getTime();
      const late = a.allDay ? a.start < t0 : a.start < now;
      const due = `${fmt.relDay(a.start)}${a.allDay ? '' : `, ${fmt.time(a.start)}`}`;
      return { late, html: `<b>To-do</b> · due by ${esc(due)}${late ? ' · overdue' : ''}` };
    }
    if (a.allDay) return { late: !!a.carried, html: `<b>${esc(day)}</b> · all day${overdue(a)}` };
    const late = a.start < now - 60000;
    const rel = late ? `started ${fmt.rel(a.start, now)}` : fmt.rel(a.start, now);
    return { late: late || !!a.carried, html: `<b>${esc(day)}, ${esc(fmt.time(a.start))}</b> · ${esc(rel)}${overdue(a)}` };
  }
  function defaults() { return snooze.fromSettings(settings); }

  function card(a) {
    const w = whenHtml(a);
    const t = typed.get(a.key) || defaults();
    const metaLines = [a.location ? `📍 ${a.location}` : '', a.notes || ''].filter(Boolean).join('\n');
    const units = [...Object.keys(snooze.UNITS), 'until'].map((u) => `<option value="${u}"${u === t.unit ? ' selected' : ''}>${u === 'until' ? 'until…' : u}</option>`).join('');
    const until = t.unit === 'until';
    return `<div class="card${a.important ? ' important' : ''}" data-key="${esc(a.key)}">` +
      `<h2>${a.important ? '<span class="star">★</span>' : ''}<span translate="no">${esc(a.summary || 'Reminder')}</span></h2>` +
      `<div class="when${w.late ? ' late' : ''}">${w.html}</div>` +
      (metaLines ? `<div class="meta" translate="no">${esc(metaLines)}</div>` : '') +
      '<div class="actions"><span class="snooze">' +
      `<input class="inp amount${until ? ' at' : ''}" data-act="snoozeAmount" type="text" inputmode="${until ? 'text' : 'numeric'}" maxlength="${until ? 8 : 3}" value="${esc(t.amount)}"${until ? ' placeholder="15:30"' : ''} aria-label="Snooze for how many, or until what time" title="${until ? 'A time such as 15:30 or 3:30 pm (earlier than now means tomorrow)' : 'A whole number from 1 to 999'}">` +
      `<select class="sel" data-act="snoozeUnit" aria-label="Snooze unit">${units}</select>` +
      '<button class="btn" data-act="snooze">Snooze</button></span>' +
      '<span class="spacer"></span>' +
      '<button class="btn ghost" data-act="open" title="Open in ReminderFoxAgain">Open</button>' +
      `<button class="btn ghost" data-act="complete" title="${a.quick ? 'Finished with this quick alarm' : 'Mark completed'}">Done</button>` +
      '<button class="btn primary" data-act="dismiss">Dismiss</button></div></div>';
  }
  function secondsFor(c) {
    const amt = c.querySelector('[data-act=snoozeAmount]').value;
    const unit = c.querySelector('[data-act=snoozeUnit]').value;
    return unit === 'until' ? snooze.untilSeconds(amt) : snooze.seconds(amt, unit);
  }
  function validate(c) {
    const amt = c.querySelector('[data-act=snoozeAmount]');
    const ok = secondsFor(c) != null;
    amt.classList.toggle('bad', !ok);
    c.querySelector('[data-act=snooze]').disabled = !ok;
    return ok;
  }
  function render() {
    const n = alarms.length;
    $('title').textContent = n > 1 ? `${n} reminders` : 'Reminder';
    const keys = alarms.map((a) => a.key).join('\n');
    if (list.dataset.keys !== keys) {
      for (const k of [...typed.keys()]) if (!alarms.some((a) => a.key === k)) typed.delete(k);
      list.innerHTML = alarms.map(card).join('');
      list.dataset.keys = keys;
      for (const c of list.querySelectorAll('.card')) validate(c);
    } else refreshWhen();
    const d = defaults();
    const label = snooze.label(d.amount, d.unit);
    $('snoozeAll').textContent = `Snooze all ${label}`;
    $('snoozeAll').title = 'Snooze every reminder here for your default snooze time (change it in Settings)';
  }
  function refreshWhen() {
    const now = Date.now();
    for (const c of list.querySelectorAll('.card')) {
      const a = alarms.find((x) => x.key === c.dataset.key);
      if (!a) continue;
      const w = whenHtml(a, now);
      const el = c.querySelector('.when');
      el.innerHTML = w.html;
      el.classList.toggle('late', w.late);
    }
  }
  // sound: the chosen file or built-in sound, optionally repeated every few minutes while alarms are showing, or
  // continuously (resoundMinutes -1) until you snooze, open, finish or dismiss an alarm or hide the window
  let soundUrl = null; let soundFor = null; let resound = null;
  let looping = false; // the continuous sound is playing
  async function loadSound() {
    const want = settings.alarmTone === 'file' ? settings.soundFile : null;
    if (soundFor === want) return;
    soundFor = want;
    soundUrl = want ? await window.rf.soundData().catch(() => null) : null;
  }
  const continuous = () => Number(settings.resoundMinutes) === -1;
  const soundOn = () => settings.alarmSound !== false && alarms.length > 0;
  async function ring() {
    if (!soundOn()) return;
    await loadSound();
    if (!continuous()) { RF.playSound(soundUrl, settings.alarmTone); return; }
    if (looping) return;
    looping = true;
    window.__rfRinging = true;
    while (looping && soundOn() && continuous()) {
      await RF.playSound(soundUrl, settings.alarmTone);
      if (!looping) break;
      await new Promise((r) => setTimeout(r, 1200));
    }
    looping = false;
    window.__rfRinging = false;
  }
  // you dealt with an alarm (or hid the window): the continuous sound stops; the next new alarm starts it again
  function silence() {
    if (!looping) return;
    looping = false;
    window.__rfRinging = false;
    RF.stopSound();
  }
  function armResound() {
    clearInterval(resound);
    const m = Number(settings.resoundMinutes) || 0;
    if (m > 0 && alarms.length) resound = setInterval(ring, m * 60000);
    if (!alarms.length || !continuous() || settings.alarmSound === false) silence();
  }
  function update(p, doRing) {
    const before = alarms.length;
    alarms = (p && p.alarms) || [];
    settings = (p && p.settings) || settings;
    RF.applyTheme(settings.theme || '', settings.customThemes);
    RF.setFormats(settings);
    render();
    if (doRing) ring();
    if (doRing || !before !== !alarms.length || p.settings) armResound();
  }
  const call = (p) => p.catch((e) => console.error(e));

  async function doSnooze(c) {
    if (!validate(c)) return;
    await call(window.rf.snooze(c.dataset.key, secondsFor(c)));
  }
  // switching to "until…" turns the amount box into a time box (and back)
  list.addEventListener('change', (e) => {
    if (!e.target.matches('[data-act=snoozeUnit]')) return;
    const c = e.target.closest('.card');
    const amt = c.querySelector('[data-act=snoozeAmount]');
    const until = e.target.value === 'until';
    const was = amt.classList.contains('at');
    if (until !== was) {
      amt.classList.toggle('at', until);
      amt.maxLength = until ? 8 : 3;
      amt.inputMode = until ? 'text' : 'numeric';
      amt.placeholder = until ? '15:30' : '';
      if (until) { const d = new Date(Date.now() + 3600000); amt.value = `${RF.pad(d.getHours())}:00`; } else amt.value = String(defaults().amount);
      amt.title = until ? 'A time such as 15:30 or 3:30 pm (earlier than now means tomorrow)' : 'A whole number from 1 to 999';
      typed.set(c.dataset.key, { amount: amt.value, unit: e.target.value });
      validate(c);
      if (until) amt.select();
    }
  });
  list.addEventListener('input', (e) => {
    const c = e.target.closest('.card');
    if (!c) return;
    typed.set(c.dataset.key, { amount: c.querySelector('[data-act=snoozeAmount]').value, unit: c.querySelector('[data-act=snoozeUnit]').value });
    validate(c);
  });
  list.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-act=snoozeAmount]')) { e.preventDefault(); doSnooze(e.target.closest('.card')); }
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const c = b.closest('.card');
    const key = c.dataset.key;
    const act = b.dataset.act;
    if (act !== 'snooze' || validate(c)) silence();
    if (act === 'snooze') doSnooze(c);
    else if (act === 'open') call(window.rf.openAlarm(key));
    else if (act === 'complete') call(window.rf.completeAlarm(key));
    else if (act === 'dismiss') call(window.rf.dismiss(key));
  });
  $('snoozeAll').addEventListener('click', async () => {
    silence();
    const d = defaults();
    const s = snooze.seconds(d.amount, d.unit) || 600;
    for (const a of [...alarms]) await call(window.rf.snooze(a.key, s));
  });
  $('dismissAll').addEventListener('click', () => { silence(); call(window.rf.dismissAll()); });
  $('hide').addEventListener('click', () => { silence(); call(window.rf.hideAlarm()); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { silence(); call(window.rf.hideAlarm()); } });
  // Enter in a snooze box snoozes, which also counts as dealing with the alarm
  list.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-act=snoozeAmount]') && validate(e.target.closest('.card'))) silence(); }, true);

  window.rf.on('alarms:update', (p) => update(p, false));
  window.rf.on('alarms:ring', () => { ring(); armResound(); });
  window.__rfAlarm = { ring, silence }; // for the UI checks
  setInterval(refreshWhen, 30000);
  window.rf.alarmState().then((p) => update(p, true)).catch((e) => console.error(e));
})();
