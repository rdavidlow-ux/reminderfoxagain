'use strict';
/* global RF */
// ReminderFoxAgain main window.
(function () {
  const { dayKey, parseKey, startOfDay, addDays, fmt, esc } = RF;
  const $ = (id) => document.getElementById(id);
  const DEFAULT_LIST = "To-Do's";
  const WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const T = window.RF.T;
  const I18 = window.RF.i18n || { lang: 'en' };
  // weekday names in the app language (2024-01-07 is a Sunday)
  const wdName = (i, style) => new Date(2024, 0, 7 + i).toLocaleDateString(window.RF.LOCALE, { weekday: style });
  // the day buttons use the locale file's two-letter names; full names come from Intl in the app language
  const WD_LABEL = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((s) => T(s));
  const WD_LONG = I18.lang === 'en' ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] : [0, 1, 2, 3, 4, 5, 6].map((i) => wdName(i, 'long'));
  const monthDay = (d) => d.toLocaleDateString(window.RF.LOCALE, { month: 'long', day: 'numeric' });
  const ORD = (n) => (n === -1 ? T('last') : I18.ordinal ? I18.ordinal(n) : n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'));

  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };

  const S = {
    tab: 'reminders',
    filter: ls.get('remFilter', 'upcoming'),
    cat: '', todoList: ls.get('todoList', DEFAULT_LIST), todoCat: '',
    showDone: ls.get('showDone', '1') === '1',
    mTodos: true,
    mShowDone: true, // the Month toolbar's Show completed: ticked at every start (0.8.1)
    today: dayKey(new Date()),
    selDay: dayKey(new Date()),
    calMonth: startOfDay(new Date()),
    monthView: startOfDay(new Date()),
    meta: { categories: [], todoLists: [DEFAULT_LIST], settings: {}, count: 0 },
    settings: {},
    rows: [], todos: [], selKey: null,
    search: '',
    visited: new Set(), scroll: {}, pendingStart: false,
    welcome: false, oldFiles: [],
  };
  S.calMonth.setDate(1);
  S.monthView.setDate(1);
  const BASE_FILTERS = $('remFilter').innerHTML;
  if (!/^view:\d+$/.test(S.filter) && ![...$('remFilter').options].some((o) => o.value === S.filter)) S.filter = 'upcoming';
  // features.js (settings panels and the feature dialogs) registers itself here
  const FX = (name, ...a) => (window.__rfx && typeof window.__rfx[name] === 'function' ? window.__rfx[name](...a) : undefined);
  const todoTab = (t = S.tab) => t === 'todos';
  // the list the Lists tab shows, picked in its dropdown ('' = every list)
  function curList() { return S.todoList; }
  const manualOrder = () => S.settings.todoSort === 'manual';
  const TODO_SORTS = ['manual', 'date', 'time', 'summary', 'important', 'completed', 'repeat', 'category', 'alarm'];
  const sortKey = () => (TODO_SORTS.includes(S.settings.todoSort) ? S.settings.todoSort : 'date');
  // the columns you can hide in Settings → Display (the description always shows)
  const COLUMNS = { reminders: ['chk', 'imp', 'date', 'day', 'time', 'repeat', 'cat', 'alarm'], todos: ['chk', 'imp', 'date', 'time', 'repeat', 'cat', 'alarm'] };
  function applyColumns() {
    const hidden = new Set(S.tab === 'reminders' ? S.settings.remColumnsHidden || [] : todoTab() ? S.settings.todoColumnsHidden || [] : []);
    for (const c of COLUMNS.reminders) listView.classList.toggle(`hide-${c}`, hidden.has(c));
  }

  // ---------------------------------------------------------------- utilities
  const toastEl = document.createElement('div');
  toastEl.className = 'toast hidden';
  document.body.appendChild(toastEl);
  let toastTimer = null;
  function toast(msg, ms = 3200, action) {
    toastEl.textContent = msg;
    if (action) {
      const b = document.createElement('button');
      b.className = 'toast-act';
      b.textContent = action.label;
      b.addEventListener('click', () => { toastEl.classList.add('hidden'); action.fn(); });
      toastEl.appendChild(b);
    }
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), ms);
  }
  async function guard(p) {
    try { return await p; } catch (e) { await message('Something went wrong', esc(e.message || e)); return undefined; }
  }
  const anyDialogOpen = () => !!document.querySelector('dialog[open]');
  const todayStart = () => startOfDay(new Date());

  // confirm/message dialog
  const cf = $('confirm');
  let cfResolve = null;
  function confirmDlg(title, bodyHtml, buttons) {
    return new Promise((resolve) => {
      if (cfResolve) cfResolve(null);
      cfResolve = resolve;
      $('cfTitle').textContent = title;
      $('cfBody').innerHTML = bodyHtml;
      const foot = $('cfFoot');
      foot.innerHTML = '<span class="spacer"></span>';
      let focus = null;
      for (const b of buttons) {
        const el = document.createElement('button');
        el.className = `btn ${b.cls || ''}`.trim();
        el.textContent = b.label;
        el.addEventListener('click', () => done(b.value));
        foot.appendChild(el);
        if (b.focus || (b.cls && /primary|danger/.test(b.cls) && !buttons.some((x) => x.focus))) focus = el;
      }
      function done(v) { const r = cfResolve; cfResolve = null; if (cf.open) cf.close(); if (r) r(v); }
      // the close event of a previous dialog arrives late; ignore it once this one is showing
      cf.onclose = () => { if (cf.open) return; if (cfResolve) { const r = cfResolve; cfResolve = null; r(null); } };
      if (!cf.open) cf.showModal();
      (focus || foot.lastElementChild).focus();
    });
  }
  const message = (title, html) => confirmDlg(title, html, [{ label: 'OK', cls: 'primary', value: true }]);

  function matches(r, q) {
    if (!q) return true;
    const hay = [r.summary, r.notes, r.location, ...(r.categories || [])].join('\n').toLowerCase();
    return hay.includes(q);
  }
  // a carried "remind until completed" row is shown on today but acts on its original occurrence
  const occOf = (r) => (r.occStart != null ? r.occStart : r.start);
  const keyOf = (r) => `${r.uid}|${occOf(r) == null ? '' : occOf(r)}`;
  // completed list items (to-dos) stay in their list but leave the Month view, the mini calendar and the agenda
  const notDoneItem = (r) => !(r.kind === 'todo' && r.completed);
  const plural = (n, one, many) => T(`{n} ${n === 1 ? one : many}`, { n });

  // ---------------------------------------------------------------- meta, theme
  function applyTheme() { RF.applyTheme(S.settings.theme || '', S.settings.customThemes); }
  async function loadMeta() {
    S.meta = await window.rf.meta();
    S.settings = S.meta.settings || {};
    applyTheme();
    RF.setFormats(S.settings);
    document.body.classList.toggle('no-side', S.settings.sidePanel === false);
    renderFilterOptions();
    renderAlarmState();
    $('todoSort').value = sortKey();
    $('remDone').checked = !S.settings.hideCompleted;
    $('mDone').checked = S.mShowDone;
    applyColumns();
    $('statusCount').textContent = plural(S.meta.count, 'item', 'items');
    $('statusVersion').textContent = `ReminderFoxAgain ${S.meta.version}`;
    $('openFolder').title = S.meta.dataFile;
    fillSelect($('remCat'), [['', 'All'], ...S.meta.categories.map((c) => [c, c])], S.cat);
    fillSelect($('todoCat'), [['', 'All'], ...S.meta.categories.map((c) => [c, c])], S.todoCat);
    renderListPicker();
    S.cat = $('remCat').value; S.todoCat = $('todoCat').value;
    $('catList').innerHTML = S.meta.categories.map((c) => `<option value="${esc(c)}">`).join('');
    $('listList').innerHTML = S.meta.todoLists.map((c) => `<option value="${esc(c)}">`).join('');
  }
  function renderFilterOptions() {
    const sel = $('remFilter');
    const views = S.settings.views || [];
    sel.innerHTML = BASE_FILTERS + (views.length ? `<optgroup label="Saved filters">${views.map((v, i) => `<option value="view:${i}" translate="no">${esc(v.name)}</option>`).join('')}</optgroup>` : '') +
      '<option value="manage">Manage reminders…</option>';
    if (![...sel.options].some((o) => o.value === S.filter) || S.filter === 'manage') S.filter = 'upcoming';
    sel.value = S.filter;
  }
  // The Lists tab's dropdown: "To-Do's" and every custom list with its open count, then "All lists" and the list
  // actions. Picking an action runs it and puts the dropdown back on the list being shown.
  function renderListPicker(open) {
    const sel = $('todoList');
    const lists = S.meta.todoLists;
    if (S.todoList && !lists.includes(S.todoList)) S.todoList = DEFAULT_LIST;
    const n = (l) => (open ? ` (${open[l] || 0})` : '');
    const total = open ? ` (${Object.values(open).reduce((a, b) => a + b, 0)})` : '';
    sel.innerHTML = `<optgroup label="Lists">${lists.map((l) => `<option value="${esc(l)}" data-label="${esc(l)}${n(l)}">${esc(l)}${n(l)}</option>`).join('')}</optgroup>` +
      `<option value="" data-label="All lists${total}">All lists${total}</option>` +
      '<option disabled>──────────</option><option value="__new">＋ New list…</option><option value="__manage">Manage lists…</option>';
    sel.value = S.todoList;
    sel.title = 'Choose which list to show';
    markPickedList();
  }
  // The closed dropdown shows "List: Errands (2)", a hint that there are other lists in it: only the chosen option
  // carries the prefix, so the open dropdown lists the plain names (the chosen one reads "List: …").
  function markPickedList() {
    for (const o of $('todoList').options) if (o.dataset.label != null) o.textContent = (o.selected ? 'List: ' : '') + o.dataset.label;
  }
  async function pickList(value) {
    if (value === '__new' || value === '__manage') {
      $('todoList').value = S.todoList;
      markPickedList();
      if (value === '__new') { const l = await FX('askNewList'); if (l) await showList(l); }
      else FX('openLists');
      return;
    }
    await showList(value);
  }
  async function showList(l) {
    S.todoList = l;
    ls.set('todoList', l);
    $('todoList').value = l;
    markPickedList();
    if (S.tab !== 'todos') await setTab('todos'); else await renderTodos();
  }
  function renderAlarmState() {
    const sp = S.meta.suspend;
    const el = $('alarmState');
    el.classList.toggle('off', !!sp);
    if (!sp) { el.textContent = '🔔 Alarms on'; el.title = 'Suspend alarms for a while'; return; }
    el.textContent = sp.until ? `🔕 Alarms suspended until ${fmt.date(sp.until) === fmt.date(Date.now()) ? '' : `${fmt.date(sp.until)} `}${fmt.time(sp.until)} · Resume` : '🔕 Alarms suspended · Resume';
    el.title = 'Click to turn alarms back on';
  }
  function fillSelect(sel, opts, value) {
    sel.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    sel.value = opts.some(([v]) => v === value) ? value : opts[0][0];
  }

  // ---------------------------------------------------------------- counts
  async function updateCounts() {
    const [next, all] = await Promise.all([window.rf.next(todayStart().getTime()), window.rf.all()]);
    const rem = next.filter((r) => r.kind === 'event' && !r.past && !r.completed).length;
    const openTodos = all.filter((d) => d.kind === 'todo' && !d.completed);
    const open = {};
    for (const d of openTodos) open[d.list] = (open[d.list] || 0) + 1;
    renderListPicker(open);
    $('cntRem').textContent = rem ? ` ${rem}` : '';
    await updateBadge();
  }

  // ---------------------------------------------------------------- count on the tray and taskbar icons
  let badgeKey = null;
  let baseIcon = null;
  function loadIcon() {
    if (baseIcon) return baseIcon;
    baseIcon = new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = '../../assets/icon.png'; });
    return baseIcon;
  }
  function drawBadge(ctx, n, size, x, y, r) {
    const text = n > 99 ? '99+' : String(n);
    ctx.fillStyle = '#d93025';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(1, size / 16); ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(r * (text.length > 2 ? 0.95 : text.length > 1 ? 1.15 : 1.45))}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + r * 0.08);
  }
  async function badgeCount() {
    const t0 = todayStart();
    const days = S.settings.badge === 'upcoming' ? 1 + (Number(S.settings.upcomingDays) || 15) : 1;
    const rows = await window.rf.range(t0.getTime(), addDays(t0, days).getTime(), { includeTodos: true });
    const keys = new Set(rows.filter((r) => !r.completed).map(keyOf));
    return keys.size;
  }
  async function updateBadge() {
    const mode = S.settings.badge || 'today';
    const n = mode === 'off' ? 0 : await badgeCount();
    const key = `${mode}|${n}`;
    if (key === badgeKey) return;
    badgeKey = key;
    S.badge = n;
    if (!n) { await guard(window.rf.setBadge(null, null, '', 0)); return; }
    const icon = await loadIcon();
    const tc = document.createElement('canvas'); tc.width = 32; tc.height = 32;
    const t = tc.getContext('2d');
    if (icon) t.drawImage(icon, 0, 0, 32, 32);
    drawBadge(t, n, 32, 21, 21, 11);
    const oc = document.createElement('canvas'); oc.width = 16; oc.height = 16;
    drawBadge(oc.getContext('2d'), n, 16, 8, 8, 7.5);
    await guard(window.rf.setBadge(tc.toDataURL('image/png'), oc.toDataURL('image/png'), `${n} today`, n));
  }

  // ---------------------------------------------------------------- tabs
  const listView = $('listView');
  function saveScroll() {
    if (S.tab === 'reminders' && !S.search && !S.welcome && S.visited.has(S.filter)) S.scroll[S.filter] = listView.scrollTop;
  }
  async function setTab(tab) {
    saveScroll();
    S.tab = tab;
    for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    $('tbReminders').classList.toggle('hidden', tab !== 'reminders');
    $('tbTodos').classList.toggle('hidden', !todoTab(tab));
    $('tbTodoActs').classList.toggle('hidden', !todoTab(tab));
    $('tbMonth').classList.toggle('hidden', tab !== 'month');
    updateTodoActs();
    listView.classList.toggle('hidden', tab === 'month');
    $('monthView').classList.toggle('hidden', tab !== 'month');
    S.selKey = null;
    applyColumns();
    await renderMain('enter');
  }
  async function renderMain(reason) {
    if (S.tab === 'reminders') await renderReminders(reason);
    else if (todoTab()) await renderTodos(reason);
    else await renderMonth();
  }

  // ---------------------------------------------------------------- reminders list
  const HEAD_REM = '<thead><tr><th class="c-chk" title="Completed">✓</th><th class="c-imp" title="Important">★</th><th class="c-date">Date</th><th class="c-day">Day</th><th class="c-time">Time</th><th class="c-desc">Description</th><th class="c-repeat">Repeat</th><th class="c-cat">Category</th><th class="c-alarm" title="Alarm">🔔</th></tr></thead>';
  const HEAD_TODO = '<thead><tr><th class="c-chk" title="Completed">✓</th><th class="c-imp" title="Important">★</th><th class="c-date">Due by</th><th class="c-time">Time</th><th class="c-desc">Description</th><th class="c-repeat">Repeat</th><th class="c-cat">Category</th><th class="c-alarm" title="Alarm">🔔</th></tr></thead>';

  // ---------------------------------------------------------------- views (saved filters, like the add-on's)
  // A view: { name, criteria: [{ field: 'summary'|'categories'|'notes'|'location'|'any', value: 'a, b' }],
  //           date: { from: {n, unit}, to: {n, unit} } | null, includeTodos }
  // Commas inside one criterion mean "any of these"; separate criteria must all match (as in the add-on).
  const viewOf = (f) => (String(f).startsWith('view:') ? (S.settings.views || [])[Number(String(f).slice(5))] || null : null);
  function addSpan(d, n, unit) {
    const x = new Date(d);
    if (unit === 'W') x.setDate(x.getDate() + 7 * n); else if (unit === 'M') x.setMonth(x.getMonth() + n);
    else if (unit === 'Y') x.setFullYear(x.getFullYear() + n); else x.setDate(x.getDate() + n);
    return x;
  }
  function viewRange(v) {
    if (!v || !v.date) return null;
    const t0 = todayStart();
    let a = addSpan(t0, Number(v.date.from.n) || 0, v.date.from.unit);
    let b = addSpan(t0, (Number(v.date.to.n) || 0) + (v.date.to.unit === 'D' ? 1 : 0), v.date.to.unit);
    if (v.date.to.unit !== 'D') b = addDays(b, 1);
    if (b < a) [a, b] = [b, a];
    return [a, b];
  }
  function viewMatches(v, r) {
    return (v.criteria || []).every((c) => {
      const terms = String(c.value || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
      if (!terms.length) return true;
      const fields = { summary: r.summary, notes: r.notes, location: r.location, categories: (r.categories || []).join('\n') };
      const hay = String(c.field === 'any' ? Object.values(fields).join('\n') : fields[c.field] || '').toLowerCase();
      if (c.field === 'categories') return terms.some((t) => (r.categories || []).some((x) => x.toLowerCase() === t));
      return terms.some((t) => hay.includes(t));
    });
  }
  // how many upcoming occurrences of a repeating reminder to list (Settings → View)
  // how far ahead repeating reminders are projected in Upcoming, All, Important, search and date-less views
  // (Settings → View): 'n3' = the next 3 occurrences, 'm12' = every occurrence in the next 12 months
  function repeatOpts() {
    const v = String(S.settings.repeatAhead || 'm12');
    const n = Math.max(1, parseInt(v.slice(1), 10) || 1);
    if (v[0] === 'n') return { count: n };
    const until = todayStart(); until.setMonth(until.getMonth() + n);
    return { count: Infinity, until: until.getTime() };
  }

  async function reminderRows() {
    const t0 = todayStart();
    const q = S.search.trim().toLowerCase();
    let rows;
    // upcoming rows, past one-offs, and past occurrences of repeating reminders (ticked or not; tickedOnly: as before 0.3.1)
    const allRows = async (kinds = ['event'], tickedOnly = false) => {
      const [next, hist] = await Promise.all([window.rf.next(t0.getTime(), repeatOpts()), window.rf.history(t0.getTime(), { tickedOnly })]);
      const ev = next.filter((r) => kinds.includes(r.kind) && (r.kind === 'event' || r.start != null));
      const have = new Set(ev.map(keyOf));
      for (const h of hist) if (!have.has(keyOf(h))) { ev.push(h); have.add(keyOf(h)); }
      return ev;
    };
    if (q) rows = (await allRows()).filter((r) => matches(r, q));
    else {
      const f = S.filter;
      const range = async (a, b) => (await window.rf.range(a.getTime(), b.getTime(), { includeTodos: false }));
      if (f === 'today') rows = await range(t0, addDays(t0, 1));
      else if (f === 'week') rows = await range(t0, addDays(t0, 7));
      else if (f === 'day') { const d = parseKey(S.selDay); rows = await range(d, addDays(d, 1)); }
      else if (f === 'month') { const d = parseKey(S.selDay); d.setDate(1); const e = new Date(d); e.setMonth(e.getMonth() + 1); rows = await range(d, e); }
      else if (f === 'all') rows = await allRows();
      else if (viewOf(f)) {
        const v = viewOf(f);
        const kinds = v.includeTodos ? ['event', 'todo'] : ['event'];
        const span = viewRange(v);
        rows = span ? (await window.rf.range(span[0].getTime(), span[1].getTime(), { includeTodos: !!v.includeTodos })) : await allRows(kinds, true);
        rows = rows.filter((r) => kinds.includes(r.kind) && viewMatches(v, r));
      } else {
        const next = (await window.rf.next(t0.getTime(), repeatOpts())).filter((r) => r.kind === 'event');
        // past one-offs, and every past occurrence of repeating reminders, ticked or not
        if (f === 'past') rows = (await allRows()).filter((r) => r.past);
        else if (f === 'important') rows = next.filter((r) => r.important);
        else rows = next.filter((r) => !r.past);
      }
      if (S.cat) rows = rows.filter((r) => (r.categories || []).includes(S.cat));
      if (S.settings.hideRepeating && f !== 'day') rows = rows.filter((r) => !r.repeating);
    }
    // Show completed (the Reminders toolbar): ticked reminders are hidden everywhere when it is off
    if (S.settings.hideCompleted) rows = rows.filter((r) => !r.completed);
    rows.sort((a, b) => (a.start - b.start) || String(a.summary).localeCompare(String(b.summary)));
    return rows;
  }

  function hintFor(n) {
    const c = plural(n, 'reminder', 'reminders');
    if (S.search.trim()) return `Searching all reminders · ${c}`;
    const t0 = todayStart();
    if (S.filter === 'day') return `${fmt.long(parseKey(S.selDay))} · ${c}`;
    if (S.filter === 'today') return `${fmt.long(t0)} · ${c}`;
    if (S.filter === 'week') return `${fmt.date(t0)} – ${fmt.date(addDays(t0, 6))} · ${c}`;
    if (S.filter === 'month') return `${fmt.month(parseKey(S.selDay))} · ${c}`;
    const v = viewOf(S.filter);
    if (v) return T('Saved filter “{s}” · {c}', { s: v.name, c });
    return c;
  }

  function isPast(r) {
    const t0 = todayStart().getTime();
    return !!r.past || (r.end != null && (r.end > r.start ? r.end <= t0 : r.start < t0));
  }

  function rowHtml(r, opts) {
    const cls = [];
    if (r.date === S.today) cls.push('today');
    if (r.start != null && isPast(r)) cls.push('past');
    if (r.completed) cls.push('done');
    if (r.important) cls.push('important');
    const key = keyOf(r);
    if (key === S.selKey) cls.push('selected');
    const sub = r.location ? `<span class="sub">· ${esc(r.location)}</span>` : '';
    const flags = (r.carried ? `<span class="flag overdue" title="Missed on ${esc(fmt.long(r.overdueSince))}; it reminds you every day until you tick it">Overdue since ${esc(fmt.date(r.overdueSince))}</span>`
      : r.untilDone && !r.completed ? '<span class="flag" title="Remind daily until completed">Until done</span>' : '') +
      (r.showInTooltip ? '<span class="flag" title="Shown in the tray tooltip">Tooltip</span>' : '') +
      (opts.todo && r.remind && !r.completed ? `<span class="flag remind" title="${esc(remindTitle(r))}">🔔 ${esc(remindShort(r))}</span>` : '');
    const listSub = opts.listName ? `<span class="sub">· ${esc(opts.listName)}</span>` : '';
    const doneAt = r.completedAt ? `<span class="done-at" title="Completed ${esc(fmt.long(r.completedAt))}, ${esc(fmt.time(r.completedAt))}">✓ Completed ${esc(fmt.dateTime(r.completedAt))}</span>` : '';
    const rep = r.repeatText ? `<span title="${esc(r.repeatText)}">↻ ${esc(r.repeatText)}</span>` : '';
    const cats = (r.categories || []).map((c) => `<span class="chip">${esc(c)}</span>`).join('');
    let dateCells;
    if (opts.todo) {
      if (r.date) {
        const overdue = !r.completed && r.date < S.today;
        dateCells = `<td class="c-date"${overdue ? ' style="color:var(--danger);font-weight:600"' : ''}>${esc(fmt.relDay(r.date))}</td><td class="c-time">${r.time ? esc(fmt.time(parseKey(r.date).getTime() + toMin(r.time) * 60000)) : ''}</td>`;
      } else dateCells = '<td class="c-date" style="color:var(--ink-3)">—</td><td class="c-time"></td>';
    } else {
      dateCells = `<td class="c-date">${esc(fmt.date(r.start))}</td><td class="c-day">${esc(fmt.weekday(r.start))}</td><td class="c-time">${r.allDay ? '' : esc(fmt.time(r.start))}</td>`;
    }
    if (r.carried) cls.push('carried');
    return `<tr class="${cls.join(' ')}" data-key="${esc(key)}" data-uid="${esc(r.uid)}" data-start="${occOf(r) == null ? '' : occOf(r)}" data-sort="${r.start == null ? '' : r.start}">` +
      `<td class="c-chk"><input type="checkbox" class="chk" data-act="done"${r.completed ? ' checked' : ''} aria-label="Completed"></td>` +
      `<td class="c-imp">${r.important ? '<span class="imp" title="Important">★</span>' : ''}</td>` +
      dateCells +
      `<td class="c-desc"><span class="t">${esc(r.summary || '(no description)')}</span>${sub}${listSub}${flags}${doneAt}</td>` +
      `<td class="c-repeat">${rep}</td><td class="c-cat">${cats}</td>` +
      `<td class="c-alarm">${r.hasAlarm ? '<span class="bell" title="Alarm">🔔</span>' : ''}</td></tr>`;
  }
  const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  // a to-do's reminder plan in a few words, for the list
  function remindShort(r) {
    const p = r.remind;
    const every = { once: '', day: T('daily'), '2days': T('every {n} days', { n: 2 }), week: T('weekly'), '2weeks': T('every {n} weeks', { n: 2 }), month: T('monthly') }[p.every] || '';
    const from = p.start === 'date' ? fmt.date(parseKey(p.date)) : p.days ? T('{n} d before', { n: p.days }) : T('on the day');
    return every ? T('{every} from {from}', { every, from }) : from;
  }
  function remindTitle(r) {
    const p = r.remind;
    const from = p.start === 'date' ? fmt.long(parseKey(p.date)) : p.days ? T(p.days === 1 ? '{n} day before the due date' : '{n} days before the due date', { n: p.days }) : T('on the due date');
    const every = { once: T('once'), day: T('every day'), '2days': T('every {n} days', { n: 2 }), week: T('every week'), '2weeks': T('every {n} weeks', { n: 2 }), month: T('every month') }[p.every];
    const time = fmt.time(parseKey(S.today).getTime() + toMin(p.at) * 60000);
    const key = p.every === 'once' ? 'Reminds you {every}, from {from}, at {time}' : r.date && p.afterDue ? "Reminds you {every}, from {from}, at {time}, until it's done (also after the due date)" : "Reminds you {every}, from {from}, at {time}, until it's done";
    return T(key, { every, from, time });
  }

  async function renderReminders(reason) {
    if (S.welcome) { renderWelcome(); return; }
    const keep = listView.scrollTop;
    const anchor = reason === 'anchor' ? anchorOf() : null;
    const rows = await reminderRows();
    S.rows = rows;
    $('remHint').textContent = hintFor(rows.length);
    if (!rows.length) {
      listView.innerHTML = S.search.trim()
        ? '<div class="empty"><h3>Nothing matches your search</h3><div>Try different words.</div></div>'
        : '<div class="empty"><h3>No reminders here</h3><div>Click ＋ Reminder to add one, or choose a different view.</div></div>';
    } else {
      const sep = S.filter !== 'day' || S.search.trim();
      let html = `<table class="list">${HEAD_REM}<tbody>`;
      let lastMonth = '';
      // each month heading says how many reminders fall in it, so busy months stand out
      const perMonth = new Map();
      for (const r of rows) { const mk = fmt.month(r.start); perMonth.set(mk, (perMonth.get(mk) || 0) + 1); }
      for (const r of rows) {
        const mk = fmt.month(r.start);
        if (sep && mk !== lastMonth) {
          const extra = `<span class="sep-count">${esc(plural(perMonth.get(mk), 'reminder', 'reminders'))}</span>`;
          html += `<tr class="sep"><td colspan="9">${esc(mk)}${extra}</td></tr>`; lastMonth = mk;
        }
        html += rowHtml(r, {});
      }
      listView.innerHTML = html + '</tbody></table>';
    }
    if (anchor) restoreAnchor(anchor); else position(reason === 'anchor' ? 'refresh' : reason, keep);
  }

  // ---------------------------------------------------------------- keeping your place
  // The row at the top of the list (the first one at least half below the column headings), with the keys of the rows
  // after it and its date, so the same place can be found again after rows were added or removed around it.
  const headH = () => { const th = listView.querySelector('thead th'); return th ? th.getBoundingClientRect().height : 0; };
  const rowTop = (tr) => tr.getBoundingClientRect().top - listView.getBoundingClientRect().top + listView.scrollTop;
  function anchorOf() {
    const trs = [...listView.querySelectorAll('tbody tr[data-key]')];
    const top = listView.scrollTop + headH();
    const i = trs.findIndex((tr) => rowTop(tr) + tr.offsetHeight / 2 > top);
    if (i < 0) return null;
    const sort = trs[i].dataset.sort;
    return { keys: trs.slice(i).map((t) => t.dataset.key), before: trs.slice(0, i).reverse().map((t) => t.dataset.key), sort: sort === '' ? null : Number(sort), off: rowTop(trs[i]) - listView.scrollTop };
  }
  // the same row again, else the next one still shown, else the first one on or after its date, else the one shown
  // just before it; it goes back to where it was on the screen
  function restoreAnchor(a) {
    const trs = [...listView.querySelectorAll('tbody tr[data-key]')];
    if (!trs.length) return;
    const byKey = new Map(trs.map((t) => [t.dataset.key, t]));
    let tr = null;
    for (const k of a.keys) if (byKey.has(k)) { tr = byKey.get(k); break; }
    if (!tr && a.sort != null) tr = trs.find((t) => t.dataset.sort !== '' && Number(t.dataset.sort) >= a.sort) || null;
    if (!tr) for (const k of a.before) if (byKey.has(k)) { tr = byKey.get(k); break; }
    if (!tr) return;
    listView.scrollTop = Math.max(0, rowTop(tr) - a.off);
    if (S.tab === 'reminders' && !S.search) S.scroll[S.filter] = listView.scrollTop;
  }
  // Puts the first row on or after day k at the top of the Reminders list (with its month heading), as far as the
  // list allows: a day before the first row shows the top, a day after the last row shows the end.
  function scrollToDay(k) {
    const t = parseKey(k).getTime();
    const trs = [...listView.querySelectorAll('tbody tr[data-key]')].filter((tr) => tr.dataset.sort !== '');
    if (!trs.length) return false;
    const tr = trs.find((x) => startOfDay(Number(x.dataset.sort)).getTime() >= t);
    if (!tr) { listView.scrollTop = listView.scrollHeight; }
    else {
      const prev = tr.previousElementSibling;
      const target = prev && prev.classList.contains('sep') ? prev : tr;
      listView.scrollTop = Math.max(0, rowTop(target) - headH());
    }
    if (!S.search) { S.visited.add(S.filter); S.scroll[S.filter] = listView.scrollTop; }
    return true;
  }

  function position(reason, keep) {
    if (S.search.trim()) { if (reason !== 'refresh') listView.scrollTop = 0; else listView.scrollTop = keep; return; }
    if (reason === 'refresh') { listView.scrollTop = keep; return; }
    if (!S.visited.has(S.filter)) {
      if (!listView.clientHeight) { S.pendingStart = true; return; }
      startPosition();
      S.visited.add(S.filter);
    } else listView.scrollTop = S.scroll[S.filter] || 0;
  }
  function startPosition() {
    S.pendingStart = false;
    if (S.filter === 'past') { listView.scrollTop = listView.scrollHeight; return; }
    const trs = [...listView.querySelectorAll('tbody tr[data-start]')];
    if (!trs.length) { listView.scrollTop = 0; return; }
    const t0 = todayStart().getTime();
    let best = null; let bestD = Infinity;
    for (const tr of trs) {
      const st = startOfDay(Number(tr.dataset.sort || tr.dataset.start)).getTime();
      const d = Math.abs(st - t0);
      if (d < bestD || (d === bestD && st >= t0 && best && startOfDay(Number(best.dataset.sort || best.dataset.start)).getTime() < t0)) { best = tr; bestD = d; }
    }
    let target = best;
    const prev = best.previousElementSibling;
    if (prev && prev.classList.contains('sep')) target = prev;
    const th = listView.querySelector('thead th');
    const head = th ? th.getBoundingClientRect().height : 0;
    const top = target.getBoundingClientRect().top - listView.getBoundingClientRect().top + listView.scrollTop;
    listView.scrollTop = Math.max(0, top - head);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.pendingStart && S.tab === 'reminders') {
      requestAnimationFrame(() => { if (listView.clientHeight) { startPosition(); S.visited.add(S.filter); } });
    }
  });

  // ---------------------------------------------------------------- to-do list
  async function renderTodos(reason) {
    const keep = listView.scrollTop;
    const anchor = reason === 'anchor' ? anchorOf() : null;
    const all = (await window.rf.all()).filter((d) => d.kind === 'todo');
    const q = S.search.trim().toLowerCase();
    const list = curList();
    let items = all.filter((d) => (!list || d.list === list) && (!S.todoCat || d.categories.includes(S.todoCat)) && matches(d, q));
    const open = items.filter((d) => !d.completed).length;
    const done = items.length - open;
    $('todoHint').textContent = `${open} open · ${done} done`;
    if (!S.showDone) items = items.filter((d) => !d.completed);
    items.sort(todoSorter());
    const multi = S.meta.todoLists.length > 1;
    S.todos = items;
    if (!items.length) {
      listView.innerHTML = q ? '<div class="empty"><h3>Nothing matches your search</h3><div>Try different words.</div></div>'
        : `<div class="empty"><h3>${list ? `“${esc(list)}” is empty` : 'Nothing to do'}</h3><div>Click ＋ List Item to add one${list ? ' to this list' : ''}.</div></div>`;
    } else {
      let html = `<table class="list">${HEAD_TODO}<tbody>`;
      for (const d of items) {
        const start = d.date ? parseKey(d.date).getTime() + (d.time ? toMin(d.time) * 60000 : 0) : null;
        const r = { ...d, summary: d.display || d.summary, start, end: start, hasAlarm: !!d.alarm, completedAt: null };
        html += rowHtml(r, { todo: true, listName: !list && multi && d.list !== DEFAULT_LIST ? d.list : '' });
      }
      listView.innerHTML = html + '</tbody></table>';
      if (manualOrder() && !q) for (const tr of listView.querySelectorAll('tbody tr[data-uid]')) { tr.draggable = true; tr.classList.add('drag'); }
      for (const tr of listView.querySelectorAll('tr.past')) tr.classList.remove('past');
    }
    if (anchor) restoreAnchor(anchor); else listView.scrollTop = reason === 'refresh' || reason === 'anchor' ? keep : 0;
    updateTodoActs();
  }

  const byDate = (a, b) => ((!a.date) - (!b.date)) ||
    String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '').localeCompare(String(b.time || '')) ||
    (b.important - a.important) || String(a.summary).localeCompare(String(b.summary));
  const orderOf = (d) => (d.order == null ? 1e9 : d.order);
  // Order (the Lists toolbar): My order, or by any column. Completed items stay at the bottom, except when ordering
  // by Completed, which puts them first, the most recently completed at the top.
  const text = (x) => String(x || '');
  const cmpText = (a, b) => text(a).localeCompare(text(b), RF.LOCALE, { sensitivity: 'base', numeric: true });
  const firstCat = (d) => [...(d.categories || [])].sort(cmpText)[0] || '';
  const SORTS = {
    manual: (a, b) => (orderOf(a) - orderOf(b)) || byDate(a, b),
    date: byDate,
    time: (a, b) => ((!a.time) - (!b.time)) || text(a.time).localeCompare(text(b.time)) || byDate(a, b),
    summary: (a, b) => cmpText(a.display || a.summary, b.display || b.summary) || byDate(a, b),
    important: (a, b) => (!!b.important - !!a.important) || byDate(a, b),
    repeat: (a, b) => (!!b.repeat - !!a.repeat) || cmpText(a.repeatText, b.repeatText) || byDate(a, b),
    category: (a, b) => ((!firstCat(a)) - (!firstCat(b))) || cmpText(firstCat(a), firstCat(b)) || byDate(a, b),
    alarm: (a, b) => (!!(b.alarm || b.remind) - !!(a.alarm || a.remind)) || byDate(a, b),
  };
  function todoSorter() {
    const k = sortKey();
    if (k === 'completed') return (a, b) => (b.completed - a.completed) || text(b.completedDate).localeCompare(text(a.completedDate)) || byDate(a, b);
    return (a, b) => (a.completed - b.completed) || SORTS[k](a, b);
  }
  // My order: put `uid` just before (or after) `target` and number the whole list 1, 2, 3…
  async function reorder(uid, target, after) {
    if (!uid || !target || uid === target) return;
    const list = curList();
    const all = (await window.rf.all()).filter((d) => d.kind === 'todo' && (!list || d.list === list));
    all.sort(todoSorter());
    const ids = all.map((d) => d.uid).filter((x) => x !== uid);
    let i = ids.indexOf(target);
    if (i < 0) return;
    if (after) i++;
    ids.splice(i, 0, uid);
    await guard(window.rf.setOrder(ids));
  }
  async function moveSelected(dir) {
    const trs = [...listView.querySelectorAll('tbody tr[data-uid]')];
    const i = trs.findIndex((t) => t.dataset.key === S.selKey);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= trs.length) return;
    if (!manualOrder()) { await setSetting({ todoSort: 'manual' }); $('todoSort').value = 'manual'; }
    await reorder(trs[i].dataset.uid, trs[j].dataset.uid, dir > 0);
  }
  let dragUid = null;
  listView.addEventListener('dragstart', (e) => {
    const tr = e.target.closest && e.target.closest('tr.drag');
    if (!tr) return;
    dragUid = tr.dataset.uid;
    tr.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragUid); } catch (err) { /* ignore */ }
  });
  const clearDrop = () => { for (const x of listView.querySelectorAll('.drop-before,.drop-after,.dragging')) x.classList.remove('drop-before', 'drop-after', 'dragging'); };
  listView.addEventListener('dragover', (e) => {
    if (!dragUid) return;
    const tr = e.target.closest('tr.drag');
    if (!tr) return;
    e.preventDefault();
    const after = e.clientY > tr.getBoundingClientRect().top + tr.offsetHeight / 2;
    for (const x of listView.querySelectorAll('.drop-before,.drop-after')) if (x !== tr) x.classList.remove('drop-before', 'drop-after');
    tr.classList.toggle('drop-after', after);
    tr.classList.toggle('drop-before', !after);
  });
  listView.addEventListener('drop', async (e) => {
    if (!dragUid) return;
    const tr = e.target.closest('tr.drag');
    e.preventDefault();
    const uid = dragUid; dragUid = null;
    const after = tr && tr.classList.contains('drop-after');
    clearDrop();
    if (tr) await reorder(uid, tr.dataset.uid, after);
  });
  listView.addEventListener('dragend', () => { dragUid = null; clearDrop(); });

  // ---------------------------------------------------------------- month grid
  function gridStart(monthFirst) {
    const ws = Number(S.settings.weekStart) || 0;
    const off = (monthFirst.getDay() - ws + 7) % 7;
    return addDays(monthFirst, -off);
  }
  function spreadByDay(rows, from, to) {
    const map = new Map();
    for (const r of rows) {
      let d = startOfDay(r.start);
      const last = r.end > r.start ? r.end - 1 : r.start;
      for (let i = 0; i < 62 && d.getTime() <= last; i++, d = addDays(d, 1)) {
        if (d < from || d >= to) continue;
        const k = dayKey(d);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(r);
      }
    }
    for (const list of map.values()) list.sort((a, b) => (b.allDay - a.allDay) || (a.start - b.start) || String(a.summary).localeCompare(String(b.summary)));
    return map;
  }
  function chipHtml(r) {
    const cls = ['ev'];
    if (r.allDay) cls.push('allday');
    if (r.kind === 'todo') cls.push('todo');
    if (r.completed) cls.push('done');
    if (r.important) cls.push('important');
    if (r.carried) cls.push('carried');
    const pre = (r.kind === 'todo' ? '☐ ' : '') + (r.important ? '★ ' : '');
    const tm = r.allDay ? '' : `<span class="tm">${esc(fmt.time(r.start))}</span>`;
    return `<div class="${cls.join(' ')}" data-uid="${esc(r.uid)}" data-start="${occOf(r)}" title="${esc((r.allDay ? '' : fmt.time(r.start) + ' ') + r.summary + (r.carried ? ` (overdue since ${fmt.date(r.overdueSince)})` : ''))}">${tm}${esc(pre + r.summary)}</div>`;
  }
  async function renderMonth() {
    const first = new Date(S.monthView);
    $('mTitle').textContent = fmt.month(first);
    const ws = Number(S.settings.weekStart) || 0;
    const gs = gridStart(first);
    $('monthHead').innerHTML = Array.from({ length: 7 }, (_, i) => `<div>${esc(fmt.weekday(addDays(gs, i)))}</div>`).join('');
    const ge = addDays(gs, 42);
    const q = S.search.trim().toLowerCase();
    // Show completed (the Month toolbar, off at first): ticked reminders and list items
    const rows = (await window.rf.range(gs.getTime(), ge.getTime(), { includeTodos: S.mTodos })).filter((r) => (S.mShowDone || !r.completed) && matches(r, q));
    const map = spreadByDay(rows, gs, ge);
    const grid = $('monthGrid');
    let html = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(gs, i);
      const k = dayKey(d);
      const cls = ['cell'];
      if (d.getMonth() !== first.getMonth()) cls.push('out');
      if (k === S.today) cls.push('today');
      if (k === S.selDay) cls.push('picked');
      html += `<div class="${cls.join(' ')}" data-day="${k}"><span class="num">${d.getDate()}</span></div>`;
    }
    grid.innerHTML = html;
    void ws;
    const cell = grid.firstElementChild;
    const h = cell ? cell.clientHeight : 100;
    const fit = Math.max(1, Math.floor((h - 26) / 20));
    for (const c of grid.children) {
      const list = map.get(c.dataset.day) || [];
      let shown = list;
      let more = 0;
      if (list.length > fit) { shown = list.slice(0, Math.max(0, fit - 1)); more = list.length - shown.length; }
      c.insertAdjacentHTML('beforeend', shown.map(chipHtml).join('') + (more ? `<div class="more" data-day="${c.dataset.day}">${esc(T('+{n} more', { n: more }))}</div>` : ''));
    }
  }

  // ---------------------------------------------------------------- side panel
  function monthHtml(m, rowsMap, first, last) {
    const gs = gridStart(m);
    const nav = (a, t, ch) => `<button class="nav" data-cal="${a}" title="${t}">${ch}</button>`;
    let html = `<div class="mcal-head">${first ? nav('prev', 'Previous month', '‹') : '<span class="nav-sp"></span>'}<span class="ttl" data-cal="today" title="Go to today">${esc(fmt.month(m))}</span>${last ? nav('next', 'Next month', '›') : '<span class="nav-sp"></span>'}</div><div class="mgrid">`;
    for (let i = 0; i < 7; i++) html += `<div class="wd">${esc(fmt.narrow(addDays(gs, i)))}</div>`;
    for (let i = 0; i < 42; i++) {
      const d = addDays(gs, i);
      const k = dayKey(d);
      const out = d.getMonth() !== m.getMonth();
      const list = rowsMap.get(k) || [];
      const openItems = list.filter((r) => !r.completed);
      const cls = ['mday'];
      if (out) cls.push('out');
      if (openItems.length) cls.push('has');
      if (openItems.some((r) => r.important)) cls.push('imp');
      // a day in the past with something still open: a to-do not ticked, or a "remind until completed" reminder
      const overdue = k < S.today && openItems.some((r) => r.kind === 'todo' || r.untilDone);
      if (overdue) cls.push('overdue');
      if (k === S.today) cls.push('today');
      if (k === S.selDay) cls.push('picked');
      const tip = (overdue ? 'Not done yet\n' : '') + list.slice(0, 6).map((r) => `${r.allDay ? (r.kind === 'todo' ? 'To-do' : 'All day') : fmt.time(r.start)} ${r.summary}`).join('\n');
      html += `<button class="${cls.join(' ')}" data-day="${k}"${tip.trim() ? ` title="${esc(tip.trim())}"` : ''}>${d.getDate()}</button>`;
    }
    return `${html}</div>`;
  }
  async function renderSide() {
    const n = Math.min(3, Math.max(1, Number(S.settings.miniMonths) || 1));
    const months = Array.from({ length: n }, (_, i) => new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + i, 1));
    const gs = gridStart(months[0]);
    const ge = addDays(gridStart(months[n - 1]), 42);
    const rows = (await window.rf.range(gs.getTime(), ge.getTime(), { includeTodos: true })).filter(notDoneItem);
    const map = spreadByDay(rows, gs, ge);
    let html = months.map((m, i) => `<div class="mcal-month${i ? ' more-month' : ''}">${monthHtml(m, map, i === 0, i === n - 1)}</div>`).join('');
    html += '<div class="mcal-foot"><button class="btn ghost" data-cal="today">Today</button><button class="btn ghost" data-cal="goto" title="Go to a date (Ctrl+G)">Go to…</button><button class="btn ghost" data-cal="list">Show day in list</button></div>';
    $('mcal').innerHTML = html;
    $('mcal').classList.toggle('multi', n > 1);
    await renderAgenda();
  }
  async function renderAgenda() {
    const d = parseKey(S.selDay);
    const rows = (await window.rf.range(d.getTime(), addDays(d, 1).getTime(), { includeTodos: true })).filter(notDoneItem)
      .sort((a, b) => (b.allDay - a.allDay) || (a.start - b.start));
    const head = S.selDay === S.today ? `Today · ${fmt.date(d)}` : fmt.long(d);
    let html = `<h3><span>${esc(head)}</span><button class="btn ghost" data-ag="add" title="Add a reminder on this day">＋</button></h3>`;
    if (!rows.length) html += '<div class="none">Nothing on this day.</div>';
    for (const r of rows) {
      const tm = r.kind === 'todo' ? 'To-do' : r.allDay ? 'All day' : fmt.time(r.start);
      const small = [r.carried ? `Overdue since ${fmt.date(r.overdueSince)}` : '', r.location, r.repeatText ? `↻ ${r.repeatText}` : ''].filter(Boolean).map(esc).join(' · ');
      html += `<div class="item${r.completed ? ' done' : ''}${r.important ? ' important' : ''}${r.carried ? ' carried' : ''}" data-uid="${esc(r.uid)}" data-start="${occOf(r)}"><div class="tm">${esc(tm)}</div><div class="tx"><b>${r.important ? '★ ' : ''}${esc(r.summary)}</b>${small ? `<small>${small}</small>` : ''}</div></div>`;
    }
    $('agenda').innerHTML = html;
  }
  async function selectDay(k, opts = {}) {
    S.selDay = k;
    const d = parseKey(k);
    const n = Math.min(3, Math.max(1, Number(S.settings.miniMonths) || 1));
    const idx = (d.getFullYear() - S.calMonth.getFullYear()) * 12 + d.getMonth() - S.calMonth.getMonth();
    if (idx < 0 || idx >= n) { S.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); }
    await renderSide();
    if (opts.list !== false && S.tab === 'reminders' && (S.filter === 'day' || S.filter === 'month') && !S.search) await renderReminders('refresh');
    // a day picked in the calendar panel starts the Reminders list there, within what the Show choice lists
    else if (opts.scroll && S.tab === 'reminders' && !S.welcome) scrollToDay(k);
    if (S.tab === 'month') for (const c of $('monthGrid').children) c.classList.toggle('picked', c.dataset.day === k);
  }
  $('mcal').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cal],[data-day]');
    if (!b) return;
    if (b.dataset.day) { await selectDay(b.dataset.day, { scroll: true }); return; }
    const a = b.dataset.cal;
    if (a === 'prev' || a === 'next') { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + (a === 'prev' ? -1 : 1), 1); await renderSide(); }
    else if (a === 'today') await selectDay(S.today, { scroll: true });
    else if (a === 'list') { await showDayInList(S.selDay); }
    else if (a === 'goto') FX('openGoTo');
  });
  // Go to a date: select it in the calendar; the Month tab moves to it, the lists show that day
  async function goToDate(k) {
    if (!k) return;
    if (S.tab === 'month') {
      const d = parseKey(k);
      S.monthView = new Date(d.getFullYear(), d.getMonth(), 1);
      await selectDay(k);
      await renderMonth();
    } else { S.calMonth = new Date(parseKey(k).getFullYear(), parseKey(k).getMonth(), 1); await showDayInList(k); }
  }
  async function toggleSide() {
    const on = S.settings.sidePanel === false;
    document.body.classList.toggle('no-side', !on);
    await setSetting({ sidePanel: on });
    if (S.tab === 'month') renderMonth();
  }
  $('sideToggle').addEventListener('click', toggleSide);
  $('alarmState').addEventListener('click', async () => {
    if (S.meta.suspend) { S.meta.suspend = await guard(window.rf.suspend(0)); renderAlarmState(); toast('Alarms are on again'); } else FX('openSuspend');
  });
  $('quickBtn').addEventListener('click', () => FX('openQuick'));
  $('mcal').addEventListener('dblclick', (e) => {
    const b = e.target.closest('.mday');
    if (b) openEditor({ kind: 'event', date: b.dataset.day });
  });
  $('agenda').addEventListener('click', (e) => {
    if (e.target.closest('[data-ag=add]')) { openEditor({ kind: 'event', date: S.selDay }); return; }
    const it = e.target.closest('.item');
    if (it) openEditor({ uid: it.dataset.uid, start: Number(it.dataset.start) });
  });
  async function showDayInList(k) {
    S.selDay = k;
    saveScroll();
    S.filter = 'day';
    $('remFilter').value = 'day';
    ls.set('remFilter', 'day');
    if (S.tab !== 'reminders') await setTab('reminders'); else await renderReminders('enter');
    await renderSide();
  }

  // ---------------------------------------------------------------- refresh
  let refreshing = null;
  async function refresh() {
    if (refreshing) { refreshing.again = true; return refreshing.p; }
    const job = { again: false };
    job.p = (async () => {
      do {
        job.again = false;
        await loadMeta();
        S.welcome = S.meta.count === 0 && !S.meta.archiveCount && !S.settings.welcomeDone;
        await Promise.all([renderMain('refresh'), renderSide(), updateCounts()]);
      } while (job.again);
    })().finally(() => { refreshing = null; });
    refreshing = job;
    return job.p;
  }

  // ---------------------------------------------------------------- list interaction
  function rowFromTr(tr) {
    const key = tr.dataset.key;
    const r = (todoTab() ? S.todos.map((d) => ({ ...d, start: tr.dataset.start ? Number(tr.dataset.start) : null })) : S.rows)
      .find((x) => x.uid === tr.dataset.uid && (todoTab() || keyOf(x) === key));
    return r;
  }
  function selectTr(tr, scroll) {
    for (const x of listView.querySelectorAll('tr.selected')) x.classList.remove('selected');
    if (!tr) { S.selKey = null; updateTodoActs(); return; }
    tr.classList.add('selected');
    S.selKey = tr.dataset.key;
    if (scroll) tr.scrollIntoView({ block: 'nearest' });
    updateTodoActs();
  }
  // the Lists toolbar shows Duplicate / Move / Copy / Delete while an item is selected
  function selectedTr() { return S.selKey ? listView.querySelector(`tbody tr[data-key="${CSS.escape(S.selKey)}"]`) : null; }
  function updateTodoActs() {
    const on = todoTab() && !!selectedTr();
    for (const b of $('todoActs').querySelectorAll('button')) b.disabled = !on;
  }
  $('todoActs').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-ta]');
    const tr = selectedTr();
    if (!b || !tr) return;
    const dto = await guard(window.rf.get(tr.dataset.uid));
    if (!dto) return;
    const a = b.dataset.ta;
    if (a === 'dup') await duplicate(dto);
    else if (a === 'move') await FX('askMoveToList', dto);
    else if (a === 'copy') await FX('askMoveToList', dto, { copy: true });
    else if (a === 'del') await confirmDelete(dto, null);
  });
  listView.addEventListener('click', async (e) => {
    const opt = e.target.closest('.opt');
    if (opt) { welcomeChoice(opt); return; }
    const tr = e.target.closest('tbody tr[data-key]');
    if (!tr) return;
    if (e.target.matches('input[data-act=done]')) {
      const done = e.target.checked;
      const start = tr.dataset.start ? Number(tr.dataset.start) : undefined;
      const res = await guard(window.rf.complete(tr.dataset.uid, done, start));
      if (res === 'advanced') toast('Done — moved to the next date');
      return;
    }
    selectTr(tr);
    const r = rowFromTr(tr);
    if (r && r.date && S.tab === 'reminders') await selectDay(r.date, { list: false });
    else if (r && r.date && todoTab()) await selectDay(r.date, { list: false });
  });
  listView.addEventListener('dblclick', (e) => {
    const tr = e.target.closest('tbody tr[data-key]');
    if (!tr || e.target.matches('input')) return;
    openEditor({ uid: tr.dataset.uid, start: tr.dataset.start ? Number(tr.dataset.start) : null });
  });
  listView.addEventListener('contextmenu', (e) => {
    const tr = e.target.closest('tbody tr[data-key]');
    if (!tr) return;
    e.preventDefault();
    selectTr(tr);
    showCtx(tr, e.clientX, e.clientY);
  });

  // ---------------------------------------------------------------- context menu
  const ctx = $('ctx');
  let ctxRow = null;
  async function showCtx(tr, x, y) {
    const dto = await guard(window.rf.get(tr.dataset.uid));
    if (!dto) return;
    const start = tr.dataset.start ? Number(tr.dataset.start) : null;
    const checked = tr.querySelector('input[data-act=done]').checked;
    ctxRow = { uid: dto.uid, start, dto, checked };
    const repeatingEvent = dto.kind === 'event' && dto.repeat;
    ctx.innerHTML = '<button data-ctx="edit">Edit…</button>' +
      `<button data-ctx="toggle">${checked ? 'Mark not completed' : 'Mark completed'}</button>` +
      (dto.kind === 'event' ? `<button data-ctx="ruc">${dto.untilDone ? '✓ ' : ''}Remind daily until completed</button>` : `<button data-ctx="tip">${dto.showInTooltip ? '✓ ' : ''}Show in the tray tooltip</button>`) +
      (dto.kind === 'todo' ? '<button data-ctx="list">Move to list…</button><button data-ctx="copy">Copy to list…</button><button data-ctx="schedule">Schedule as a reminder…</button>'
        : '<button data-ctx="list">Make it a to-do…</button><button data-ctx="copy">Copy to a list…</button>') +
      (dto.kind === 'todo' && todoTab() && !S.search.trim() ? '<button data-ctx="up">Move up <span class="kbd">Alt+↑</span></button><button data-ctx="down">Move down <span class="kbd">Alt+↓</span></button>' : '') +
      (dto.location ? '<button data-ctx="map">Show on a map</button>' : '') +
      '<button data-ctx="dup">Duplicate <span class="kbd">Ctrl+D</span></button><hr>' +
      (repeatingEvent ? '<button data-ctx="delOne">Delete this occurrence</button><button data-ctx="delAll">Delete all occurrences…</button>' : '<button data-ctx="del">Delete…</button>');
    ctx.classList.remove('hidden');
    const w = ctx.offsetWidth; const h = ctx.offsetHeight;
    ctx.style.left = `${Math.max(4, Math.min(x, window.innerWidth - w - 4))}px`;
    ctx.style.top = `${Math.max(4, Math.min(y, window.innerHeight - h - 4))}px`;
  }
  const hideCtx = () => ctx.classList.add('hidden');
  document.addEventListener('mousedown', (e) => { if (!ctx.contains(e.target)) hideCtx(); });
  window.addEventListener('blur', hideCtx);
  ctx.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-ctx]');
    if (!b || !ctxRow) return;
    hideCtx();
    const { uid, start, dto, checked } = ctxRow;
    const a = b.dataset.ctx;
    if (a === 'edit') openEditor({ uid, start });
    else if (a === 'toggle') { const r = await guard(window.rf.complete(uid, !checked, start == null ? undefined : start)); if (r === 'advanced') toast('Done — moved to the next date'); }
    else if (a === 'dup') await duplicate(dto);
    else if (a === 'list') await FX('askMoveToList', dto);
    else if (a === 'copy') await FX('askMoveToList', dto, { copy: true });
    else if (a === 'schedule') await FX('askSchedule', dto);
    else if (a === 'up' || a === 'down') { selectTr(listView.querySelector(`tr[data-key="${CSS.escape(tr0Key())}"]`)); await moveSelected(a === 'up' ? -1 : 1); }
    else if (a === 'map') openMap(dto.location);
    else if (a === 'ruc') { if (await guard(window.rf.save({ ...dto, untilDone: !dto.untilDone }))) toast(dto.untilDone ? 'No longer reminds daily' : 'Reminds daily until completed'); }
    else if (a === 'tip') { if (await guard(window.rf.save({ ...dto, showInTooltip: !dto.showInTooltip }))) toast(dto.showInTooltip ? 'Removed from the tray tooltip' : 'Shown in the tray tooltip'); }
    else if (a === 'delOne') { if (await guard(window.rf.remove(uid, start))) toast('Occurrence deleted'); }
    else if (a === 'delAll') {
      const ok = await confirmDlg('Delete all occurrences?', `<div>${esc(T('“{s}” and all its repeats will be deleted.', { s: dto.summary || T('(no description)') }))}</div>`, [{ label: 'Cancel', value: false }, { label: 'Delete all', cls: 'danger', value: true }]);
      if (ok && await guard(window.rf.remove(uid))) toast('Deleted');
    } else if (a === 'del') await confirmDelete(dto, null);
  });
  const tr0Key = () => S.selKey || '';
  function mapUrl(place) {
    const q = encodeURIComponent(String(place || '').trim());
    const svc = S.settings.mapService;
    if (svc === 'osm') return `https://www.openstreetmap.org/search?query=${q}`;
    if (svc === 'bing') return `https://www.bing.com/maps?q=${q}`;
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }
  function openMap(place) {
    if (!String(place || '').trim()) { toast('Enter a location first.'); return; }
    guard(window.rf.openUrl(mapUrl(place)));
  }
  // An exact copy right after the original (same list, same place in "My order"), titled "… (copy)".
  async function duplicate(dto) {
    const uid = await guard(window.rf.duplicate(dto.uid, { suffix: ' (copy)' }));
    if (uid) toast(`Duplicated “${dto.summary}”`, 4500, { label: 'Edit the copy', fn: () => openEditor({ uid }) });
    return uid;
  }
  async function confirmDelete(dto, occStart) {
    if (dto.kind === 'event' && dto.repeat && occStart != null) {
      const v = await confirmDlg('Delete repeating reminder',
        `<div>${esc(T('“{s}” repeats ({rule}).', { s: dto.summary || T('(no description)'), rule: dto.repeatText }))}</div><div>${esc(T('Delete just the one on {date}, or every occurrence?', { date: fmt.long(occStart) }))}</div>`,
        [{ label: 'Cancel', value: null }, { label: 'Only this one', value: 'one' }, { label: 'All occurrences', cls: 'danger', value: 'all' }]);
      if (v === 'one') { if (await guard(window.rf.remove(dto.uid, occStart))) { toast('Occurrence deleted'); return true; } }
      if (v === 'all') { if (await guard(window.rf.remove(dto.uid))) { toast('Deleted'); return true; } }
      return false;
    }
    const ok = await confirmDlg(dto.kind === 'todo' ? 'Delete to-do?' : 'Delete reminder?', `<div>${esc(T('“{s}” will be deleted.', { s: dto.summary || T('(no description)') }))}</div>`, [{ label: 'Cancel', value: false }, { label: 'Delete', cls: 'danger', value: true }]);
    if (ok && await guard(window.rf.remove(dto.uid))) { toast('Deleted'); return true; }
    return false;
  }


  // ---------------------------------------------------------------- editor
  const ed = $('editor');
  const E = { dto: null, isNew: true, kind: 'event', occStart: null, prevDate: null, origRepeat: null, origAlarm: null };
  const TIMED_ALARMS = [['', 'None'], ['0', 'At the time'], ['5', '5 minutes before'], ['10', '10 minutes before'], ['15', '15 minutes before'], ['30', '30 minutes before'],
    ['60', '1 hour before'], ['120', '2 hours before'], ['1440', '1 day before'], ['2880', '2 days before'], ['10080', '1 week before']];

  function nextHour() { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return `${RF.pad(d.getHours())}:00`; }

  async function openEditor(opts = {}) {
    hideCtx();
    let dto;
    if (opts.uid) {
      dto = await guard(window.rf.get(opts.uid));
      if (!dto) return;
      E.isNew = false;
    } else {
      const kind = opts.kind || (todoTab() ? 'todo' : 'event');
      const date = opts.date || S.selDay || S.today;
      const cat = kind === 'todo' ? S.todoCat : S.cat;
      const da = S.settings.defaultAlarm;
      dto = {
        kind, summary: '', notes: '', location: '', url: '', categories: cat ? [cat] : [], important: false,
        allDay: true, date, time: null, endDate: null, endTime: null, repeat: null, repeatText: '',
        alarm: da != null && da !== '' ? { minutes: -540 } : null, timezone: null, completed: false,
        list: kind === 'todo' ? (curList() || DEFAULT_LIST) : null,
      };
      E.isNew = true;
    }
    E.dto = dto;
    E.kind = dto.kind;
    E.occStart = opts.start != null && !Number.isNaN(Number(opts.start)) ? Number(opts.start) : null;
    E.origRepeat = dto.repeat;
    E.origAlarm = dto.alarm;
    fillEditor(dto);
    if (!ed.open) ed.showModal();
    $('edSummary').focus();
    $('edSummary').select();
  }

  function fillEditor(d) {
    $('edSummary').value = d.summary || '';
    setImportant(!!d.important);
    const dated = !!d.date;
    $('edNoDate').checked = d.kind === 'todo' && !dated;
    $('edDate').value = d.date || S.selDay || S.today;
    $('edAllDay').checked = dated ? !!d.allDay : true;
    $('edTime').value = d.time || (($('edDate').value === S.today) ? nextHour() : '09:00');
    $('edEndDate').value = d.endDate || '';
    $('edEndTime').value = d.endTime || '';
    E.prevDate = $('edDate').value;
    $('edTz').textContent = d.timezone ? `Imported in the ${d.timezone} time zone — shown in your local time. Saving will store it in local time.` : '';
    $('edTz').classList.toggle('hidden', !d.timezone);
    // repeat
    const rp = d.repeat;
    const freq = $('edFreq');
    const customOpt = freq.querySelector('option[value=CUSTOM]');
    customOpt.hidden = !(rp && rp.custom);
    if (rp && rp.custom) customOpt.textContent = d.repeatText || 'Custom (imported)';
    freq.value = rp ? (rp.custom ? 'CUSTOM' : rp.freq) : '';
    $('edInterval').value = rp && !rp.custom ? (rp.interval || 1) : 1;
    $('edEnds').value = rp && rp.end ? rp.end : 'never';
    $('edUntil').value = rp && rp.until ? rp.until : '';
    $('edCount').value = rp && rp.count ? rp.count : 10;
    E.days = rp && rp.byday && rp.byday.length ? [...rp.byday] : [WD[parseKey($('edDate').value).getDay()]];
    E.rule = rp && rp.mode === 'weekday' ? { nth: rp.nth, wd: rp.wd } : null;
    E.mode = rp && rp.mode === 'weekday' ? 'rule' : 'date';
    // alarm
    E.alarmState = d.alarm;
    // fields
    $('edCats').value = (d.categories || []).join(', ');
    $('edList').value = d.list || DEFAULT_LIST;
    $('edLocation').value = d.location || '';
    $('edUrl').value = d.url || '';
    $('edNotes').value = d.notes || '';
    $('edDone').checked = !!d.completed;
    $('edRuc').checked = !!d.untilDone;
    $('edTip').checked = !!d.showInTooltip;
    E.remind = d.kind === 'todo' ? (d.remind || legacyRemind(d.alarm, d.date, d.allDay, d.time)) : null;
    E.keepAlarm = d.kind === 'todo' && !d.remind && d.alarm && d.alarm.keep ? d.alarm : null;
    setKind(d.kind, true);
    updateAgeNote();
    if (rp && rp.mode === 'weekday') E.mode = modeForRule(rp);
    renderRepeat();
    renderAlarm(d.alarm);
    renderRemind();
  }
  function modeForRule(rp) {
    const d = parseKey($('edDate').value);
    const nth = Math.ceil(d.getDate() / 7);
    const last = addDays(d, 7).getMonth() !== d.getMonth();
    if (WD[d.getDay()] === rp.wd) {
      if (rp.nth === -1 && last) return 'last';
      if (rp.nth === nth && nth <= 4) return 'nth';
    }
    return 'rule';
  }
  function setImportant(on) { $('edImportant').setAttribute('aria-pressed', String(on)); }
  function setKind(kind, initial) {
    E.kind = kind;
    for (const b of ed.querySelectorAll('.seg button')) b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
    const todo = kind === 'todo';
    $('edTitle').textContent = `${E.isNew ? 'New' : 'Edit'} ${todo ? 'to-do' : 'reminder'}`;
    $('edSummary').placeholder = todo ? 'What needs doing?' : 'What do you want to be reminded of?';
    $('edNoDateWrap').classList.toggle('hidden', !todo);
    $('edListWrap').classList.toggle('hidden', !todo);
    $('edDoneWrap').classList.toggle('hidden', !todo);
    $('edRucWrap').classList.toggle('hidden', todo);
    $('edTipWrap').classList.toggle('hidden', !todo);
    $('edEndRow').classList.toggle('hidden', todo);
    $('edDelete').classList.toggle('hidden', E.isNew);
    // a to-do's date is when it's due by; its reminders are a plan (start, time, how often) instead of one alarm
    $('edDateLbl').textContent = todo ? 'Due by' : 'Date';
    $('edAllDayTxt').textContent = todo ? 'Any time' : 'All day';
    $('edRemindBox').classList.toggle('hidden', !todo);
    $('edAlarmRow').classList.toggle('hidden', todo);
    $('edSchedule').classList.toggle('hidden', !todo);
    if (!initial && todo && !E.remind) E.remind = legacyRemind(currentAlarm(), $('edDate').value, $('edAllDay').checked, $('edTime').value);
    if (!initial) renderRemind();
    if (!todo) $('edNoDate').checked = false;
    if (!initial) { renderRepeat(); renderAlarm(currentAlarm()); }
    updateDateState();
  }
  function updateDateState() {
    const noDate = E.kind === 'todo' && $('edNoDate').checked;
    const allDay = $('edAllDay').checked;
    $('edDate').disabled = noDate;
    $('edTime').disabled = noDate;
    $('edAllDay').disabled = noDate;
    $('edTimeWrap').classList.toggle('hidden', allDay);
    $('edEndTimeWrap').classList.toggle('hidden', allDay);
    for (const el of $('edRepeatBox').querySelectorAll('select,input,button')) el.disabled = noDate;
    $('edRepeatBox').style.opacity = noDate ? '.55' : '';
    for (const id of ['edAlarm', 'edAlarmN', 'edAlarmUnit', 'edAlarmDay', 'edAlarmAt']) $(id).disabled = noDate;
    const repeating = !E.isNew && !!E.origRepeat && $('edFreq').value !== '';
    $('edSeriesNote').classList.toggle('hidden', !repeating);
  }

  // repeat UI
  function unitWord(freq, n) {
    const w = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[freq] || 'day';
    return n === 1 ? w : `${w}s`;
  }
  function renderRepeat() {
    const f = $('edFreq').value;
    const custom = f === 'CUSTOM';
    const n = Math.max(1, parseInt($('edInterval').value, 10) || 1);
    $('edEveryWrap').classList.toggle('hidden', !f || custom);
    $('edUnit').textContent = unitWord(f, n);
    $('edWeekRow').classList.toggle('hidden', f !== 'WEEKLY');
    $('edMonthRow').classList.toggle('hidden', f !== 'MONTHLY' && f !== 'YEARLY');
    $('edEndsRow').classList.toggle('hidden', !f || custom);
    $('edUntil').classList.toggle('hidden', $('edEnds').value !== 'until');
    $('edCountWrap').classList.toggle('hidden', $('edEnds').value !== 'count');
    // week days in week-start order
    if (f === 'WEEKLY') {
      const ws = Number(S.settings.weekStart) || 0;
      let h = '';
      for (let i = 0; i < 7; i++) {
        const w = (ws + i) % 7;
        h += `<button type="button" data-wd="${WD[w]}" aria-pressed="${E.days.includes(WD[w])}" title="${WD_LONG[w]}">${WD_LABEL[w]}</button>`;
      }
      $('edDays').innerHTML = h;
    }
    if (f === 'MONTHLY' || f === 'YEARLY') {
      const d = parseKey($('edDate').value || S.today);
      const yr = f === 'YEARLY';
      const month = fmt.monthName(d);
      const nth = Math.ceil(d.getDate() / 7);
      const last = addDays(d, 7).getMonth() !== d.getMonth();
      const weekday = WD_LONG[d.getDay()];
      const onNth = (n, wd) => T(yr ? 'On the {nth} {weekday} of {month}' : 'On the {nth} {weekday}', { nth: ORD(n), weekday: wd, month });
      const opts = [['date', yr ? T('On {date}', { date: monthDay(d) }) : T('On day {day}', { day: d.getDate() })]];
      if (nth <= 4) opts.push(['nth', onNth(nth, weekday)]);
      if (last) opts.push(['last', T(yr ? 'On the last {weekday} of {month}' : 'On the last {weekday}', { weekday, month })]);
      if (E.rule && modeForRule({ nth: E.rule.nth, wd: E.rule.wd }) === 'rule') {
        opts.push(['rule', onNth(E.rule.nth, WD_LONG[WD.indexOf(E.rule.wd)])]);
      }
      const sel = $('edMode');
      sel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
      sel.value = opts.some(([v]) => v === E.mode) ? E.mode : 'date';
      E.mode = sel.value;
    }
    $('edRepeatSummary').textContent = f ? `↻ ${editorSummary()}` : '';
    updateDateState();
  }
  function readRepeat() {
    const f = $('edFreq').value;
    if (!f) return null;
    if (f === 'CUSTOM') return E.origRepeat && E.origRepeat.custom ? { custom: true, rrule: E.origRepeat.rrule } : null;
    const rep = { freq: f, interval: Math.max(1, parseInt($('edInterval').value, 10) || 1), end: $('edEnds').value };
    if (rep.end === 'until') rep.until = $('edUntil').value || null;
    if (rep.end === 'count') rep.count = Math.max(1, parseInt($('edCount').value, 10) || 1);
    if (rep.end === 'until' && !rep.until) rep.end = 'never';
    const d = parseKey($('edDate').value || S.today);
    if (f === 'WEEKLY') rep.byday = E.days.length ? [...E.days] : [WD[d.getDay()]];
    if (f === 'MONTHLY' || f === 'YEARLY') {
      const m = $('edMode').value;
      if (m === 'date') rep.mode = 'date';
      else if (m === 'nth') { rep.mode = 'weekday'; rep.nth = Math.ceil(d.getDate() / 7); rep.wd = WD[d.getDay()]; }
      else if (m === 'last') { rep.mode = 'weekday'; rep.nth = -1; rep.wd = WD[d.getDay()]; }
      else if (m === 'rule' && E.rule) { rep.mode = 'weekday'; rep.nth = E.rule.nth; rep.wd = E.rule.wd; }
      else rep.mode = 'date';
    }
    return rep;
  }
  function editorSummary() {
    const rep = readRepeat();
    if (!rep) return '';
    if (rep.custom) return E.dto.repeatText || T('Custom');
    const n = rep.interval;
    const k = (one, many) => (n === 1 ? one : many);
    const d = parseKey($('edDate').value || S.today);
    let s;
    if (rep.freq === 'DAILY') s = T(k('Every day', 'Every {n} days'), { n });
    else if (rep.freq === 'WEEKLY') {
      const order = [1, 2, 3, 4, 5, 6, 0].filter((i) => rep.byday.includes(WD[i]));
      const days = order.join() === '1,2,3,4,5' ? T('weekdays') : order.map((i) => WD_LONG[i]).join(', ');
      s = T(k('Every week on {days}', 'Every {n} weeks on {days}'), { n, days });
    } else {
      const yr = rep.freq === 'YEARLY';
      const vars = { n, month: fmt.monthName(d), day: d.getDate(), date: monthDay(d) };
      if (rep.mode === 'weekday') {
        Object.assign(vars, { nth: ORD(rep.nth), weekday: WD_LONG[WD.indexOf(rep.wd)] });
        s = T(yr ? k('Every year on the {nth} {weekday} of {month}', 'Every {n} years on the {nth} {weekday} of {month}') : k('Every month on the {nth} {weekday}', 'Every {n} months on the {nth} {weekday}'), vars);
      } else s = T(yr ? k('Every year on {date}', 'Every {n} years on {date}') : k('Every month on day {day}', 'Every {n} months on day {day}'), vars);
    }
    if (rep.end === 'count') s = rep.count === 1 ? T('{rule}, once', { rule: s }) : T('{rule}, {n} times', { rule: s, n: rep.count });
    if (rep.end === 'until' && rep.until) s = T('{rule}, until {date}', { rule: s, date: fmt.date(rep.until) });
    return s;
  }

  // alarm UI
  function renderAlarm(alarm) {
    const allDay = $('edAllDay').checked;
    const sel = $('edAlarm');
    let opts;
    if (allDay) opts = [['', 'None'], ['remind', 'Remind me…']];
    else opts = [...TIMED_ALARMS, ['custom', 'Custom…']];
    if (alarm && alarm.keep) opts.push(['keep', `Keep imported: ${alarm.text || 'Custom alarm'}`]);
    sel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
    let v = '';
    if (alarm && alarm.keep) v = 'keep';
    else if (alarm && alarm.minutes != null) {
      const m = Number(alarm.minutes);
      if (allDay) {
        v = 'remind';
        const days = m > 0 ? Math.ceil(m / 1440) : 0;
        const at = days * 1440 - m;
        const daySel = $('edAlarmDay');
        if (![...daySel.options].some((o) => Number(o.value) === days)) daySel.insertAdjacentHTML('beforeend', `<option value="${days}">${days} days before</option>`);
        daySel.value = String(days);
        $('edAlarmAt').value = `${RF.pad(Math.floor(at / 60) % 24)}:${RF.pad(at % 60)}`;
      } else if (TIMED_ALARMS.some(([x]) => x !== '' && Number(x) === m)) v = String(m);
      else {
        v = 'custom';
        const unit = [10080, 1440, 60].find((u) => m > 0 && m % u === 0) || 1;
        $('edAlarmUnit').value = String(unit);
        $('edAlarmN').value = String(Math.max(0, m / unit));
      }
    } else if (allDay) { $('edAlarmDay').value = '0'; $('edAlarmAt').value = '09:00'; }
    sel.value = v;
    showAlarmParts();
  }
  function showAlarmParts() {
    const v = $('edAlarm').value;
    $('edAlarmCustom').classList.toggle('hidden', v !== 'custom');
    $('edAlarmAllDay').classList.toggle('hidden', v !== 'remind');
  }
  function currentAlarm() {
    const v = $('edAlarm').value;
    if (v === '') return null;
    if (v === 'keep') return { keep: true, text: E.origAlarm && E.origAlarm.text };
    if (v === 'remind') {
      const days = Number($('edAlarmDay').value) || 0;
      const at = toMin($('edAlarmAt').value || '09:00');
      return { minutes: days * 1440 - at };
    }
    if (v === 'custom') return { minutes: Math.max(0, Math.round(Number($('edAlarmN').value) || 0)) * Number($('edAlarmUnit').value) };
    return { minutes: Number(v) };
  }

  // "<1960>" in a title shows as an age; preview it under the title
  function updateAgeNote() {
    const raw = $('edSummary').value;
    // a repeating item (a birthday from 1960) shows this year's age; a one-off uses its own date
    const year = ($('edDate').value && !$('edFreq').value ? parseKey($('edDate').value) : new Date()).getFullYear();
    const shown = RF.expandAges(raw, year);
    const on = shown !== raw;
    $('edAgeNote').textContent = on ? `Shows as: ${shown} (in ${year}). <year> counts the years since then; <year#> shows just the number.` : '';
    $('edAgeNote').classList.toggle('hidden', !on);
  }
  $('edSummary').addEventListener('input', updateAgeNote);
  $('edDate').addEventListener('input', updateAgeNote);
  $('edFreq').addEventListener('change', updateAgeNote);

  // editor events
  ed.querySelector('.seg').addEventListener('click', (e) => { const b = e.target.closest('button[data-kind]'); if (b) setKind(b.dataset.kind); });
  $('edImportant').addEventListener('click', () => setImportant($('edImportant').getAttribute('aria-pressed') !== 'true'));
  $('edAllDay').addEventListener('change', () => {
    const before = currentAlarmFor(!$('edAllDay').checked);
    let next = before;
    if (before && !before.keep) {
      const da = S.settings.defaultAlarm;
      next = $('edAllDay').checked ? { minutes: -540 } : { minutes: da != null && da !== '' ? Number(da) : 15 };
    }
    if (!$('edAllDay').checked && !$('edTime').value) $('edTime').value = $('edDate').value === S.today ? nextHour() : '09:00';
    renderAlarm(next);
    updateDateState();
  });
  function currentAlarmFor() { return currentAlarm(); }
  $('edNoDate').addEventListener('change', () => { updateDateState(); E.remind = readRemindUI(); renderRemind(); });

  // ---------------------------------------------------------------- a to-do's reminders
  // An old single alarm (from the add-on, or a reminder made into a to-do) becomes "remind me once, N days before".
  function legacyRemind(alarm, date, allDay, time) {
    if (!alarm || alarm.keep || alarm.minutes == null || !date) return null;
    const m = Number(alarm.minutes);
    const due = parseKey(date).getTime() + (allDay || !time ? 0 : toMin(time) * 60000);
    const fire = new Date(due - m * 60000);
    const days = Math.max(0, Math.round((parseKey(date) - startOfDay(fire)) / 864e5));
    return { start: 'before', days, at: `${RF.pad(fire.getHours())}:${RF.pad(fire.getMinutes())}`, every: 'once', afterDue: false };
  }
  const RM_BEFORE = [[0, 'on the due date'], [1, '1 day before'], [2, '2 days before'], [3, '3 days before'], [7, '1 week before'], [14, '2 weeks before'], [30, '30 days before']];
  const RM_EVERY = { day: 'Every day', '2days': 'Every {n} days', week: 'Every week', '2weeks': 'Every {n} weeks', month: 'Every month' };
  const hasDue = () => !$('edNoDate').checked && !!$('edDate').value;
  function renderRemind() {
    const due = hasDue();
    const r = E.remind;
    const opts = [['none', "Don't remind me"], ...(due ? RM_BEFORE.map(([n, l]) => [`b${n}`, l]) : []), ['date', due ? 'on a date…' : 'starting on…']];
    let v = 'none';
    let date = r && r.date;
    if (r && r.start === 'date') v = 'date';
    else if (r && due) { v = `b${r.days}`; if (!opts.some(([k]) => k === v)) opts.splice(opts.length - 1, 0, [v, `${r.days} days before`]); }
    else if (r) { v = 'date'; date = date || S.today; } // no due date any more: from today
    $('edRmStart').innerHTML = opts.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('');
    $('edRmStart').value = v;
    $('edRmDate').value = date || '';
    $('edRmAt').value = (r && r.at) || '09:00';
    $('edRmEvery').value = (r && r.every) || 'once';
    $('edRmAfter').checked = !r || r.afterDue !== false;
    showRemindParts();
  }
  function readRemindUI() {
    const v = $('edRmStart').value;
    if (!v || v === 'none') return null;
    const base = { at: $('edRmAt').value || '09:00', every: $('edRmEvery').value || 'once', afterDue: $('edRmAfter').checked };
    if (v === 'date') return $('edRmDate').value ? { ...base, start: 'date', date: $('edRmDate').value } : null;
    return { ...base, start: 'before', days: Number(v.slice(1)) || 0 };
  }
  function remindSummary() {
    const v = $('edRmStart').value;
    if (v === 'none') return hasDue() ? 'No reminders. The to-do shows in red once its due date has passed.' : 'No reminders.';
    const r = readRemindUI();
    if (!r) return 'Choose the date of the first reminder.';
    const dueKey = hasDue() ? $('edDate').value : null;
    const firstKey = r.start === 'date' ? r.date : dayKey(addDays(parseKey(dueKey), -r.days));
    const first = parseKey(firstKey).getTime() + toMin(r.at) * 60000;
    const tv = { date: fmt.long(first), time: fmt.time(first) };
    if (r.every === 'once') return T(first < Date.now() ? 'One reminder, on {date} at {time}. That time has passed — choose a later one, or remind repeatedly.' : 'One reminder, on {date} at {time}.', tv);
    const due = dueKey ? fmt.date(parseKey(dueKey)) : '';
    const end = !dueKey ? T("until it's done") : r.afterDue ? T("until it's done, also after it's due ({due})", { due }) : T("until it's done or due ({due})", { due });
    return T('{every} at {time}, from {date}, {end}.', { ...tv, every: T(RM_EVERY[r.every], { n: 2 }), end });
  }
  function showRemindParts() {
    const v = $('edRmStart').value;
    const on = v !== 'none';
    if (v === 'date' && !$('edRmDate').value) $('edRmDate').value = S.today;
    $('edRmDate').classList.toggle('hidden', v !== 'date');
    $('edRmAtWrap').classList.toggle('hidden', !on);
    $('edRmEveryRow').classList.toggle('hidden', !on);
    const repeat = $('edRmEvery').value !== 'once';
    $('edRmUntil').classList.toggle('hidden', !repeat);
    $('edRmAfterWrap').classList.toggle('hidden', !(repeat && hasDue()));
    $('edRmSummary').textContent = remindSummary();
  }
  for (const id of ['edRmStart', 'edRmDate', 'edRmAt', 'edRmEvery', 'edRmAfter']) {
    $(id).addEventListener('change', () => { showRemindParts(); E.remind = readRemindUI(); });
    $(id).addEventListener('input', () => { showRemindParts(); E.remind = readRemindUI(); });
  }
  for (const id of ['edDate', 'edTime', 'edAllDay']) $(id).addEventListener('change', () => { if (E.kind === 'todo') { E.remind = readRemindUI(); renderRemind(); } });
  $('edSchedule').addEventListener('click', async () => {
    const dto = buildEditorDto();
    if (!dto) return;
    if (await FX('askSchedule', dto)) ed.close();
  });
  $('edDate').addEventListener('change', () => {
    const nd = $('edDate').value;
    if (nd && E.prevDate && E.days.length === 1) {
      const od = parseKey(E.prevDate);
      if (E.days[0] === WD[od.getDay()]) E.days = [WD[parseKey(nd).getDay()]];
    }
    if (nd) E.prevDate = nd;
    if (E.mode === 'nth' || E.mode === 'last') {
      const d = parseKey(nd || S.today);
      const last = addDays(d, 7).getMonth() !== d.getMonth();
      if (E.mode === 'last' && !last) E.mode = 'nth';
      if (E.mode === 'nth' && Math.ceil(d.getDate() / 7) > 4) E.mode = last ? 'last' : 'date';
    }
    renderRepeat();
  });
  $('edFreq').addEventListener('change', () => { if ($('edFreq').value === 'WEEKLY' && !E.days.length) E.days = [WD[parseKey($('edDate').value || S.today).getDay()]]; renderRepeat(); });
  for (const id of ['edInterval', 'edCount', 'edUntil']) $(id).addEventListener('input', renderRepeat);
  $('edEnds').addEventListener('change', () => {
    if ($('edEnds').value === 'until' && !$('edUntil').value) {
      const d = parseKey($('edDate').value || S.today); d.setMonth(d.getMonth() + 3); $('edUntil').value = dayKey(d);
    }
    renderRepeat();
  });
  $('edMode').addEventListener('change', () => { E.mode = $('edMode').value; renderRepeat(); });
  $('edDays').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-wd]');
    if (!b) return;
    const w = b.dataset.wd;
    E.days = E.days.includes(w) ? E.days.filter((x) => x !== w) : [...E.days, w];
    renderRepeat();
  });
  $('edAlarm').addEventListener('change', () => {
    if ($('edAlarm').value === 'custom' && !$('edAlarmN').value) $('edAlarmN').value = '15';
    showAlarmParts();
  });
  $('edOpenUrl').addEventListener('click', () => {
    let u = $('edUrl').value.trim();
    if (!u) return;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) { u = `https://${u}`; $('edUrl').value = u; }
    guard(window.rf.openUrl(u));
  });
  $('edCancel').addEventListener('click', () => ed.close());
  $('edMap').addEventListener('click', () => openMap($('edLocation').value));
  $('edCatPick').addEventListener('click', async () => {
    const cur = $('edCats').value.split(',').map((x) => x.trim()).filter(Boolean);
    const next = await FX('pickCategories', cur);
    if (Array.isArray(next)) { $('edCats').value = next.join(', '); }
  });
  $('edDelete').addEventListener('click', async () => {
    const d = E.dto;
    if (await confirmDelete(d, E.occStart)) ed.close();
  });
  $('edForm').addEventListener('submit', (e) => { e.preventDefault(); saveEditor(); });

  async function saveEditor() {
    const dto = buildEditorDto();
    if (!dto) return;
    const kind = dto.kind;
    const uid = await guard(window.rf.save(dto));
    if (!uid) return;
    ed.close();
    toast(E.isNew ? (kind === 'todo' ? 'To-do added' : 'Reminder added') : 'Saved');
  }
  // the item as the editor shows it now, or null (with a message) when something is missing
  function buildEditorDto() {
    const summary = $('edSummary').value.trim();
    if (!summary) { toast('Please enter a description.'); $('edSummary').focus(); return null; }
    const kind = E.kind;
    const noDate = kind === 'todo' && $('edNoDate').checked;
    const allDay = $('edAllDay').checked;
    const date = noDate ? null : $('edDate').value;
    if (!noDate && !date) { toast(kind === 'todo' ? 'Please choose the due date, or tick "No date".' : 'Please choose a date.'); $('edDate').focus(); return null; }
    const time = noDate || allDay ? null : $('edTime').value;
    if (!noDate && !allDay && !time) { toast(kind === 'todo' ? 'Please enter the time it\'s due by, or tick "Any time".' : 'Please enter a time, or tick "All day".'); $('edTime').focus(); return null; }
    const remind = kind === 'todo' ? readRemindUI() : null;
    if (kind === 'todo' && $('edRmStart').value === 'date' && !$('edRmDate').value) { toast('Please choose the date of the first reminder.'); $('edRmDate').focus(); return null; }
    let endDate = null; let endTime = null;
    if (kind === 'event' && !noDate) {
      endDate = $('edEndDate').value || null;
      endTime = allDay ? null : ($('edEndTime').value || null);
      if (endDate && endDate < date) { toast('The end date is before the start date.'); $('edEndDate').focus(); return null; }
      if (!allDay && endTime && (!endDate || endDate === date) && toMin(endTime) < toMin(time)) { toast('The end time is before the start time.'); $('edEndTime').focus(); return null; }
      if (endDate === date) endDate = null;
    }
    const dto = {
      ...E.dto,
      kind, summary,
      notes: $('edNotes').value,
      location: $('edLocation').value.trim(),
      url: $('edUrl').value.trim(),
      categories: $('edCats').value.split(',').map((s) => s.trim()).filter(Boolean),
      important: $('edImportant').getAttribute('aria-pressed') === 'true',
      allDay: !noDate && allDay, date, time, endDate, endTime,
      repeat: noDate ? null : readRepeat(),
      alarm: kind === 'todo' ? (remind ? null : (E.keepAlarm ? { keep: true } : null))
        : noDate ? (E.origAlarm && E.origAlarm.keep ? { keep: true } : null) : currentAlarm(),
      remind,
      list: kind === 'todo' ? ($('edList').value.trim() || DEFAULT_LIST) : null,
      completed: kind === 'todo' ? $('edDone').checked : false,
      untilDone: kind === 'event' && !noDate && $('edRuc').checked,
      showInTooltip: kind === 'todo' && $('edTip').checked,
    };
    if (E.isNew) delete dto.uid;
    return dto;
  }

  // ---------------------------------------------------------------- welcome
  async function renderWelcome() {
    $('remHint').textContent = plural(0, 'reminder', 'reminders');
    S.oldFiles = (await guard(window.rf.findOld())) || [];
    const err = S.meta.loadError ? `<div style="color:var(--danger);margin-top:10px">${esc(S.meta.loadError)}</div>` : '';
    const olds = S.oldFiles.map((f, i) => `<div class="opt" data-w="old" data-i="${i}"><span style="font-size:22px">🦊</span><div><b>Import from your ReminderFox add-on</b><small>${esc(T('{path} — last changed {date}', { path: f.path, date: fmt.date(f.modified) }))}</small></div></div>`).join('');
    listView.innerHTML = `<div class="welcome"><img src="../../assets/icon.png" alt=""><h2>Welcome to ReminderFoxAgain</h2><div>Your reminders, to-dos and alarms as a Windows app — a tribute to the original ReminderFox add-on.</div>${err}<div class="opts">${olds}` +
      '<div class="opt" data-w="pick"><span style="font-size:22px">📂</span><div><b>Import a reminderfox.ics or other calendar file…</b><small>From the ReminderFox add-on (in your Firefox/Thunderbird profile\'s "reminderfox" folder), Outlook, Google Calendar…</small></div></div>' +
      '<div class="opt" data-w="fresh"><span style="font-size:22px">✨</span><div><b>Start with an empty list</b><small>You can import later from Settings → Data.</small></div></div></div></div>';
  }
  async function welcomeChoice(opt) {
    const w = opt.dataset.w;
    let res = null;
    if (w === 'old') { res = await FX('askImport', S.oldFiles[Number(opt.dataset.i)].path); if (!res) return; }
    else if (w === 'pick') { res = await FX('askImport', await guard(window.rf.pickIcs('any'))); if (!res) return; }
    await guard(window.rf.setSettings({ welcomeDone: true }));
    S.welcome = false;
    if (res) toast(res.lists && res.lists.length ? T('Imported {items} and {lists}', { items: plural(res.added + res.updated, 'item', 'items'), lists: plural(res.lists.length, 'list', 'lists') }) : T('Imported {items}', { items: plural(res.added + res.updated, 'item', 'items') }));
    await refresh();
  }

  // ---------------------------------------------------------------- import / export / settings
  function importSummary(r) {
    const parts = [plural(r.added, 'new item', 'new items')];
    if (r.updated) parts.push(T('{n} updated', { n: r.updated }));
    if (r.skipped) parts.push(T('{n} already up to date', { n: r.skipped }));
    if (r.duplicates) parts.push(T(r.duplicates === 1 ? '{n} duplicate skipped' : '{n} duplicates skipped', { n: r.duplicates }));
    if (r.replaced) parts.push(T('replacing {items} (saved as {file})', { items: plural(r.replaced.count, 'item', 'items'), file: r.replaced.safety }));
    if (r.lists && r.lists.length) parts.push(T('{lists} added ({names})', { lists: plural(r.lists.length, 'list', 'lists'), names: r.lists.join(', ') }));
    return `${parts.join(', ')}.`;
  }
  async function doImport() {
    const files = await guard(window.rf.pickIcs('any'));
    const r = files && await FX('askImport', files);
    if (r) await message('Import complete', esc(importSummary(r)));
  }
  function doExport() { $('exportDlg').showModal(); $('expGo').focus(); }
  $('expGo').addEventListener('click', async () => {
    const kind = (document.querySelector('input[name=exp]:checked') || {}).value || 'all';
    $('exportDlg').close();
    const p = await guard(window.rf.exportIcs({ kind }));
    if (p) toast(`Exported to ${p}`, 4500);
  });
  for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => b.closest('dialog').close());

  const st = $('settingsDlg');
  function openSettings() {
    const s = S.settings;
    $('stStart').checked = !!s.startWithWindows;
    $('stTray').checked = !!s.closeToTray;
    $('stTrayNote').hidden = !(S.meta && S.meta.trayMissing);
    $('stSound').checked = s.alarmSound !== false;
    $('stWeek').value = String(Number(s.weekStart) || 0);
    $('stAlarm').innerHTML = TIMED_ALARMS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
    $('stAlarm').value = s.defaultAlarm == null ? '' : String(s.defaultAlarm);
    const sn = RF.snooze.fromSettings(s);
    $('stSnoozeAmount').value = String(sn.amount);
    $('stSnoozeAmount').classList.remove('bad');
    $('stSnoozeUnit').value = sn.unit;
    fillThemes();
    $('stTheme').value = s.theme || '';
    renderSwatches();
    $('stPath').textContent = `Your reminders are saved in ${S.meta.dataFile} (daily backups are kept in the "backups" folder next to it).`;
    FX('fillSettings');
    st.showModal();
  }
  async function setSetting(patch) {
    const r = await guard(window.rf.setSettings(patch));
    if (r) { S.settings = r; applyTheme(); }
    return r;
  }
  $('stStart').addEventListener('change', () => setSetting({ startWithWindows: $('stStart').checked }));
  $('stTray').addEventListener('change', () => setSetting({ closeToTray: $('stTray').checked }));
  $('stSound').addEventListener('change', () => { if ($('stSound').checked) FX('testSound'); setSetting({ alarmSound: $('stSound').checked }); });
  $('stWeek').addEventListener('change', async () => { await setSetting({ weekStart: Number($('stWeek').value) }); await Promise.all([renderSide(), S.tab === 'month' ? renderMonth() : null]); });
  $('stAlarm').addEventListener('change', () => setSetting({ defaultAlarm: $('stAlarm').value === '' ? null : Number($('stAlarm').value) }));
  // the Theme list and swatches: the six built-in themes, then your own (0.8.1), with New, Edit and Delete beside them
  function fillThemes() {
    const list = RF.themeList(S.settings.customThemes);
    const built = list.filter((t) => !t.custom); const own = list.filter((t) => t.custom);
    const opt = (t) => `<option value="${esc(t.id)}"${t.custom ? ' translate="no"' : ''}>${esc(t.label)}</option>`;
    $('stTheme').innerHTML = built.map(opt).join('') + (own.length ? `<optgroup label="${esc(T('Your themes'))}">${own.map(opt).join('')}</optgroup>` : '');
    const cur = S.settings.theme || '';
    $('stTheme').value = list.some((t) => t.id === cur) ? cur : '';
    renderSwatches();
  }
  function renderSwatches() {
    const cur = $('stTheme').value;
    $('stThemeSw').innerHTML = RF.themeList(S.settings.customThemes).map((t) => `<button type="button" data-theme-id="${esc(t.id)}" aria-pressed="${t.id === cur}" title="${esc(t.custom ? t.label : T(RF.platformText(t.label)))}" aria-label="${esc(t.custom ? t.label : T(RF.platformText(t.label)))}"${t.custom ? ' translate="no"' : ''}>` +
      t.sw.map((c) => `<span style="background:${c}"></span>`).join('') + '</button>').join('');
    const own = cur.startsWith('custom:');
    $('stThemeEdit').disabled = !own; $('stThemeDel').disabled = !own;
  }
  async function chooseTheme(id) {
    $('stTheme').value = id;
    RF.applyTheme(id, S.settings.customThemes);
    renderSwatches();
    await setSetting({ theme: id });
  }
  $('stThemeNew').addEventListener('click', async () => { if (await FX('editTheme', null)) fillThemes(); });
  $('stThemeEdit').addEventListener('click', async () => { if (await FX('editTheme', $('stTheme').value.slice(7))) fillThemes(); });
  $('stThemeDel').addEventListener('click', async () => { if (await FX('deleteTheme', $('stTheme').value.slice(7))) fillThemes(); });
  $('stTheme').addEventListener('change', () => chooseTheme($('stTheme').value));
  $('stThemeSw').addEventListener('click', (e) => { const b = e.target.closest('button[data-theme-id]'); if (b) chooseTheme(b.dataset.themeId); });
  function snoozeSetting() {
    const amt = $('stSnoozeAmount').value;
    const unit = $('stSnoozeUnit').value;
    const ok = RF.snooze.seconds(amt, unit) != null;
    $('stSnoozeAmount').classList.toggle('bad', !ok);
    if (ok) setSetting({ snoozeAmount: Number(amt), snoozeUnit: unit });
  }
  $('stSnoozeAmount').addEventListener('input', snoozeSetting);
  $('stSnoozeUnit').addEventListener('change', snoozeSetting);
  $('stFolder').addEventListener('click', () => guard(window.rf.openDataFolder()));
  $('stRfLink').addEventListener('click', (e) => { e.preventDefault(); guard(window.rf.openUrl('https://github.com/tommut/reminderfox')); });
  $('openFolder').addEventListener('click', () => guard(window.rf.openDataFolder()));
  $('stOldRf').addEventListener('click', async () => {
    const files = (await guard(window.rf.findOld())) || [];
    let r = null;
    if (files.length) {
      const list = files.map((f) => `<div>${esc(f.path)}<br><span class="note">last changed ${esc(fmt.date(f.modified))}, ${esc(fmt.time(f.modified))}</span></div>`).join('');
      const v = await confirmDlg('Import from ReminderFox', `<div>${esc(T('Found {files} from the ReminderFox add-on:', { files: plural(files.length, 'file', 'files') }))}</div>${list}`,
        [{ label: 'Cancel', value: null }, { label: 'Choose another file…', value: 'pick' }, { label: 'Import newest', cls: 'primary', value: 'newest' }]);
      if (v === 'newest') r = await FX('askImport', files[0].path);
      else if (v === 'pick') r = await FX('askImport', await guard(window.rf.pickIcs('old')));
      else return;
    } else r = await FX('askImport', await guard(window.rf.pickIcs('old')));
    if (r) await message('Import complete', esc(importSummary(r)));
  });

  // ---------------------------------------------------------------- header + toolbar wiring
  $('addReminder').addEventListener('click', () => openEditor({ kind: 'event' }));
  $('addTodo').addEventListener('click', () => openEditor({ kind: 'todo' }));
  $('stImport').addEventListener('click', doImport);
  $('stExport').addEventListener('click', doExport);
  $('settingsBtn').addEventListener('click', openSettings);
  document.querySelector('.tabs').addEventListener('click', (e) => { if (e.target.closest('select')) return; const b = e.target.closest('.tab'); if (b) setTab(b.dataset.tab); });
  // The List dropdown is the Lists tab: opening it (mouse or keyboard) shows the list it is on, picking another shows that one.
  const toLists = () => { if (S.tab !== 'todos') setTab('todos'); };
  $('todoList').addEventListener('mousedown', toLists);
  $('todoList').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key.startsWith('Arrow')) toLists(); });
  $('remFilter').value = S.filter;
  $('remFilter').addEventListener('change', async () => {
    if ($('remFilter').value === 'manage') { $('remFilter').value = S.filter; FX('openViews'); return; }
    saveScroll();
    S.filter = $('remFilter').value;
    ls.set('remFilter', S.filter);
    S.selKey = null;
    await renderReminders('enter');
  });
  $('remCat').addEventListener('change', () => { S.cat = $('remCat').value; renderReminders('refresh'); });

  $('todoList').addEventListener('change', () => pickList($('todoList').value));
  $('todoCat').addEventListener('change', () => { S.todoCat = $('todoCat').value; renderTodos(); });
  $('todoSort').addEventListener('change', async () => { await setSetting({ todoSort: $('todoSort').value }); renderTodos('refresh'); });
  $('showDone').checked = S.showDone;
  $('showDone').addEventListener('change', () => { S.showDone = $('showDone').checked; ls.set('showDone', S.showDone ? '1' : '0'); renderTodos('anchor'); });
  $('mTodos').addEventListener('change', () => { S.mTodos = $('mTodos').checked; renderMonth(); });
  $('mDone').addEventListener('change', () => { S.mShowDone = $('mDone').checked; renderMonth(); });
  // Show completed keeps the rows you were looking at in place (rows come and go above and below them)
  $('remDone').addEventListener('change', async () => { await setSetting({ hideCompleted: !$('remDone').checked }); renderReminders('anchor'); });
  $('mPrev').addEventListener('click', () => { S.monthView = new Date(S.monthView.getFullYear(), S.monthView.getMonth() - 1, 1); renderMonth(); });
  $('mNext').addEventListener('click', () => { S.monthView = new Date(S.monthView.getFullYear(), S.monthView.getMonth() + 1, 1); renderMonth(); });
  $('mToday').addEventListener('click', () => { const t = todayStart(); S.monthView = new Date(t.getFullYear(), t.getMonth(), 1); selectDay(S.today); renderMonth(); });
  let searchTimer = null;
  let wasSearching = false;
  $('search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const q = $('search').value;
      if (!wasSearching && q.trim()) saveScroll();
      S.search = q;
      const ending = wasSearching && !q.trim();
      wasSearching = !!q.trim();
      if (S.tab === 'reminders') await renderReminders(ending ? 'enter' : 'search');
      else await renderMain('search');
    }, 150);
  });
  $('monthGrid').addEventListener('click', (e) => {
    const more = e.target.closest('.more');
    if (more) { showDayInList(more.dataset.day); return; }
    const ev = e.target.closest('.ev');
    if (ev) { openEditor({ uid: ev.dataset.uid, start: Number(ev.dataset.start) }); return; }
    const cell = e.target.closest('.cell');
    if (cell) selectDay(cell.dataset.day);
  });
  $('monthGrid').addEventListener('dblclick', (e) => {
    if (e.target.closest('.ev,.more')) return;
    const cell = e.target.closest('.cell');
    if (cell) openEditor({ kind: 'event', date: cell.dataset.day });
  });
  let resizeTimer = null;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (S.tab === 'month') renderMonth(); }, 120); });

  // ---------------------------------------------------------------- keyboard
  const typing = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') { hideCtx(); return; }
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 's') { if (ed.open) { e.preventDefault(); saveEditor(); } return; }
      if (anyDialogOpen()) return;
      if (k === 'n') { e.preventDefault(); openEditor({ kind: 'event' }); }
      else if (k === 't') { e.preventDefault(); openEditor({ kind: 'todo' }); }
      else if (k === 'f') { e.preventDefault(); $('search').focus(); $('search').select(); }
      else if (k === 'i') { e.preventDefault(); doImport(); }
      else if (k === 'e') { e.preventDefault(); doExport(); }
      else if (k === 'g') { e.preventDefault(); FX('openGoTo'); }
      else if (k === 'b') { e.preventDefault(); toggleSide(); }
      else if (k === 'q') { e.preventDefault(); FX('openQuick'); }
      else if (k === 'd' && !typing(e.target) && S.selKey && (S.tab === 'reminders' || todoTab())) {
        e.preventDefault();
        const tr = listView.querySelector(`tbody tr[data-key="${CSS.escape(S.selKey)}"]`);
        const dto = tr && await guard(window.rf.get(tr.dataset.uid));
        if (dto) await duplicate(dto);
      }
      return;
    }
    if (e.altKey && !ctrl && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && todoTab() && !anyDialogOpen() && !typing(e.target) && !S.search.trim()) {
      e.preventDefault();
      await moveSelected(e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (anyDialogOpen() || typing(e.target) || S.tab === 'month') return;
    const trs = [...listView.querySelectorAll('tbody tr[data-key]')];
    const cur = trs.findIndex((t) => t.dataset.key === S.selKey);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!trs.length) return;
      e.preventDefault();
      const i = cur < 0 ? 0 : Math.max(0, Math.min(trs.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)));
      selectTr(trs[i], true);
      const r = rowFromTr(trs[i]);
      if (r && r.date) selectDay(r.date, { list: false });
    } else if (e.key === 'Enter' && cur >= 0) {
      e.preventDefault();
      const tr = trs[cur];
      openEditor({ uid: tr.dataset.uid, start: tr.dataset.start ? Number(tr.dataset.start) : null });
    } else if (e.key === 'Delete' && cur >= 0) {
      e.preventDefault();
      const tr = trs[cur];
      const dto = await guard(window.rf.get(tr.dataset.uid));
      if (dto) await confirmDelete(dto, tr.dataset.start ? Number(tr.dataset.start) : null);
    }
  });

  // ---------------------------------------------------------------- events from main
  window.rf.on('data:changed', () => refresh());
  window.rf.on('settings:changed', async (s) => {
    S.settings = s;
    applyTheme();
    RF.setFormats(s);
    try { S.meta.suspend = await window.rf.suspended(); } catch (e) { /* keep */ }
    renderAlarmState();
    refresh();
  });
  window.rf.on('ui:quick', () => { if (!anyDialogOpen()) FX('openQuick'); });
  // the macOS application menu (0.9.0)
  window.rf.on('ui:import', () => { if (!anyDialogOpen()) doImport(); });
  window.rf.on('ui:export', () => { if (!anyDialogOpen()) doExport(); });
  window.rf.on('ui:settings', (p) => { if (anyDialogOpen()) return; openSettings(); if (p && p.panel) FX('showPanel', p.panel); });
  window.rf.on('ui:goto', () => { if (!anyDialogOpen()) FX('openGoTo'); });
  window.rf.on('ui:side', () => toggleSide());
  window.rf.on('ui:find', () => { if (!anyDialogOpen()) { $('search').focus(); $('search').select(); } });
  window.rf.on('ui:suspend', () => { if (!anyDialogOpen()) FX('openSuspend'); });
  window.rf.on('ui:new', (p) => { if (ed.open) ed.close(); openEditor({ kind: (p && p.kind) || 'event' }); });
  window.rf.on('ui:edit', (p) => { if (ed.open) ed.close(); if (p && p.uid) openEditor({ uid: p.uid, start: p.start }); });

  // midnight
  setInterval(() => {
    const k = dayKey(new Date());
    if (k !== S.today) {
      const wasToday = S.selDay === S.today;
      S.today = k;
      if (wasToday) { S.selDay = k; const t = todayStart(); S.calMonth = new Date(t.getFullYear(), t.getMonth(), 1); }
      refresh();
    }
  }, 60000);

  // ---------------------------------------------------------------- start
  window.__rf = {
    S, openEditor, setTab, selectDay, refresh, renderMain, renderSide, applyColumns, toast, confirmDlg, message, guard, setSetting, goToDate,
    curList, showList, scrollToDay, fillThemes, applyTheme, anchorOf, duplicate, reorder, moveSelected, mapUrl, openMap, renderAlarmState, updateBadge, DEFAULT_LIST, plural, todoTab, TIMED_ALARMS,
  };
  (async () => {
    await guard(refresh());
    if (S.tab === 'reminders' && !S.welcome) await renderReminders('enter');
    if (S.meta.archiveMoved) {
      const l = 'Terminated or Suspended';
      toast(T(S.meta.archiveMoved === 1 ? '{n} archived item moved to the “{list}” list' : '{n} archived items moved to the “{list}” list', { n: S.meta.archiveMoved, list: T(l) }), 8000, { label: 'Show', fn: () => showList(l) });
    }
    // back on the Display settings after a language change reloaded the window
    let reopen = '';
    try { reopen = sessionStorage.getItem('rf-reopen') || ''; sessionStorage.removeItem('rf-reopen'); } catch (e) { /* none */ }
    if (reopen) { openSettings(); FX('showPanel', reopen); }
    if (S.meta.loadError && S.meta.count > 0) {
      await message('Could not read your reminders file', esc(S.meta.loadError));
    }
  })();
})();
