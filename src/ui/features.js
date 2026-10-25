'use strict';
/* global RF */
// ReminderFoxAgain: the settings panels and the dialogs for the features that came back from the add-on —
// quick alarms, suspending alarms, views, to-do lists, categories, go to date, backups and restore.
// app.js runs first and exposes window.__rf; this file registers window.__rfx, which app.js calls.
(function () {
  const A = window.__rf;
  const { fmt, esc, dayKey, parseKey, pad } = RF;
  const $ = (id) => document.getElementById(id);
  const S = A.S;
  const DEFAULT_LIST = A.DEFAULT_LIST;
  const plural = A.plural;
  const DEFAULT_LABELS = { todayLabel: '[time]  [reminderDesc]', upcomingLabel: '[shortMonth] [date]  [reminderDesc]' };
  const COMMON_CATEGORIES = ['Anniversary', 'Appointment', 'Birthday', 'Business', 'Call', 'Holiday', 'Meeting', 'Personal', 'Shopping', 'Travel'];

  // ------------------------------------------------------------ dialog helper
  // One <dialog> per id, so dialogs can open on top of each other (a view's editor over the views list).
  function dlg(id, { title, body, foot, cls = 'small' }) {
    let d = $(id);
    if (!d) {
      d = document.createElement('dialog');
      d.id = id;
      document.body.appendChild(d);
    }
    d.innerHTML = `<form class="dlg ${cls}" method="dialog" autocomplete="off"><div class="dlg-head"><h2>${esc(title)}</h2></div>` +
      `<div class="dlg-body">${body}</div><div class="dlg-foot">${foot}</div></form>`;
    d.querySelector('form').addEventListener('submit', (e) => e.preventDefault());
    for (const b of d.querySelectorAll('[data-x]')) b.addEventListener('click', () => d.close());
    return d;
  }
  const q = (d, sel) => d.querySelector(sel);
  const nowTime = (ms) => { const t = new Date(ms); return `${pad(t.getHours())}:${pad(t.getMinutes())}`; };
  function whenText(ms) {
    const sameDay = dayKey(ms) === dayKey(Date.now());
    return sameDay ? RF.T('today at {time}', { time: fmt.time(ms) }) : `${fmt.long(ms)}, ${fmt.time(ms)}`;
  }
  function untilText(ms) {
    const mins = Math.round((ms - Date.now()) / 60000);
    if (mins < 1) return RF.T('in less than a minute');
    if (mins < 60) return RF.T('in {time}', { time: plural(mins, 'minute', 'minutes') });
    const h = Math.floor(mins / 60); const m = mins % 60;
    if (h < 48) return m ? RF.T('in {hours} {minutes}', { hours: plural(h, 'hour', 'hours'), minutes: plural(m, 'minute', 'minutes') }) : RF.T('in {time}', { time: plural(h, 'hour', 'hours') });
    return RF.T('in {time}', { time: plural(Math.round(h / 24), 'day', 'days') });
  }
  const UNIT_MS = { minutes: 60000, hours: 3600000, days: 86400000 };
  const wholeNumber = (v, max) => { const s = String(v).trim(); if (!/^\d{1,4}$/.test(s)) return null; const n = Number(s); return n >= 1 && n <= max ? n : null; };

  // ------------------------------------------------------------ quick alarms
  async function openQuick() {
    const d = dlg('quickDlg', {
      title: 'Quick alarm',
      body: '<div class="note">A one-off alarm that isn\'t saved as a reminder — like the add-on\'s Quick Alarm.</div>' +
        '<div class="field"><label for="qaText">Alarm text</label><input class="inp" id="qaText" value="Quick alarm" maxlength="200"></div>' +
        '<div class="row"><label class="inline-chk"><input type="radio" name="qaMode" value="in" checked> In</label>' +
        '<input class="inp" id="qaN" type="text" inputmode="numeric" maxlength="3" value="10" style="width:60px;text-align:right" aria-label="How many">' +
        '<select class="sel" id="qaUnit" aria-label="Unit"><option value="minutes">minutes</option><option value="hours">hours</option><option value="days">days</option></select></div>' +
        '<div class="row"><label class="inline-chk"><input type="radio" name="qaMode" value="at"> At</label>' +
        '<input class="inp" id="qaTime" type="time" aria-label="Time"><input class="inp" id="qaDate" type="date" aria-label="Date"></div>' +
        '<div class="field"><label for="qaNotes">Notes</label><textarea class="inp" id="qaNotes" rows="2"></textarea></div>' +
        '<div class="summary-line" id="qaWhen"></div>' +
        '<h3 class="st-h">Waiting to go off</h3><div id="qaList" class="mini-list"></div>',
      foot: '<span class="spacer"></span><button type="button" class="btn" data-x>Close</button><button type="submit" class="btn primary" id="qaSet">Set alarm</button>',
    });
    const later = new Date(Date.now() + 30 * 60000);
    q(d, '#qaTime').value = nowTime(later.getTime());
    q(d, '#qaDate').value = dayKey(later);
    const mode = () => q(d, 'input[name=qaMode]:checked').value;
    function at() {
      if (mode() === 'in') {
        const n = wholeNumber(q(d, '#qaN').value, 999);
        return n == null ? null : Date.now() + n * UNIT_MS[q(d, '#qaUnit').value];
      }
      const t = q(d, '#qaTime').value; const day = q(d, '#qaDate').value;
      if (!t || !day) return null;
      const [h, m] = t.split(':').map(Number);
      const x = parseKey(day); x.setHours(h, m, 0, 0);
      return x.getTime();
    }
    function preview() {
      const a = at();
      q(d, '#qaN').classList.toggle('bad', mode() === 'in' && a == null);
      const el = q(d, '#qaWhen');
      if (a == null) { el.textContent = mode() === 'in' ? 'Enter a whole number from 1 to 999.' : 'Choose a time.'; el.classList.add('warn'); return; }
      if (a <= Date.now()) { el.textContent = 'That time has passed — choose a later one.'; el.classList.add('warn'); return; }
      el.classList.remove('warn');
      el.textContent = `Goes off ${whenText(a)} (${untilText(a)}).`;
    }
    for (const el of d.querySelectorAll('input,select')) { el.addEventListener('input', preview); el.addEventListener('change', preview); }
    q(d, '#qaTime').addEventListener('focus', () => { q(d, 'input[name=qaMode][value=at]').checked = true; preview(); });
    q(d, '#qaN').addEventListener('focus', () => { q(d, 'input[name=qaMode][value=in]').checked = true; preview(); });
    async function list() {
      const items = (await A.guard(window.rf.quickList())) || [];
      q(d, '#qaList').innerHTML = items.length ? items.map((x) => `<div class="mini-row"><span class="grow"><b>${esc(x.text)}</b> <span class="note">${esc(whenText(x.at))}</span></span>` +
        `<button type="button" class="btn ghost" data-cancel="${esc(x.id)}" title="Cancel this alarm">Cancel</button></div>`).join('') : '<div class="note">No quick alarms.</div>';
    }
    q(d, '#qaList').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-cancel]');
      if (!b) return;
      await A.guard(window.rf.quickRemove(b.dataset.cancel));
      A.toast('Quick alarm cancelled');
      await list();
    });
    q(d, '#qaSet').addEventListener('click', async () => {
      const a = at();
      if (a == null || a <= Date.now()) { preview(); return; }
      const r = await A.guard(window.rf.quickAdd({ text: q(d, '#qaText').value, notes: q(d, '#qaNotes').value, at: a }));
      if (!r) return;
      d.close();
      A.toast(`Quick alarm set for ${fmt.time(a)}${dayKey(a) === dayKey(Date.now()) ? '' : `, ${fmt.date(a)}`}`);
    });
    preview();
    await list();
    d.showModal();
    q(d, '#qaText').select();
  }

  // ------------------------------------------------------------ suspend alarms
  async function openSuspend() {
    const cur = await A.guard(window.rf.suspended());
    const d = dlg('suspendDlg', {
      title: 'Suspend alarms',
      body: (cur ? `<div class="box">Alarms are suspended${cur.until ? ` until ${esc(whenText(cur.until))}` : ' until you turn them back on'}.</div>` : '') +
        '<div class="note">While suspended, no alarm windows open and the reminder pop-up stays away. Alarms that fall due meanwhile show when you resume.</div>' +
        '<label class="inline-chk"><input type="radio" name="spMode" value="resume" checked> Until I turn them back on</label>' +
        '<div class="row"><label class="inline-chk"><input type="radio" name="spMode" value="for"> For</label>' +
        '<input class="inp" id="spN" type="text" inputmode="numeric" maxlength="3" value="1" style="width:60px;text-align:right" aria-label="How long">' +
        '<select class="sel" id="spUnit" aria-label="Unit"><option value="minutes">minutes</option><option value="hours" selected>hours</option><option value="days">days</option></select></div>' +
        '<div class="row"><label class="inline-chk"><input type="radio" name="spMode" value="until"> Until</label>' +
        '<input class="inp" id="spTime" type="time" aria-label="Time"><input class="inp" id="spDate" type="date" aria-label="Date"></div>' +
        '<div class="summary-line" id="spWhen"></div>',
      foot: (cur ? '<button type="button" class="btn" id="spResume">Resume alarms now</button>' : '') +
        '<span class="spacer"></span><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary" id="spGo">Suspend</button>',
    });
    const t = new Date(Date.now() + 2 * 3600000);
    q(d, '#spTime').value = nowTime(t.getTime());
    q(d, '#spDate').value = dayKey(t);
    const mode = () => q(d, 'input[name=spMode]:checked').value;
    function until() {
      if (mode() === 'resume') return null;
      if (mode() === 'for') { const n = wholeNumber(q(d, '#spN').value, 999); return n == null ? NaN : Date.now() + n * UNIT_MS[q(d, '#spUnit').value]; }
      const tm = q(d, '#spTime').value; const day = q(d, '#spDate').value;
      if (!tm || !day) return NaN;
      const [h, m] = tm.split(':').map(Number);
      const x = parseKey(day); x.setHours(h, m, 0, 0);
      return x.getTime();
    }
    function preview() {
      const u = until();
      const el = q(d, '#spWhen');
      const bad = Number.isNaN(u) || (u != null && u <= Date.now());
      el.classList.toggle('warn', bad);
      el.textContent = u == null ? 'Alarms stay off until you resume them (status bar, tray menu or here).'
        : Number.isNaN(u) ? 'Enter a whole number from 1 to 999, or a date and time.' : u <= Date.now() ? 'That time has passed.' : `Alarms come back on ${whenText(u)}.`;
      return !bad;
    }
    for (const el of d.querySelectorAll('input,select')) { el.addEventListener('input', preview); el.addEventListener('change', preview); }
    q(d, '#spN').addEventListener('focus', () => { q(d, 'input[name=spMode][value=for]').checked = true; preview(); });
    q(d, '#spTime').addEventListener('focus', () => { q(d, 'input[name=spMode][value=until]').checked = true; preview(); });
    q(d, '#spGo').addEventListener('click', async () => {
      if (!preview()) return;
      const u = until();
      const r = await A.guard(window.rf.suspend(u));
      if (r === undefined) return;
      S.meta.suspend = r;
      A.renderAlarmState();
      d.close();
      A.toast(u ? `Alarms suspended until ${fmt.time(u)}${dayKey(u) === dayKey(Date.now()) ? '' : `, ${fmt.date(u)}`}` : 'Alarms suspended');
    });
    const res = q(d, '#spResume');
    if (res) {
      res.addEventListener('click', async () => {
        S.meta.suspend = await A.guard(window.rf.suspend(0));
        A.renderAlarmState();
        d.close();
        A.toast('Alarms are on again');
      });
    }
    preview();
    d.showModal();
  }

  // ------------------------------------------------------------ views (saved searches, like the add-on's)
  const FIELDS = [['any', 'Anything'], ['summary', 'Description'], ['categories', 'Category'], ['notes', 'Notes'], ['location', 'Location']];
  const UNITS = [['D', 'days'], ['W', 'weeks'], ['M', 'months'], ['Y', 'years']];
  function describeView(v) {
    const parts = (v.criteria || []).filter((c) => String(c.value || '').trim()).map((c) => {
      const f = (FIELDS.find(([k]) => k === c.field) || FIELDS[0])[1];
      return `${f} ${c.field === 'categories' ? 'is' : 'contains'} ${String(c.value).split(',').map((x) => `“${x.trim()}”`).filter((x) => x !== '“”').join(' or ')}`;
    });
    if (v.date) {
      const u = (x) => { const w = (UNITS.find(([k]) => k === x.unit) || UNITS[0])[1]; return `${x.n} ${Number(x.n) === 1 ? w.slice(0, -1) : w}`; };
      parts.push(`dates from ${Number(v.date.from.n) < 0 ? `${u({ ...v.date.from, n: -v.date.from.n })} ago` : Number(v.date.from.n) === 0 ? 'today' : `${u(v.date.from)} ahead`} to ${Number(v.date.to.n) < 0 ? `${u({ ...v.date.to, n: -v.date.to.n })} ago` : Number(v.date.to.n) === 0 ? 'today' : `${u(v.date.to)} ahead`}`);
    }
    if (v.includeTodos) parts.push('with to-dos');
    return parts.length ? parts.join('; ') : 'Everything';
  }
  async function saveViews(views, keepName) {
    const curView = String(S.filter).startsWith('view:') ? (S.settings.views || [])[Number(S.filter.slice(5))] : null;
    const r = await A.setSetting({ views });
    if (!r) return false;
    const name = keepName || (curView && curView.name);
    if (String(S.filter).startsWith('view:') || keepName) {
      const i = views.findIndex((v) => v.name === name);
      S.filter = i >= 0 ? `view:${i}` : 'upcoming';
      try { localStorage.setItem('remFilter', S.filter); } catch (e) { /* ignore */ }
    }
    await A.refresh();
    return true;
  }
  function openViews() {
    const d = dlg('viewsDlg', {
      title: 'Manage reminders',
      body: '<div class="note">A saved filter shows just the reminders you want in the Reminders tab: pick it from the Show list. Conditions on different fields must all match; commas inside one condition mean “any of these”.</div>' +
        '<div id="vwList" class="mini-list"></div>',
      foot: '<button type="button" class="btn" id="vwNew">＋ New saved filter…</button><span class="spacer"></span><button type="button" class="btn primary" data-x>Done</button>',
      cls: '',
    });
    function render() {
      const views = S.settings.views || [];
      q(d, '#vwList').innerHTML = views.length ? views.map((v, i) => `<div class="mini-row" data-i="${i}"><span class="grow"><b>${esc(v.name)}</b><br><span class="note">${esc(describeView(v))}</span></span>` +
        `<button type="button" class="btn ghost" data-a="show" title="Show it in the Reminders tab">Show</button>` +
        `<button type="button" class="nav" data-a="up" title="Move up"${i ? '' : ' disabled'}>↑</button><button type="button" class="nav" data-a="down" title="Move down"${i < views.length - 1 ? '' : ' disabled'}>↓</button>` +
        '<button type="button" class="btn ghost" data-a="edit">Edit…</button><button type="button" class="btn ghost danger" data-a="del">Delete</button></div>').join('')
        : '<div class="note">No saved filters yet. Click “New saved filter…” to make one — for example every reminder with the category “Birthday” in the coming year.</div>';
    }
    q(d, '#vwList').addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const i = Number(b.closest('[data-i]').dataset.i);
      const views = [...(S.settings.views || [])];
      const a = b.dataset.a;
      if (a === 'edit') { if (await editView(i)) render(); return; }
      if (a === 'show') { d.close(); await showView(i); return; }
      if (a === 'del') {
        const ok = await A.confirmDlg('Delete saved filter?', `<div>${esc(RF.T('The saved filter “{s}” will be deleted. Your reminders are not changed.', { s: views[i].name }))}</div>`, [{ label: 'Cancel', value: false }, { label: 'Delete', cls: 'danger', value: true }]);
        if (!ok) return;
        views.splice(i, 1);
      } else {
        const j = i + (a === 'up' ? -1 : 1);
        if (j < 0 || j >= views.length) return;
        [views[i], views[j]] = [views[j], views[i]];
      }
      await saveViews(views);
      render();
    });
    q(d, '#vwNew').addEventListener('click', async () => { if (await editView(-1)) render(); });
    render();
    d.showModal();
  }
  async function showView(i) {
    S.filter = `view:${i}`;
    try { localStorage.setItem('remFilter', S.filter); } catch (e) { /* ignore */ }
    $('remFilter').value = S.filter;
    if (S.tab !== 'reminders') await A.setTab('reminders'); else await A.renderMain('enter');
  }
  function editView(i) {
    return new Promise((resolve) => {
      const views = S.settings.views || [];
      const v = i >= 0 ? JSON.parse(JSON.stringify(views[i])) : { name: '', criteria: [{ field: 'categories', value: '' }], date: null, includeTodos: false };
      const unitSel = (id, val) => `<select class="sel" id="${id}">${UNITS.map(([k, l]) => `<option value="${k}"${k === val ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
      const dt = v.date || { from: { n: 0, unit: 'D' }, to: { n: 1, unit: 'Y' } };
      const d = dlg('viewEdDlg', {
        title: i >= 0 ? 'Edit saved filter' : 'New saved filter',
        body: '<div class="field"><label for="veName">Name</label><input class="inp" id="veName" maxlength="60" placeholder="e.g. Birthdays"></div>' +
          '<div class="lbl">Show reminders where</div><div id="veCrit" class="crit"></div>' +
          '<div><button type="button" class="btn ghost" id="veAdd">＋ Add a condition</button></div>' +
          `<div class="row"><label class="inline-chk"><input type="checkbox" class="chk" id="veDated"${v.date ? ' checked' : ''}> Only dates from</label>` +
          `<input class="inp" id="veFromN" type="number" min="-999" max="999" value="${Number(dt.from.n) || 0}" style="width:62px">${unitSel('veFromU', dt.from.unit)}` +
          `<span>to</span><input class="inp" id="veToN" type="number" min="-999" max="999" value="${Number(dt.to.n) || 0}" style="width:62px">${unitSel('veToU', dt.to.unit)}<span class="nw">from today</span></div>` +
          '<div class="note">Negative numbers go back in time: −1 month to 0 days means “the past month”.</div>' +
          `<label class="inline-chk"><input type="checkbox" class="chk" id="veTodos"${v.includeTodos ? ' checked' : ''}> Include dated to-dos</label>` +
          '<div class="summary-line" id="vePreview"></div>',
        foot: '<span class="spacer"></span><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary" id="veSave">Save</button>',
        cls: '',
      });
      q(d, '#veName').value = v.name;
      let saved = false;
      function critRows() {
        q(d, '#veCrit').innerHTML = v.criteria.map((c, k) => `<div class="row" data-k="${k}"><select class="sel" data-f>${FIELDS.map(([f, l]) => `<option value="${f}"${f === c.field ? ' selected' : ''}>${l}</option>`).join('')}</select>` +
          `<span class="note" style="width:56px">${c.field === 'categories' ? 'is' : 'contains'}</span><input class="inp grow" data-v value="${esc(c.value || '')}" placeholder="${c.field === 'categories' ? 'Birthday, Anniversary' : 'words, separated by commas'}"${c.field === 'categories' ? ' list="catList"' : ''}>` +
          `<button type="button" class="nav" data-rm title="Remove this condition"${v.criteria.length > 1 ? '' : ' disabled'}>✕</button></div>`).join('');
      }
      function read() {
        v.name = q(d, '#veName').value.trim();
        v.criteria = [...d.querySelectorAll('#veCrit [data-k]')].map((r) => ({ field: q(r, '[data-f]').value, value: q(r, '[data-v]').value }));
        v.date = q(d, '#veDated').checked ? { from: { n: Number(q(d, '#veFromN').value) || 0, unit: q(d, '#veFromU').value }, to: { n: Number(q(d, '#veToN').value) || 0, unit: q(d, '#veToU').value } } : null;
        v.includeTodos = q(d, '#veTodos').checked;
      }
      async function preview() {
        read();
        q(d, '#vePreview').textContent = describeView(v);
      }
      q(d, '#veCrit').addEventListener('change', (e) => { if (e.target.matches('[data-f]')) { read(); critRows(); } preview(); });
      q(d, '#veCrit').addEventListener('input', preview);
      q(d, '#veCrit').addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) { read(); v.criteria.splice(Number(e.target.closest('[data-k]').dataset.k), 1); critRows(); preview(); } });
      q(d, '#veAdd').addEventListener('click', () => { read(); v.criteria.push({ field: 'summary', value: '' }); critRows(); preview(); q(d, '#veCrit').lastElementChild.querySelector('[data-v]').focus(); });
      for (const id of ['#veDated', '#veFromN', '#veFromU', '#veToN', '#veToU', '#veTodos']) { q(d, id).addEventListener('change', preview); q(d, id).addEventListener('input', preview); }
      q(d, '#veSave').addEventListener('click', async () => {
        read();
        if (!v.name) { A.toast('Please give the saved filter a name.'); q(d, '#veName').focus(); return; }
        if (views.some((x, k) => k !== i && x.name.toLowerCase() === v.name.toLowerCase())) { A.toast('There is already a saved filter with that name.'); q(d, '#veName').focus(); return; }
        v.criteria = v.criteria.filter((c) => String(c.value).trim());
        const next = [...views];
        if (i >= 0) next[i] = v; else next.push(v);
        const showIt = i < 0 || S.filter === `view:${i}`;
        if (!(await saveViews(next, showIt ? v.name : null))) return;
        saved = true;
        d.close();
        A.toast(i >= 0 ? 'Saved filter changed' : RF.T('Saved filter “{s}” added', { s: v.name }));
        if (i < 0) { $('remFilter').value = S.filter; if (S.tab !== 'reminders') await A.setTab('reminders'); else await A.renderMain('enter'); }
      });
      d.addEventListener('close', () => resolve(saved), { once: true });
      critRows();
      preview();
      d.showModal();
      q(d, '#veName').focus();
    });
  }

  // ------------------------------------------------------------ import (the add-on's import choices)
  // Shows what the file(s) hold, then asks: add to what you have or replace everything; skip items that look like
  // duplicates (same title and date) or import them anyway; and an optional category for every imported item.
  // Resolves to the import result, or null when cancelled.
  async function askImport(files) {
    files = [].concat(files || []).filter(Boolean);
    if (!files.length) return null;
    const p = await A.guard(window.rf.previewImport(files));
    if (!p) return null;
    const cats = S.meta.categories || [];
    return new Promise((resolve) => {
      const d = dlg('importDlg', {
        title: 'Import',
        body: `<div><b>${esc(p.files.join(', '))}</b></div>` +
          `<div class="note" id="imSummary">${esc([RF.T('{reminders} and {items}', { reminders: plural(p.events, 'reminder', 'reminders'), items: plural(p.todos, 'list item', 'list items') }),
            p.existing ? RF.T('{n} already here (the newer copy is kept)', { n: p.existing }) : '',
            p.duplicates ? RF.T(p.duplicates === 1 ? '{n} looks like a duplicate (same title and date as an item you have)' : '{n} look like duplicates (same title and date as an item you have)', { n: p.duplicates }) : ''].filter(Boolean).join('; '))}.</div>` +
          '<h3 class="st-h">How</h3>' +
          '<label class="inline-chk"><input type="radio" name="imMode" value="add" checked> Add to what I have</label>' +
          `<label class="inline-chk"><input type="radio" name="imMode" value="replace"> ${esc(RF.T('Replace everything (your {items} are saved as a backup first)', { items: plural(p.current, 'item', 'items') }))}</label>` +
          '<h3 class="st-h">Duplicates</h3>' +
          '<label class="inline-chk"><input type="radio" name="imDup" value="skip" checked> Skip items with the same title and date as one I have</label>' +
          '<label class="inline-chk"><input type="radio" name="imDup" value="import"> Import them anyway</label>' +
          '<h3 class="st-h">Category</h3>' +
          `<div class="row"><input class="inp grow" id="imCat" maxlength="60" list="imCats" placeholder="None"><datalist id="imCats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>` +
          '<div class="note">Optional: added to every imported item, for example “Holidays” for a list of holidays, so you can filter by it.</div>',
        foot: '<span class="spacer"></span><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary" id="imGo">Import</button>',
      });
      let out = null;
      const mode = () => (q(d, 'input[name=imMode]:checked') || {}).value || 'add';
      const sync = () => { for (const r of d.querySelectorAll('input[name=imDup]')) r.disabled = mode() === 'replace'; };
      for (const r of d.querySelectorAll('input[name=imMode]')) r.addEventListener('change', sync);
      q(d, '#imGo').addEventListener('click', async () => {
        const opts = { mode: mode(), duplicates: (q(d, 'input[name=imDup]:checked') || {}).value || 'skip', category: q(d, '#imCat').value.trim() };
        if (opts.mode === 'replace') {
          const ok = await A.confirmDlg('Replace everything?', `<div>${esc(RF.T('Your {items} will be replaced by the {newItems} in the file.', { items: plural(p.current, 'item', 'items'), newItems: plural(p.events + p.todos, 'item', 'items') }))}</div><div class="note">What you have now is saved first as a “Saved before an import replaced everything” backup, so you can bring it back from Settings → Data → Restore from a backup….</div>`,
            [{ label: 'Cancel', value: false, focus: true }, { label: 'Replace everything', cls: 'danger', value: true }]);
          if (!ok) return;
        }
        out = await A.guard(window.rf.importPaths(files, opts));
        if (out) d.close();
      });
      d.addEventListener('close', () => resolve(out), { once: true });
      d.showModal();
    });
  }

  // ------------------------------------------------------------ lists
  const badListName = (n) => !n || /[,:]/.test(n);
  const LIST_NAME_RULE = 'A list name can\'t be empty or contain a comma or a colon.';
  // Adds an empty list (kept in the settings until it has items, as the add-on kept its list names).
  // Resolves to the list's name, an existing one when only the letter case differs, or null.
  async function addList(n) {
    n = String(n || '').trim();
    if (badListName(n)) { A.toast(LIST_NAME_RULE); return null; }
    const known = S.meta.todoLists.find((l) => l.toLowerCase() === n.toLowerCase());
    if (known) return known;
    await A.setSetting({ lists: [...S.meta.todoLists.slice(1), n] });
    await A.refresh();
    return n;
  }
  async function askNewList() {
    const n = await askText('New list', 'Name of the new list (for example Groceries, Movies to see, Gift ideas):', '');
    if (n == null || n === '') return null;
    const known = S.meta.todoLists.find((l) => l.toLowerCase() === n.toLowerCase());
    const l = await addList(n);
    if (l) A.toast(known ? `“${l}” already exists` : `List “${l}” added`);
    return l;
  }
  function openLists() {
    const d = dlg('listsDlg', {
      title: 'Lists',
      body: `<div class="note">“${esc(DEFAULT_LIST)}” is the main list and can't be renamed or removed (as in the add-on). When you remove a list you choose whether its to-dos move to “${esc(DEFAULT_LIST)}” or are deleted.</div>` +
        '<div id="lsList" class="mini-list"></div>' +
        '<div class="row"><input class="inp grow" id="lsNew" maxlength="60" placeholder="New list name"><button type="button" class="btn" id="lsAdd">Add list</button></div>',
      foot: '<span class="spacer"></span><button type="button" class="btn primary" data-x>Done</button>',
    });
    function render() {
      const counts = S.meta.listCounts || {};
      const lists = S.meta.todoLists;
      q(d, '#lsList').innerHTML = lists.map((l, i) => `<div class="mini-row" data-l="${esc(l)}"><span class="grow"><b>${esc(l)}</b> <span class="note">${plural(counts[l] || 0, 'to-do', 'to-dos')}</span></span>` +
        (i ? `<button type="button" class="nav" data-a="up" title="Move up"${i > 1 ? '' : ' disabled'}>↑</button><button type="button" class="nav" data-a="down" title="Move down"${i < lists.length - 1 ? '' : ' disabled'}>↓</button>` +
          '<button type="button" class="btn ghost" data-a="ren">Rename…</button><button type="button" class="btn ghost danger" data-a="del">Remove…</button>' : '<span class="note">main list</span>') + '</div>').join('');
    }
    async function reload() { await A.refresh(); render(); }
    q(d, '#lsList').addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const name = b.closest('[data-l]').dataset.l;
      const a = b.dataset.a;
      const others = S.meta.todoLists.slice(1);
      if (a === 'up' || a === 'down') {
        const i = others.indexOf(name); const j = i + (a === 'up' ? -1 : 1);
        if (i < 0 || j < 0 || j >= others.length) return;
        [others[i], others[j]] = [others[j], others[i]];
        await A.setSetting({ lists: others });
        await reload();
      } else if (a === 'ren') {
        const to = await askText('Rename list', esc(RF.T('New name for “{name}”:', { name })), name);
        if (to == null || to === name) return;
        if (badListName(to)) { A.toast(LIST_NAME_RULE); return; }
        const merge = S.meta.todoLists.includes(to);
        if (merge && !(await A.confirmDlg('Merge lists?', `<div>There is already a list called <b>${esc(to)}</b>. Move the to-dos of <b>${esc(name)}</b> into it?</div>`, [{ label: 'Cancel', value: false }, { label: 'Merge', cls: 'primary', value: true }]))) return;
        const n = await A.guard(window.rf.renameList(name, to));
        if (n === undefined) return;
        if (S.todoList === name) await A.showList(to);
        A.toast(merge ? `Merged into “${to}”` : `Renamed to “${to}”`);
        await reload();
      } else if (a === 'del') {
        const n = (S.meta.listCounts || {})[name] || 0;
        const v = n
          ? await A.confirmDlg('Remove list?', `<div>${esc(RF.T(n === 1 ? 'The list “{list}” has {n} to-do. Move it to “{main}”, or delete it with the list?' : 'The list “{list}” has {n} to-dos. Move them to “{main}”, or delete them with the list?', { list: name, n, main: RF.T(DEFAULT_LIST) }))}</div>`,
            [{ label: 'Cancel', value: null }, { label: `Move to “${DEFAULT_LIST}”`, value: 'move', focus: true }, { label: 'Delete list and to-dos', cls: 'danger', value: 'delete' }])
          : await A.confirmDlg('Remove list?', `<div>The empty list <b>${esc(name)}</b> will be removed.</div>`, [{ label: 'Cancel', value: null }, { label: 'Remove', cls: 'danger', value: 'move' }]);
        if (!v) return;
        if (await A.guard(window.rf.removeList(name, { deleteItems: v === 'delete' })) === undefined) return;
        if (S.todoList === name) await A.showList(DEFAULT_LIST);
        A.toast(v === 'delete' ? RF.T(n === 1 ? 'List and {n} to-do deleted' : 'List and {n} to-dos deleted', { n }) : 'List removed');
        await reload();
      }
    });
    q(d, '#lsAdd').addEventListener('click', async () => {
      const n = q(d, '#lsNew').value.trim();
      if (badListName(n)) { A.toast(LIST_NAME_RULE); return; }
      if (S.meta.todoLists.some((l) => l.toLowerCase() === n.toLowerCase())) { A.toast('That list already exists.'); return; }
      await addList(n);
      q(d, '#lsNew').value = '';
      A.toast(`List “${n}” added`);
      await reload();
    });
    q(d, '#lsNew').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); q(d, '#lsAdd').click(); } });
    render();
    d.showModal();
  }
  // a one-line text question; resolves to the text, or null when cancelled
  function askText(title, html, value) {
    return new Promise((resolve) => {
      const d = dlg('askTextDlg', {
        title,
        body: `<div>${html}</div><input class="inp" id="atVal" maxlength="80">`,
        foot: '<span class="spacer"></span><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary" id="atOk">OK</button>',
      });
      let out = null;
      q(d, '#atVal').value = value || '';
      q(d, '#atOk').addEventListener('click', () => { out = q(d, '#atVal').value.trim(); d.close(); });
      d.addEventListener('close', () => resolve(out), { once: true });
      d.showModal();
      q(d, '#atVal').select();
    });
  }
  // Move (or, with opts.copy, copy) an item to a list. Moving a reminder makes it a to-do; copying leaves the
  // original where it is and puts an exact copy on the chosen list.
  async function askMoveToList(dto, opts = {}) {
    const lists = S.meta.todoLists;
    const isTodo = dto.kind === 'todo';
    const copy = !!opts.copy;
    const here = isTodo ? (dto.list || DEFAULT_LIST) : null;
    const d = dlg('moveListDlg', {
      title: copy ? (isTodo ? 'Copy to list' : 'Copy to a list') : (isTodo ? 'Move to list' : 'Make it a to-do'),
      body: `<div><b>${esc(dto.summary)}</b>${here ? ` <span class="note">is in “${esc(here)}”</span>` : ''}</div>` +
        (isTodo ? '' : `<div class="note">${copy ? 'The reminder stays; a to-do copy' : 'The reminder becomes a to-do'} on the same date, keeping its repeat, alarm and notes${copy ? ', goes on the list' : ''}.</div>`) +
        (copy && isTodo ? '<div class="note">An exact copy goes on the list you choose; this one stays where it is.</div>' : '') +
        `<div class="row"><span class="lbl" style="width:60px">List</span><select class="sel" id="mlSel">${lists.map((l) => `<option value="${esc(l)}">${esc(l)}${l === here ? ' (this list)' : ''}</option>`).join('')}<option value="__new">New list…</option></select>` +
        '<input class="inp grow hidden" id="mlNew" maxlength="60" placeholder="New list name"></div>',
      foot: `<span class="spacer"></span><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary" id="mlGo">${copy ? 'Copy' : 'Move'}</button>`,
    });
    // start on another list than the item's own (the current list for a reminder)
    const firstOther = lists.find((l) => l !== here) || DEFAULT_LIST;
    q(d, '#mlSel').value = isTodo ? (copy ? here : firstOther) : (A.curList() || DEFAULT_LIST);
    if (isTodo && !copy && q(d, '#mlSel').value === here) q(d, '#mlSel').value = firstOther;
    q(d, '#mlSel').addEventListener('change', () => { const nw = q(d, '#mlSel').value === '__new'; q(d, '#mlNew').classList.toggle('hidden', !nw); if (nw) q(d, '#mlNew').focus(); });
    q(d, '#mlGo').addEventListener('click', async () => {
      let l = q(d, '#mlSel').value;
      if (l === '__new') { l = await addList(q(d, '#mlNew').value); if (!l) return; }
      if (copy) {
        const uid = await A.guard(window.rf.duplicate(dto.uid, { list: l }));
        if (!uid) return;
        d.close();
        A.toast(`Copied to “${l}”`, 4500, { label: 'Show', fn: () => A.showList(l) });
        return;
      }
      if (isTodo && l === here) { d.close(); return; }
      if (await A.guard(window.rf.moveToList(dto.uid, l)) == null) return;
      d.close();
      A.toast(isTodo ? `Moved to “${l}”` : `Now a to-do in “${l}”`, 4500, { label: 'Show', fn: () => A.showList(l) });
    });
    d.showModal();
  }

  // ------------------------------------------------------------ a to-do becomes a reminder once its date is known
  // Resolves to true when it was converted. The item keeps its UID, notes, category, location, link and star;
  // its to-do list, due-by date, reminder plan and completion go.
  function askSchedule(dto) {
    return new Promise((resolve) => {
      const timedAlarms = (A.TIMED_ALARMS || [['', 'None'], ['15', '15 minutes before']]).filter(([v]) => v !== 'custom');
      const allDayAlarms = [['', 'None'], ['-540', 'On the day, at 9:00 AM'], ['900', 'The day before, at 9:00 AM']];
      const due = !dto.date ? '' : dto.allDay || !dto.time ? RF.T("It's due by {date}.", { date: fmt.long(parseKey(dto.date)) })
        : RF.T("It's due by {date}, {time}.", { date: fmt.long(parseKey(dto.date)), time: fmt.time(parseKey(dto.date).getTime() + toMinutes(dto.time) * 60000) });
      const d = dlg('scheduleDlg', {
        title: 'Schedule as a reminder',
        body: `<div><b>${esc(dto.summary || '(no description)')}</b></div>` +
          `<div class="note">${due ? `<span>${esc(due)}</span> ` : ''}<span>Once you know the exact date, the to-do becomes a reminder on that date: it leaves the to-do list and shows in Reminders, the Month view and the calendar. Notes, category, location and link are kept.</span></div>` +
          '<div class="row"><div class="field"><label for="scDate">Date</label><input class="inp" type="date" id="scDate"></div>' +
          '<div class="field" id="scTimeWrap"><label for="scTime">Time</label><input class="inp" type="time" id="scTime"></div>' +
          '<div class="field" style="justify-content:flex-end;padding-bottom:7px"><label class="inline-chk"><input type="checkbox" class="chk" id="scAllDay"> All day</label></div></div>' +
          '<div class="row"><span class="lbl" style="width:60px">Alarm</span><select class="sel" id="scAlarm"></select></div>' +
          (dto.repeat ? `<label class="inline-chk"><input type="checkbox" class="chk" id="scRepeat"> Keep repeating (${esc(dto.repeatText || 'as before')})</label>` : '') +
          '<div class="summary-line" id="scWhen"></div>',
        foot: '<span class="spacer"></span><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary" id="scGo">Make it a reminder</button>',
      });
      let done = false;
      q(d, '#scDate').value = dto.date || S.today;
      q(d, '#scTime').value = dto.time || '10:00';
      q(d, '#scAllDay').checked = false;
      function alarms() {
        const all = q(d, '#scAllDay').checked;
        const list = all ? allDayAlarms : timedAlarms;
        const keep = q(d, '#scAlarm').value;
        q(d, '#scAlarm').innerHTML = list.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
        const def = S.settings.defaultAlarm == null ? (all ? '-540' : '15') : (all ? '-540' : String(S.settings.defaultAlarm));
        q(d, '#scAlarm').value = list.some(([v]) => v === keep) ? keep : list.some(([v]) => v === def) ? def : list[0][0];
        q(d, '#scTimeWrap').classList.toggle('hidden', all);
        preview();
      }
      function preview() {
        const day = q(d, '#scDate').value;
        if (!day) { q(d, '#scWhen').textContent = 'Choose the date.'; return; }
        const all = q(d, '#scAllDay').checked;
        const t = q(d, '#scTime').value || '10:00';
        q(d, '#scWhen').textContent = `A reminder on ${fmt.long(parseKey(day))}${all ? ', all day' : `, at ${fmt.time(parseKey(day).getTime() + toMinutes(t) * 60000)}`}.`;
      }
      q(d, '#scAllDay').addEventListener('change', alarms);
      for (const id of ['#scDate', '#scTime']) { q(d, id).addEventListener('input', preview); q(d, id).addEventListener('change', preview); }
      q(d, '#scGo').addEventListener('click', async () => {
        const day = q(d, '#scDate').value;
        if (!day) { A.toast('Please choose the date.'); q(d, '#scDate').focus(); return; }
        const all = q(d, '#scAllDay').checked;
        const time = all ? null : (q(d, '#scTime').value || null);
        if (!all && !time) { A.toast('Please enter a time, or tick "All day".'); q(d, '#scTime').focus(); return; }
        const av = q(d, '#scAlarm').value;
        const keepRepeat = dto.repeat && q(d, '#scRepeat') && q(d, '#scRepeat').checked;
        const ev = { ...dto, kind: 'event', date: day, time, allDay: all, endDate: null, endTime: null,
          alarm: av === '' ? null : { minutes: Number(av) }, remind: null, list: null, completed: false, untilDone: false, showInTooltip: false,
          repeat: keepRepeat ? dto.repeat : null };
        const uid = await A.guard(window.rf.save(ev));
        if (!uid) return;
        done = true;
        d.close();
        A.toast(`Now a reminder on ${fmt.long(parseKey(day))}`, 5000, { label: 'Show', fn: () => A.goToDate(day) });
      });
      d.addEventListener('close', () => resolve(done), { once: true });
      alarms();
      d.showModal();
      q(d, '#scDate').focus();
    });
  }
  const toMinutes = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };

  // ------------------------------------------------------------ categories
  function openCategories() {
    const d = dlg('catsDlg', {
      title: 'Categories',
      body: '<div class="note">Renaming changes every reminder and to-do that has the category; renaming to an existing one merges them. Deleting removes it from its items (the items stay).</div>' +
        '<div id="ctList" class="mini-list tall"></div>' +
        '<div class="row"><input class="inp grow" id="ctNew" maxlength="60" placeholder="New category"><button type="button" class="btn" id="ctAdd">Add</button><button type="button" class="btn ghost" id="ctCommon" title="Anniversary, Appointment, Birthday, Business, Call…">Add common ones</button></div>',
      foot: '<span class="spacer"></span><button type="button" class="btn primary" data-x>Done</button>',
    });
    function render() {
      const counts = S.meta.categoryCounts || {};
      const cats = S.meta.categories;
      q(d, '#ctList').innerHTML = cats.length ? cats.map((c) => `<div class="mini-row" data-c="${esc(c)}"><span class="grow"><span class="chip">${esc(c)}</span> <span class="note">${counts[c] ? plural(counts[c], 'item', 'items') : 'not used yet'}</span></span>` +
        '<button type="button" class="btn ghost" data-a="ren">Rename…</button><button type="button" class="btn ghost danger" data-a="del">Delete…</button></div>').join('') : '<div class="note">No categories yet.</div>';
    }
    async function reload() { await A.refresh(); render(); }
    async function addCats(names) {
      const have = new Set(S.meta.categories.map((c) => c.toLowerCase()));
      const add = names.map((n) => n.trim()).filter((n) => n && !n.includes(',') && !have.has(n.toLowerCase()));
      if (!add.length) { A.toast('Nothing new to add.'); return; }
      await A.setSetting({ categories: [...new Set([...(S.settings.categories || []), ...add])] });
      A.toast(add.length === 1 ? `Category “${add[0]}” added` : RF.T('{n} categories added', { n: add.length }));
      await reload();
    }
    q(d, '#ctList').addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const c = b.closest('[data-c]').dataset.c;
      const n = (S.meta.categoryCounts || {})[c] || 0;
      if (b.dataset.a === 'ren') {
        const to = await askText('Rename category', esc(RF.T(n ? 'New name for “{name}” (on {items}):' : 'New name for “{name}”:', { name: c, items: plural(n, 'item', 'items') })), c);
        if (to == null || to === c) return;
        if (!to || to.includes(',')) { A.toast('A category can\'t be empty or contain a comma.'); return; }
        const merge = S.meta.categories.some((x) => x === to);
        if (merge && !(await A.confirmDlg('Merge categories?', `<div><b>${esc(to)}</b> already exists. Merge <b>${esc(c)}</b> into it?</div>`, [{ label: 'Cancel', value: false }, { label: 'Merge', cls: 'primary', value: true }]))) return;
        if (await A.guard(window.rf.renameCategory(c, to)) === undefined) return;
        if (S.cat === c) S.cat = to;
        if (S.todoCat === c) S.todoCat = to;
        A.toast(merge ? `Merged into “${to}”` : `Renamed to “${to}”`);
      } else {
        const ok = await A.confirmDlg('Delete category?', `<div>${esc(RF.T(n ? 'The category “{name}” will be deleted and removed from {items}. The items themselves stay.' : 'The category “{name}” will be deleted.', { name: c, items: plural(n, 'item', 'items') }))}</div>`, [{ label: 'Cancel', value: false }, { label: 'Delete', cls: 'danger', value: true }]);
        if (!ok) return;
        if (await A.guard(window.rf.renameCategory(c, '')) === undefined) return;
        if (S.cat === c) S.cat = '';
        if (S.todoCat === c) S.todoCat = '';
        A.toast('Category deleted');
      }
      await reload();
    });
    q(d, '#ctAdd').addEventListener('click', async () => { await addCats([q(d, '#ctNew').value]); q(d, '#ctNew').value = ''; });
    q(d, '#ctNew').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); q(d, '#ctAdd').click(); } });
    q(d, '#ctCommon').addEventListener('click', () => addCats(COMMON_CATEGORIES));
    render();
    d.showModal();
  }
  // the editor's ▾ next to Category: tick categories instead of typing them
  function pickCategories(cur) {
    return new Promise((resolve) => {
      const all = [...new Set([...S.meta.categories, ...cur])].sort((a, b) => a.localeCompare(b));
      const d = dlg('catPickDlg', {
        title: 'Categories',
        body: `<div class="pick-grid" id="cpList">${all.map((c) => `<label class="inline-chk"><input type="checkbox" class="chk" value="${esc(c)}"${cur.includes(c) ? ' checked' : ''}> ${esc(c)}</label>`).join('') || '<div class="note">No categories yet.</div>'}</div>` +
          '<div class="row"><input class="inp grow" id="cpNew" maxlength="60" placeholder="Another category"></div>',
        foot: '<span class="spacer"></span><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary" id="cpOk">OK</button>',
      });
      let out = null;
      q(d, '#cpOk').addEventListener('click', () => {
        const picked = [...d.querySelectorAll('#cpList input:checked')].map((x) => x.value);
        const extra = q(d, '#cpNew').value.split(',').map((x) => x.trim()).filter(Boolean);
        // keep the order the item already had, then the new ones
        out = [...cur.filter((c) => picked.includes(c)), ...picked.filter((c) => !cur.includes(c)), ...extra.filter((c) => !picked.includes(c) && !cur.includes(c))];
        d.close();
      });
      d.addEventListener('close', () => resolve(out), { once: true });
      d.showModal();
    });
  }

  // ------------------------------------------------------------ go to date
  function openGoTo() {
    const d = dlg('gotoDlg', {
      title: 'Go to date',
      body: '<div class="row"><input class="inp" type="date" id="gtDate" aria-label="Date"><span class="spacer" style="flex:1"></span>' +
        '<button type="button" class="btn ghost" data-jump="0">Today</button><button type="button" class="btn ghost" data-jump="7">+1 week</button><button type="button" class="btn ghost" data-jump="m1">+1 month</button><button type="button" class="btn ghost" data-jump="y1">+1 year</button></div>',
      foot: '<span class="spacer"></span><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary" id="gtGo">Go</button>',
    });
    q(d, '#gtDate').value = S.selDay;
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-jump]');
      if (!b) return;
      const base = parseKey(b.dataset.jump === '0' ? S.today : (q(d, '#gtDate').value || S.selDay));
      const j = b.dataset.jump;
      if (j === '0') { /* today */ } else if (j === 'm1') base.setMonth(base.getMonth() + 1); else if (j === 'y1') base.setFullYear(base.getFullYear() + 1); else base.setDate(base.getDate() + Number(j));
      q(d, '#gtDate').value = dayKey(base);
    });
    q(d, '#gtGo').addEventListener('click', async () => {
      const k = q(d, '#gtDate').value;
      if (!k) { A.toast('Please choose a date.'); return; }
      d.close();
      await A.goToDate(k);
    });
    d.showModal();
    q(d, '#gtDate').focus();
  }

  // ------------------------------------------------------------ backups
  const KB = (n) => (n < 1024 ? `${n} bytes` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);
  async function backupNow(choose) {
    const p = await A.guard(window.rf.backupNow(!!choose));
    if (p) A.toast(choose ? `Backup saved to ${p}` : `Backed up: ${String(p).split(/[\\/]/).pop()}`, 4500);
  }
  async function openRestore() {
    const d = dlg('restoreDlg', {
      title: 'Restore from a backup',
      body: '<div class="note">ReminderFoxAgain keeps a backup every day, one before each restore, and the ones you make with “Back up now”. Restoring replaces your current reminders and to-dos with the backup; what you have now is saved first, so you can always go back.</div>' +
        '<div class="restore-wrap"><table class="list restore"><thead><tr><th></th><th>Made</th><th>Kind</th><th>Contents</th></tr></thead><tbody id="rsList"></tbody></table></div>',
      foot: '<button type="button" class="btn" id="rsOther">Choose another file…</button><span class="spacer"></span><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary" id="rsGo" disabled>Restore…</button>',
      cls: 'wide',
    });
    let items = [];
    let picked = null;
    function contents(b) {
      if (b.error) return `<span class="bad-text">Can't be read: ${esc(b.error)}</span>`;
      const parts = [plural(b.items, 'item', 'items')];
      if (b.archived) parts.push(RF.T('{n} archived', { n: b.archived }));
      return `${parts.join(', ')} <span class="note">· ${KB(b.size)}</span>`;
    }
    function render() {
      q(d, '#rsList').innerHTML = items.length ? items.map((b, i) => `<tr data-i="${i}" class="${picked === i ? 'selected' : ''}${b.error ? ' past' : ''}"><td class="c-chk"><input type="radio" name="rsPick" ${picked === i ? 'checked' : ''}${b.error ? ' disabled' : ''} aria-label="Choose"></td>` +
        `<td class="nw">${esc(fmt.date(b.modified))} <span class="note">${esc(fmt.time(b.modified))}</span></td><td>${esc(b.kind)}<br><span class="note">${esc(b.name)}</span></td><td>${contents(b)}</td></tr>`).join('')
        : '<tr><td colspan="4" class="note" style="padding:14px">No backups yet. They are made every day the app runs; you can also click “Back up now”.</td></tr>';
      q(d, '#rsGo').disabled = picked == null;
    }
    q(d, '#rsList').addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-i]');
      if (!tr || items[Number(tr.dataset.i)].error) return;
      picked = Number(tr.dataset.i);
      render();
    });
    q(d, '#rsList').addEventListener('dblclick', (e) => { if (e.target.closest('tr[data-i]') && picked != null) q(d, '#rsGo').click(); });
    q(d, '#rsOther').addEventListener('click', async () => {
      const b = await A.guard(window.rf.backupChoose());
      if (!b) return;
      if (b.error) { await A.message('Can\'t restore that file', `<div>${esc(b.name)} couldn't be read: ${esc(b.error)}</div>`); return; }
      items = [b, ...items.filter((x) => x.path !== b.path)];
      picked = 0;
      render();
    });
    q(d, '#rsGo').addEventListener('click', async () => {
      const b = items[picked];
      if (!b) return;
      const archiveOnly = /^archive-/.test(b.name);
      const now = plural(S.meta.count, 'item', 'items');
      const list = RF.T('Terminated or Suspended');
      const v = { now, list, items: plural(b.items, 'item', 'items'), all: plural(b.items + b.archived, 'item', 'items'), n: b.archived, when: `${fmt.long(b.modified)}, ${fmt.time(b.modified)}` };
      const what = `<div>${esc(RF.T(archiveOnly ? 'This is a copy of the archive from an earlier version. Its {all} go into the “{list}” list (items you already have are left as they are). Nothing else changes.'
        : b.archived ? 'This replaces what you have now ({now}) with the backup from {when}: {items}, plus {n} archived, which go into the “{list}” list.' : 'This replaces what you have now ({now}) with the backup from {when}: {items}.', v))}</div>`;
      const ok = await A.confirmDlg('Restore this backup?', `${what}<div class="note">Your current data is saved first as a “Saved before a restore” backup, so you can undo this from this same list.</div>`,
        [{ label: 'Cancel', value: false }, { label: 'Restore', cls: 'danger', value: true }]);
      if (!ok) return;
      const r = await A.guard(window.rf.backupRestore(b.path));
      if (!r) return;
      d.close();
      await A.refresh();
      const got = RF.T(r.moved ? 'Restored {items}, {n} of them archived ones now in the “{list}” list.' : 'Restored {items}.', { items: plural(r.items, 'item', 'items'), n: r.moved, list: RF.T(r.list || '') });
      await A.message('Backup restored', `<div>${esc(got)}</div><div class="note">${esc(RF.T('What you had before was saved as {file}.', { file: r.safety }))}</div>`);
    });
    items = (await A.guard(window.rf.backupList())) || [];
    render();
    d.showModal();
  }

  // ------------------------------------------------------------ your own themes (0.8.1)
  // Five colours make a theme; every other colour (lines, hover, soft tints, text on the accent) is worked out from
  // them by RF.themeVars. The window shows the theme while you edit it, and goes back if you cancel.
  const THEME_FIELDS = [['bg', 'Background', 'Behind everything'], ['surface', 'Lists and panels', 'The lists, the calendar panel, dialogs'],
    ['ink', 'Text', ''], ['accent', 'Accent', 'Buttons, today, selection'], ['star', 'Starred items', 'Important reminders and to-dos']];
  function baseColors(themeId) {
    const own = (S.settings.customThemes || []).find((c) => `custom:${c.id}` === themeId);
    if (own) return { ...own };
    const id = themeId || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'fox');
    return { ...(RF.THEME_COLORS[id] || RF.THEME_COLORS.fox) };
  }
  function themeWarnings(c) {
    const out = [];
    const r = (a, b) => RF.contrast(a, b);
    const low = (x, min) => x < min;
    if (low(r(c.ink, c.surface), 4.5) || low(r(c.ink, c.bg), 4.5)) out.push(RF.T('The text is hard to read on the background (contrast {n}:1; 4.5:1 or more is easy to read).', { n: Math.min(r(c.ink, c.surface), r(c.ink, c.bg)).toFixed(1) }));
    if (low(r(c.accent, c.surface), 3)) out.push(RF.T('The accent is hard to see on the lists (contrast {n}:1; 3:1 or more is better).', { n: r(c.accent, c.surface).toFixed(1) }));
    if (low(r(c.star, c.surface), 3)) out.push(RF.T('Starred items are hard to see on the lists (contrast {n}:1; 3:1 or more is better).', { n: r(c.star, c.surface).toFixed(1) }));
    return out;
  }
  function editTheme(id) {
    return new Promise((resolve) => {
      const list = S.settings.customThemes || [];
      const old = id ? list.find((c) => c.id === id) : null;
      const startFrom = S.settings.theme || '';
      const t = old ? { ...old } : { id: '', name: '', ...baseColors(startFrom) };
      if (!old) { delete t.id; t.name = ''; }
      const bases = RF.themeList(list);
      const d = dlg('themeDlg', {
        title: old ? 'Edit theme' : 'New theme',
        body: '<div class="field"><label for="thName">Name</label><input class="inp" id="thName" maxlength="40" placeholder="e.g. Forest"></div>' +
          `<div class="row"><span class="lbl st-l">Start from</span><select class="sel" id="thBase">${bases.map((b) => `<option value="${esc(b.id)}"${b.custom ? ' translate="no"' : ''}>${esc(b.custom ? b.label : RF.T(b.label))}</option>`).join('')}</select></div>` +
          THEME_FIELDS.map(([k, label, hint]) => `<div class="row"><label class="lbl st-l" for="th-${k}">${esc(RF.T(label))}</label><input type="color" class="th-color" id="th-${k}" data-k="${k}"><input class="inp th-hex" data-hex="${k}" maxlength="7" spellcheck="false" aria-label="${esc(RF.T(label))}">${hint ? `<span class="note">${esc(RF.T(hint))}</span>` : ''}</div>`).join('') +
          '<div class="th-preview" id="thPreview" aria-hidden="true"><div class="th-card" translate="no"><span class="th-star">★ <span translate="no">Sarah\'s birthday</span></span><span class="th-text" translate="no">Team stand-up</span><span class="th-mute">9:30 AM</span></div><span class="th-btn">＋ Reminder</span><span class="th-today">25</span></div>' +
          '<div class="note" id="thWarn" role="status"></div>' +
          '<div class="note">The whole window shows the theme while you choose. Cancel puts the old one back.</div>',
        foot: '<span class="spacer"></span><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary" id="thSave">Save</button>',
        cls: '',
      });
      let saved = false;
      q(d, '#thName').value = t.name || '';
      q(d, '#thBase').value = old ? `custom:${old.id}` : (bases.some((b) => b.id === startFrom) ? startFrom : '');
      function fill() {
        for (const [k] of THEME_FIELDS) { q(d, `#th-${k}`).value = t[k]; q(d, `[data-hex=${k}]`).value = t[k]; q(d, `[data-hex=${k}]`).classList.remove('bad'); }
        show();
      }
      function show() {
        RF.applyTheme('', null, t);
        const pv = q(d, '#thPreview');
        for (const [k, v] of Object.entries(RF.themeVars(t))) pv.style.setProperty(k, v);
        const w = themeWarnings(t);
        q(d, '#thWarn').textContent = w.join(' ');
        q(d, '#thWarn').classList.toggle('warn', w.length > 0);
      }
      q(d, '#thBase').addEventListener('change', () => { Object.assign(t, baseColors(q(d, '#thBase').value)); if (old) t.id = old.id; t.name = q(d, '#thName').value; fill(); });
      d.addEventListener('input', (e) => {
        const k = e.target.dataset.k || e.target.dataset.hex;
        if (!k) return;
        let v = e.target.value.trim();
        if (e.target.dataset.hex) {
          if (/^[0-9a-f]{6}$/i.test(v)) v = `#${v}`;
          const ok = /^#[0-9a-f]{6}$/i.test(v);
          e.target.classList.toggle('bad', !ok);
          if (!ok) return;
          q(d, `#th-${k}`).value = v.toLowerCase();
        } else q(d, `[data-hex=${k}]`).value = v;
        t[k] = v.toLowerCase();
        show();
      });
      q(d, '#thSave').addEventListener('click', async () => {
        const name = q(d, '#thName').value.trim();
        if (!name) { A.toast('Please give the theme a name.'); q(d, '#thName').focus(); return; }
        const builtIn = RF.THEMES.some((b) => RF.T(b.label).toLowerCase() === name.toLowerCase() || b.label.toLowerCase() === name.toLowerCase());
        if (builtIn || list.some((c) => c.id !== (old && old.id) && c.name.toLowerCase() === name.toLowerCase())) { A.toast('There is already a theme with that name.'); q(d, '#thName').focus(); return; }
        const item = { id: old ? old.id : Date.now().toString(36), name, bg: t.bg, surface: t.surface, ink: t.ink, accent: t.accent, star: t.star };
        const next = old ? list.map((c) => (c.id === old.id ? item : c)) : [...list, item];
        if (!(await A.setSetting({ customThemes: next, theme: `custom:${item.id}` }))) return;
        saved = true;
        d.close();
        A.toast(old ? RF.T('Theme “{s}” saved', { s: name }) : RF.T('Theme “{s}” added', { s: name }));
      });
      d.addEventListener('close', () => { A.applyTheme(); resolve(saved); }, { once: true });
      fill();
      d.showModal();
      q(d, '#thName').focus();
    });
  }
  async function deleteTheme(id) {
    const list = S.settings.customThemes || [];
    const c = list.find((x) => x.id === id);
    if (!c) return false;
    const ok = await A.confirmDlg('Delete theme?', `<div>${esc(RF.T('The theme “{s}” will be deleted. The app goes back to the Default theme.', { s: c.name }))}</div>`,
      [{ label: 'Cancel', value: false, focus: true }, { label: 'Delete', cls: 'danger', value: true }]);
    if (!ok) return false;
    const patch = { customThemes: list.filter((x) => x.id !== id) };
    if (S.settings.theme === `custom:${id}`) patch.theme = '';
    if (!(await A.setSetting(patch))) return false;
    A.applyTheme();
    return true;
  }

  // ------------------------------------------------------------ settings panels
  const st = $('settingsDlg');
  function showPanel(name) {
    for (const b of st.querySelectorAll('#stTabs button')) b.setAttribute('aria-pressed', String(b.dataset.st === name));
    for (const p of st.querySelectorAll('[data-st-panel]')) p.hidden = p.dataset.stPanel !== name;
  }
  $('stTabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-st]'); if (b) showPanel(b.dataset.st); });
  function fillSettings() {
    const s = S.settings;
    if (!st.open) showPanel('general');
    fillTones();
    $('stResound').value = String(Number(s.resoundMinutes) || 0);
    $('stSlider').checked = !!s.sliderEnabled;
    $('stSliderShow').value = s.sliderShow || 'both';
    $('stSliderEvery').value = String(Number(s.sliderEvery) || 0);
    $('stSliderKeep').value = String(s.sliderKeep == null ? 15 : Number(s.sliderKeep));
    $('stSliderCorner').value = s.sliderCorner || 'br';
    $('stSliderSound').checked = !!s.sliderSound;
    $('stUpcomingDays').value = String(Number(s.upcomingDays) || 15);
    $('stBadge').value = s.badge || 'today';
    $('stTextSize').value = String(Number(s.textSize) || 100);
    const L = RF.i18n || { languages: [['en', 'English']], systemLang: 'en' };
    const nameOf = (c) => (L.languages.find(([k]) => k === c) || [c, c])[1];
    $('stLanguage').innerHTML = `<option value="">${esc(`System language (${nameOf(L.systemLang)})`)}</option>` +
      L.languages.map(([c, n]) => `<option value="${c}" translate="no" lang="${c}">${esc(n)}</option>`).join('');
    $('stLanguage').value = s.language || '';
    $('stDateFormat').innerHTML = RF.DATE_FORMATS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
    $('stDateFormat').value = s.dateFormat || '';
    $('stTimeFormat').value = s.timeFormat || '';
    $('stSide').checked = s.sidePanel !== false;
    $('stMonths').value = String(Number(s.miniMonths) || 1);
    $('stMap').value = s.mapService || 'google';
    $('stTodayLabel').value = s.todayLabel == null ? DEFAULT_LABELS.todayLabel : s.todayLabel;
    $('stUpcomingLabel').value = s.upcomingLabel == null ? DEFAULT_LABELS.upcomingLabel : s.upcomingLabel;
    $('stTipUpcoming').checked = s.tooltipUpcoming !== false;
    $('stUpcomingLabel').disabled = s.tooltipUpcoming === false;
    $('stRepeatAhead').value = /^[nm]\d+$/.test(String(s.repeatAhead)) ? s.repeatAhead : 'm12';
    $('stPastRepeat').value = s.pastRepeatDays == null ? 'all' : String(s.pastRepeatDays);
    $('stHideRepeat').checked = !!s.hideRepeating;
    fillColumns();
    updateSliderParts();
  }
  // Sound: the built-in sounds, then the user's own file once one was chosen
  function fillTones() {
    const s = S.settings;
    const tone = s.alarmTone === 'file' && !s.soundFile ? 'chime' : s.alarmTone || 'chime';
    $('stTone').innerHTML = RF.TONES.map((t) => `<option value="${t.id}">${esc(RF.T(t.label))}</option>`).join('') +
      (s.soundFile ? `<option value="file">${esc(RF.T('Your file: {s}', { s: s.soundName || s.soundFile }))}</option>` : '');
    $('stTone').value = tone;
  }
  async function testSound() {
    RF.stopSound();
    const url = S.settings.alarmTone === 'file' && S.settings.soundFile ? await A.guard(window.rf.soundData()) : null;
    return RF.playSound(url, S.settings.alarmTone);
  }
  // Columns: a tick per column for the Reminders tab and for the lists; the description is always shown
  const COL_NAMES = { chk: '✓ Completed', imp: '★ Important', date: 'Date', day: 'Day', time: 'Time', desc: 'Description', repeat: 'Repeat', cat: 'Category', alarm: '🔔 Alarm' };
  const COL_SETS = [['stColsRem', 'remColumnsHidden', ['chk', 'imp', 'date', 'day', 'time', 'desc', 'repeat', 'cat', 'alarm']],
    ['stColsTodo', 'todoColumnsHidden', ['chk', 'imp', 'date', 'time', 'desc', 'repeat', 'cat', 'alarm']]];
  function fillColumns() {
    for (const [id, key, cols] of COL_SETS) {
      const hidden = new Set(S.settings[key] || []);
      $(id).innerHTML = cols.map((c) => {
        const name = c === 'date' && key === 'todoColumnsHidden' ? 'Due by' : COL_NAMES[c];
        return `<label class="inline-chk"><input type="checkbox" class="chk" data-col="${c}"${c === 'desc' ? ' checked disabled' : hidden.has(c) ? '' : ' checked'}> ${esc(RF.T(name))}</label>`;
      }).join('');
    }
  }
  function updateSliderParts() {
    const on = $('stSlider').checked;
    for (const id of ['stSliderShow', 'stSliderEvery', 'stSliderKeep', 'stSliderCorner', 'stSliderSound']) $(id).disabled = !on;
  }
  const bind = (id, ev, fn) => $(id).addEventListener(ev, fn);
  const set = (patch) => A.setSetting(patch);
  bind('stResound', 'change', () => set({ resoundMinutes: Number($('stResound').value) }));
  bind('stSlider', 'change', () => { updateSliderParts(); set({ sliderEnabled: $('stSlider').checked }); });
  bind('stSliderShow', 'change', () => set({ sliderShow: $('stSliderShow').value }));
  bind('stSliderEvery', 'change', () => set({ sliderEvery: Number($('stSliderEvery').value) }));
  bind('stSliderKeep', 'change', () => set({ sliderKeep: Number($('stSliderKeep').value) }));
  bind('stSliderCorner', 'change', () => set({ sliderCorner: $('stSliderCorner').value }));
  bind('stSliderSound', 'change', () => set({ sliderSound: $('stSliderSound').checked }));
  bind('stSliderNow', 'click', () => A.guard(window.rf.showSlider()));
  bind('stUpcomingDays', 'change', () => {
    const n = Math.round(Number($('stUpcomingDays').value));
    const ok = n >= 1 && n <= 60;
    $('stUpcomingDays').classList.toggle('bad', !ok);
    if (ok) set({ upcomingDays: n });
  });
  bind('stBadge', 'change', async () => { await set({ badge: $('stBadge').value }); await A.updateBadge(); });
  bind('stSoundPick', 'click', async () => {
    const r = await A.guard(window.rf.chooseSound());
    if (!r) return;
    S.settings = r;
    fillSettings();
    A.toast(`Alarm sound: ${r.soundName}`);
  });
  for (const [id, key] of COL_SETS) {
    bind(id, 'change', async () => {
      const hidden = [...$(id).querySelectorAll('input[data-col]:not(:checked)')].map((x) => x.dataset.col).filter((c) => c !== 'desc');
      await set({ [key]: hidden });
      A.applyColumns();
    });
  }
  bind('stTone', 'change', async () => { await set({ alarmTone: $('stTone').value }); testSound(); });
  bind('stSoundTest', 'click', () => testSound());
  bind('stSuspend', 'click', () => openSuspend());
  bind('stQuick', 'click', () => openQuick());
  bind('stTextSize', 'change', () => set({ textSize: Number($('stTextSize').value) }));
  bind('stLanguage', 'change', async () => { try { sessionStorage.setItem('rf-reopen', 'display'); } catch (e) { /* none */ } await set({ language: $('stLanguage').value }); }); // main reloads the windows
  bind('stDateFormat', 'change', async () => { await set({ dateFormat: $('stDateFormat').value }); RF.setFormats(S.settings); await A.refresh(); });
  bind('stTimeFormat', 'change', async () => { await set({ timeFormat: $('stTimeFormat').value }); RF.setFormats(S.settings); await A.refresh(); });
  bind('stSide', 'change', async () => { document.body.classList.toggle('no-side', !$('stSide').checked); await set({ sidePanel: $('stSide').checked }); });
  bind('stMonths', 'change', async () => { await set({ miniMonths: Number($('stMonths').value) }); await A.renderSide(); });
  bind('stMap', 'change', () => set({ mapService: $('stMap').value }));
  bind('stTodayLabel', 'change', () => set({ todayLabel: $('stTodayLabel').value }));
  bind('stUpcomingLabel', 'change', () => set({ upcomingLabel: $('stUpcomingLabel').value }));
  bind('stTipUpcoming', 'change', () => { $('stUpcomingLabel').disabled = !$('stTipUpcoming').checked; set({ tooltipUpcoming: $('stTipUpcoming').checked }); });
  bind('stLabelsReset', 'click', async (e) => { e.preventDefault(); await set({ ...DEFAULT_LABELS, tooltipUpcoming: true }); fillSettings(); A.toast('Tooltip labels reset'); });
  bind('stRepeatAhead', 'change', async () => { await set({ repeatAhead: $('stRepeatAhead').value }); await A.refresh(); });
  bind('stPastRepeat', 'change', async () => { const v = $('stPastRepeat').value; await set({ pastRepeatDays: v === 'all' ? 'all' : Number(v) }); await A.refresh(); });
  bind('stHideRepeat', 'change', async () => { await set({ hideRepeating: $('stHideRepeat').checked }); await A.refresh(); });
  bind('stLists', 'click', openLists);
  bind('stCats', 'click', openCategories);
  bind('stViews', 'click', openViews);
  bind('stBackup', 'click', () => backupNow(false));
  bind('stBackupCopy', 'click', () => backupNow(true));
  bind('stRestore', 'click', openRestore);
  bind('stBackups', 'click', () => A.guard(window.rf.openBackups()));
  window.rf.on('settings:changed', () => { if (st.open) fillSettings(); });

  window.__rfx = {
    fillSettings, showPanel, openQuick, openSuspend, openViews, editView, showView, openLists, openCategories, pickCategories,
    askMoveToList, askNewList, addList, askSchedule, askImport, askText, openGoTo, openRestore, backupNow, describeView, testSound, editTheme, deleteTheme,
  };
})();
