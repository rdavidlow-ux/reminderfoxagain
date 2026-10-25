'use strict';
// ReminderFoxAgain data layer. The .ics file is the source of truth: items are kept as
// ical.js components and edited in place, so properties the app does not know survive.
// No Electron imports here, so this file runs under plain Node for the unit tests.

const crypto = require('crypto');
const ICAL = require('ical.js');

const DEFAULT_LIST = "To-Do's";
const PRODID = '-//ReminderFoxAgain//ReminderFoxAgain 0.6//EN'; // written into the file; the add-on ignores it
const MAX_STEPS = 20000;
const DAY_MS = 86400000;
// Flags written by the ReminderFox add-on
const RUC_PROP = 'x-reminderfox-remind-until-completed'; // 1 = remind daily until completed, 2 = a missed occurrence is being carried
const RUC_LOOKBACK_DAYS = 90; // like the add-on, a flag of 1 only picks up an occurrence missed in the last 90 days
const TOOLTIP_PROP = 'x-reminderfox-show-in-tooltip';
const TOOLTIP_DAYS = 15; // the add-on's default "upcoming days" for the tooltip
// Archive (kept in a separate archive.ics; these stamp an item while it is there)
const ARCHIVED_PROP = 'x-reminderfoxagain-archived';
const ARCHIVE_REASON_PROP = 'x-reminderfoxagain-archive-reason';
// Manual to-do order: the same property Apple Reminders uses, so the order survives other apps
const ORDER_PROP = 'x-apple-sort-order';
// A to-do's reminder plan (0.4.0): "remind me from <start> at <time>, then every <step> until it's done".
//   start=before;days=7  (7 days before the due date)  or  start=date;date=2026-11-23
//   at=09:00; every=once|day|2days|week|2weeks|month; overdue=1 (keep reminding after the due date)
// A standard VALARM with an absolute first trigger (and REPEAT/DURATION for day and week steps) is written beside
// it, so other calendar apps still get a reminder; ReminderFoxAgain itself follows the plan.
const REMIND_PROP = 'x-reminderfoxagain-remind';
const REMIND_STEPS = { once: null, day: [1, 'd'], '2days': [2, 'd'], week: [7, 'd'], '2weeks': [14, 'd'], month: [1, 'm'] };

const WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const WD_SHORT = { SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat' };
const WEEK_ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------------------------------------------------------------- small helpers
const pad = (n) => String(n).padStart(2, '0');
const toDate = (d) => (d instanceof Date ? d : new Date(d));
function dayKey(d) { d = toDate(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function timeKey(d) { d = toDate(d); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
const compact = (key) => key.replace(/-/g, '');
const expand = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
function parseDay(key) { const [y, m, d] = key.split('-').map(Number); return { y, m, d }; }
function addDaysKey(key, n) { const { y, m, d } = parseDay(key); return dayKey(new Date(y, m - 1, d + n)); }
const ordinal = (n) => (n === -1 ? 'last' : n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'));
// Words the store writes into what it returns (repeat descriptions, ages): English unless the host sets a language
// pack with setPhrases({t(key, vars), ordinal(n), weekday(code), month(m), monthDay(m, d), date(key)}).
const EN_SHORT_WD = { SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat' };
const EN_SHORT_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_PHRASES = {
  t: (key, vars) => String(key).replace(/\{([a-z][a-z0-9]*)\}/gi, (m, k) => (vars && vars[k] != null ? vars[k] : m)),
  ordinal: (n) => { const m100 = n % 100; const m10 = n % 10; return `${n}${m100 >= 11 && m100 <= 13 ? 'th' : m10 === 1 ? 'st' : m10 === 2 ? 'nd' : m10 === 3 ? 'rd' : 'th'}`; },
  weekday: (code) => EN_SHORT_WD[code],
  month: (m) => EN_SHORT_MON[(m || 1) - 1],
  monthDay: (m, d) => `${EN_SHORT_MON[(m || 1) - 1]} ${d}`,
  date: (key) => key,
};
let PH = EN_PHRASES;
function setPhrases(p) { PH = p ? { ...EN_PHRASES, ...p } : EN_PHRASES; }
function ordinalNumber(n) { return PH.ordinal(n); }
// The add-on's title variables: "<1960>" → years since 1960 as an ordinal ("66th"), "<1960#>" → just the number ("66").
function expandAges(summary, year) {
  if (!summary || String(summary).indexOf('<') < 0) return summary;
  return String(summary).replace(/<(\d{4})(#?)>/g, (m, y, plain) => {
    const n = Math.abs(year - Number(y));
    return plain ? String(n) : ordinalNumber(n);
  });
}
const startOfDayMs = (msValue) => { const d = new Date(msValue); d.setHours(0, 0, 0, 0); return d.getTime(); };
const ms = (v) => (v == null ? v : v instanceof Date ? v.getTime() : typeof v === 'number' ? v : new Date(v).getTime());

function dateTime(dateKeyStr, time) {
  const { y, m, d } = parseDay(dateKeyStr);
  if (!time) return ICAL.Time.fromData({ year: y, month: m, day: d, isDate: true });
  const [hh, mm] = time.split(':').map(Number);
  return ICAL.Time.fromData({ year: y, month: m, day: d, hour: hh, minute: mm, second: 0, isDate: false });
}
const utcNow = () => ICAL.Time.fromJSDate(new Date(), true);
function utcStamp(msValue) {
  const d = new Date(msValue);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function parseUtcStamp(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(String(s || '').trim());
  if (!m) return null;
  const a = m.slice(1, 7).map(Number);
  return m[7] ? Date.UTC(a[0], a[1] - 1, a[2], a[3], a[4], a[5]) : new Date(a[0], a[1] - 1, a[2], a[3], a[4], a[5]).getTime();
}
const tzidOf = (t) => {
  if (!t || t.isDate) return null;
  const id = (t.zone && t.zone.tzid) || t.timezone;
  return id && id !== 'floating' && id !== 'UTC' && id !== 'Z' ? id : null;
};
// local Date for an ICAL.Time (dates → local midnight; floating → local wall time)
const jsDate = (t) => (t.isDate ? new Date(t.year, t.month - 1, t.day) : t.toJSDate());

// ---------------------------------------------------------------- parsing
function parseCalendars(text) {
  let s = String(text == null ? '' : text);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  s = s.replace(/\r\n?/g, '\n');
  const upper = s.toUpperCase();
  const first = upper.indexOf('BEGIN:VCALENDAR');
  if (first < 0) throw new Error('This file does not contain any iCalendar data (no BEGIN:VCALENDAR).');
  // cut into VCALENDAR blocks
  const blocks = [];
  let pos = first;
  while (pos >= 0) {
    const next = upper.indexOf('BEGIN:VCALENDAR', pos + 15);
    let end = upper.indexOf('END:VCALENDAR', pos);
    let block;
    if (end >= 0 && (next < 0 || end < next)) block = s.slice(pos, end + 13);
    else block = s.slice(pos, next < 0 ? s.length : next) + '\nEND:VCALENDAR';
    blocks.push(block);
    pos = next;
  }
  let root = null;
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '' && (/^[ \t]/.test(l) || l.includes(':')));
    const jcal = ICAL.parse(repairDates(lines).join('\r\n') + '\r\n');
    const comps = (Array.isArray(jcal[0]) ? jcal : [jcal]).map((j) => new ICAL.Component(j));
    for (const c of comps) {
      if (c.name !== 'vcalendar') continue;
      if (!root) { root = c; continue; }
      for (const sub of c.getAllSubcomponents()) {
        if (sub.name === 'vtimezone' && root.getAllSubcomponents('vtimezone').some((z) => z.getFirstPropertyValue('tzid') === sub.getFirstPropertyValue('tzid'))) continue;
        c.removeSubcomponent(sub);
        root.addSubcomponent(sub);
      }
    }
  }
  if (!root) throw new Error('This file does not contain any iCalendar data (no BEGIN:VCALENDAR).');
  for (const tz of root.getAllSubcomponents('vtimezone')) registerZone(tz);
  return root;
}
// Dates written the way some programs do (JavaScript's "Tue Oct 21 2026 10:00:00 GMT-0400", e-mail's "Tue, 21 Oct
// 2026 14:00:00 GMT", ISO "2026-10-21T14:00:00Z") instead of iCalendar's 20261021T140000Z: ical.js stops the whole
// file on them ("Could not extract integer from "Tue ""). Each DATE / DATE-TIME value that isn't iCalendar is read as a
// date and written the iCalendar way (a time → UTC); one that can't be read is left out with its line, so the rest of
// the file still comes in. Lines are unfolded first (folding again isn't needed: ical.js reads long lines).
const ICAL_DATE = /^\d{8}$/;
const ICAL_DATETIME = /^\d{8}T\d{6}Z?$/;
function splitProp(line) {
  // name;params:value — a ':' inside a quoted parameter value doesn't end the parameters
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') q = !q;
    else if (ch === ':' && !q) return [line.slice(0, i), line.slice(i + 1)];
  }
  return [line, ''];
}
function readLooseDate(v, asDate) {
  const t = String(v).trim();
  if (!t) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso) return asDate ? `${iso[1]}${iso[2]}${iso[3]}` : `${iso[1]}${iso[2]}${iso[3]}T000000`;
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const hasTime = /\d{1,2}:\d{2}/.test(t);
  if (asDate || !hasTime) {
    const local = /(GMT|UTC|Z\b|[+-]\d{2}:?\d{2}\b)/.test(t) ? null : d;   // a date alone is that day, wherever you are
    const x = local || d;
    const y = local ? x.getFullYear() : x.getUTCFullYear(); const m = (local ? x.getMonth() : x.getUTCMonth()) + 1; const dd = local ? x.getDate() : x.getUTCDate();
    const day = `${y}${pad(m)}${pad(dd)}`;
    return asDate ? day : `${day}T000000`;
  }
  return utcStamp(ms);
}
function repairDates(lines) {
  // unfold
  const un = [];
  for (const l of lines) { if (/^[ \t]/.test(l) && un.length) un[un.length - 1] += l.slice(1); else un.push(l); }
  const props = (ICAL.design && ICAL.design.defaultSet && ICAL.design.defaultSet.property) || {};
  const out = [];
  for (const line of un) {
    const [head, value] = splitProp(line);
    const parts = head.split(';');
    const name = parts[0].trim().toLowerCase();
    if (!name || name === 'begin' || name === 'end') { out.push(line); continue; }
    const vparam = parts.slice(1).find((p) => /^value=/i.test(p));
    const type = vparam ? vparam.slice(6).trim().toLowerCase() : props[name] && props[name].defaultType;
    if (name === 'rrule' || name === 'exrule') {
      // UNTIL=Tue Oct 21 2026… inside a repeat rule
      out.push(line.replace(/(UNTIL=)([^;]*)/i, (all, k, u) => {
        if (ICAL_DATE.test(u) || ICAL_DATETIME.test(u)) return all;
        const f = readLooseDate(u, !/\d{1,2}:\d{2}/.test(u));
        return f ? k + f : '';
      }).replace(/;;+/g, ';').replace(/:;/, ':').replace(/;$/, ''));
      continue;
    }
    if (type !== 'date' && type !== 'date-time') { out.push(line); continue; }
    const v = value.trim();
    const okRe = type === 'date' ? ICAL_DATE : ICAL_DATETIME;
    const vals = v.split(',').map((x) => x.trim());
    if (vals.every((x) => okRe.test(x))) { out.push(line); continue; }
    // a whole value like "Tue, 21 Oct 2026 14:00:00 GMT" has a comma of its own: try it whole first
    let fixed = [readLooseDate(v, type === 'date')];
    if (!fixed[0]) fixed = vals.map((x) => (okRe.test(x) ? x : readLooseDate(x, type === 'date')));
    if (fixed.some((x) => !x)) continue;   // unreadable: leave the line out
    // a time written in UTC no longer belongs to the TZID it named
    const keep = parts.filter((p, i) => i === 0 || !(/^tzid=/i.test(p) && fixed.some((x) => x.endsWith('Z'))));
    out.push(`${keep.join(';')}:${fixed.join(',')}`);
  }
  return out;
}
function registerZone(tzComp) {
  try {
    const id = tzComp.getFirstPropertyValue('tzid');
    if (id && !ICAL.TimezoneService.has(id)) ICAL.TimezoneService.register(tzComp);
  } catch (e) { /* a broken VTIMEZONE: times in it are treated as floating */ }
}
function emptyCalendar() {
  const c = new ICAL.Component('vcalendar');
  c.addPropertyWithValue('version', '2.0');
  c.addPropertyWithValue('prodid', PRODID);
  return c;
}

// ---------------------------------------------------------------- repeats
function parseRule(recur, start) {
  const raw = recur.toString();
  const custom = { custom: true, rrule: raw };
  const freq = recur.freq;
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return custom;
  const parts = Object.assign({}, recur.parts);
  delete parts.WKST;
  const keys = Object.keys(parts);
  const sd = start ? (start.isDate ? start : ICAL.Time.fromJSDate(jsDate(start), false)) : null;
  const rep = { freq, interval: recur.interval || 1 };
  if (recur.count) { rep.end = 'count'; rep.count = recur.count; }
  else if (recur.until) { rep.end = 'until'; rep.until = recur.until.isDate ? expand(recur.until.toICALString()) : dayKey(jsDate(recur.until)); }
  else rep.end = 'never';
  const one = (k) => parts[k] && parts[k].length === 1;
  const nthDay = (v) => { const m = /^([+-]?\d)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(String(v)); return m ? { nth: m[1] ? Number(m[1]) : 0, wd: m[2] } : null; };
  if (freq === 'DAILY') { if (keys.length) return custom; return rep; }
  if (freq === 'WEEKLY') {
    if (keys.some((k) => k !== 'BYDAY')) return custom;
    const days = (parts.BYDAY || []).map(nthDay);
    if (days.some((d) => !d || d.nth)) return custom;
    rep.byday = days.length ? WEEK_ORDER.filter((w) => days.some((d) => d.wd === w)) : (sd ? [WD[sd.dayOfWeek() - 1]] : []);
    return rep;
  }
  if (freq === 'MONTHLY') {
    if (!keys.length) { rep.mode = 'date'; return rep; }
    if (keys.length === 1 && one('BYMONTHDAY') && sd && Number(parts.BYMONTHDAY[0]) === sd.day) { rep.mode = 'date'; return rep; }
    if (keys.length === 1 && one('BYDAY')) {
      const d = nthDay(parts.BYDAY[0]);
      if (d && ((d.nth >= 1 && d.nth <= 4) || d.nth === -1)) { rep.mode = 'weekday'; rep.nth = d.nth; rep.wd = d.wd; return rep; }
    }
    return custom;
  }
  // YEARLY
  const startMonth = sd ? sd.month : null;
  if (!keys.length) { rep.mode = 'date'; return rep; }
  if (keys.every((k) => k === 'BYMONTH' || k === 'BYMONTHDAY') && one('BYMONTH') && Number(parts.BYMONTH[0]) === startMonth &&
      (!parts.BYMONTHDAY || (one('BYMONTHDAY') && Number(parts.BYMONTHDAY[0]) === sd.day))) { rep.mode = 'date'; return rep; }
  if (keys.length === 2 && one('BYMONTH') && one('BYDAY') && Number(parts.BYMONTH[0]) === startMonth) {
    const d = nthDay(parts.BYDAY[0]);
    if (d && ((d.nth >= 1 && d.nth <= 4) || d.nth === -1)) { rep.mode = 'weekday'; rep.nth = d.nth; rep.wd = d.wd; return rep; }
  }
  return custom;
}

function buildRule(rep, start) {
  if (rep.custom) return ICAL.Recur.fromString(rep.rrule);
  const r = new ICAL.Recur({ freq: rep.freq });
  const interval = Math.max(1, parseInt(rep.interval, 10) || 1);
  if (interval > 1) r.interval = interval;
  if (rep.end === 'count' && rep.count) r.count = Math.max(1, parseInt(rep.count, 10));
  const sd = start.isDate ? start : ICAL.Time.fromJSDate(jsDate(start), false);
  if (rep.freq === 'WEEKLY') {
    const days = (rep.byday && rep.byday.length ? rep.byday : [WD[sd.dayOfWeek() - 1]]);
    r.setComponent('BYDAY', WEEK_ORDER.filter((w) => days.includes(w)));
  } else if ((rep.freq === 'MONTHLY' || rep.freq === 'YEARLY') && rep.mode === 'weekday') {
    if (rep.freq === 'YEARLY') r.setComponent('BYMONTH', [sd.month]);
    r.setComponent('BYDAY', [`${rep.nth}${rep.wd}`]);
  }
  if (rep.end === 'until' && rep.until) {
    const { y, m, d } = parseDay(rep.until);
    r.until = start.isDate ? ICAL.Time.fromData({ year: y, month: m, day: d, isDate: true })
      : ICAL.Time.fromData({ year: y, month: m, day: d, hour: 23, minute: 59, second: 59, isDate: false });
  }
  return r;
}

function describeRecur(rep, startDate) {
  if (!rep) return '';
  const T = PH.t;
  if (rep.custom) return T('Custom ({rule})', { rule: String(rep.rrule).replace(/^FREQ=/i, '').toLowerCase().split(';').join(', ') });
  const n = Math.max(1, parseInt(rep.interval, 10) || 1);
  const st = startDate ? parseDay(startDate) : null;
  const nth = (k) => (k === -1 ? T('last') : PH.ordinal(k));
  let s;
  switch (rep.freq) {
    case 'DAILY': s = n === 1 ? T('Daily') : T('Every {n} days', { n }); break;
    case 'WEEKLY': {
      const days = WEEK_ORDER.filter((w) => (rep.byday || []).includes(w));
      const list = days.map((w) => PH.weekday(w)).join(', ');
      if (n === 1 && days.join() === 'MO,TU,WE,TH,FR') s = T('Every weekday');
      else if (!list) s = n === 1 ? T('Weekly') : T('Every {n} weeks', { n });
      else s = n === 1 ? T('Weekly on {days}', { days: list }) : T('Every {n} weeks on {days}', { n, days: list });
      break;
    }
    case 'MONTHLY': {
      if (rep.mode === 'weekday') s = n === 1 ? T('Monthly on the {nth} {weekday}', { nth: nth(rep.nth), weekday: PH.weekday(rep.wd) }) : T('Every {n} months on the {nth} {weekday}', { n, nth: nth(rep.nth), weekday: PH.weekday(rep.wd) });
      else if (st) s = n === 1 ? T('Monthly on day {day}', { day: st.d }) : T('Every {n} months on day {day}', { n, day: st.d });
      else s = n === 1 ? T('Monthly on the same day') : T('Every {n} months on the same day', { n });
      break;
    }
    case 'YEARLY': {
      if (rep.mode === 'weekday') s = n === 1 ? T('Yearly on the {nth} {weekday} of {month}', { nth: nth(rep.nth), weekday: PH.weekday(rep.wd), month: PH.month(st && st.m) }) : T('Every {n} years on the {nth} {weekday} of {month}', { n, nth: nth(rep.nth), weekday: PH.weekday(rep.wd), month: PH.month(st && st.m) });
      else if (st) s = n === 1 ? T('Yearly on {date}', { date: PH.monthDay(st.m, st.d) }) : T('Every {n} years on {date}', { n, date: PH.monthDay(st.m, st.d) });
      else s = n === 1 ? T('Yearly on the same date') : T('Every {n} years on the same date', { n });
      break;
    }
    default: s = T('Repeats');
  }
  if (rep.end === 'count' && rep.count) s = rep.count == 1 ? T('{rule}, once', { rule: s }) : T('{rule}, {n} times', { rule: s, n: rep.count });
  else if (rep.end === 'until' && rep.until) s = T('{rule}, until {date}', { rule: s, date: PH.date(rep.until) });
  return s;
}

// ---------------------------------------------------------------- the store
class Store {
  constructor(text) { this.clock = null; this.load(text); }
  _now() { return this.clock ? ms(this.clock()) : Date.now(); } // tests can set store.clock

  load(text) {
    this.root = (text == null || String(text).replace(/^﻿/, '').trim() === '') ? emptyCalendar() : parseCalendars(text);
    this._reindex();
    return this;
  }

  _reindex() {
    this.items = new Map();
    for (const c of this.root.getAllSubcomponents()) {
      if (c.name !== 'vevent' && c.name !== 'vtodo') continue;
      let uid = c.getFirstPropertyValue('uid');
      if (!uid) { uid = newUid(); c.updatePropertyWithValue('uid', uid); }
      uid = String(uid);
      let it = this.items.get(uid);
      if (!it) { it = { master: null, exceptions: [] }; this.items.set(uid, it); }
      if (c.hasProperty('recurrence-id') && (it.master || this._hasMaster(uid, c))) it.exceptions.push(c);
      else if (!it.master) it.master = c;
      else it.exceptions.push(c);
    }
    for (const [uid, it] of this.items) if (!it.master) { it.master = it.exceptions.shift(); if (!it.master) this.items.delete(uid); }
  }
  _hasMaster(uid, except) {
    return this.root.getAllSubcomponents().some((c) => c !== except && (c.name === 'vevent' || c.name === 'vtodo') &&
      String(c.getFirstPropertyValue('uid')) === uid && !c.hasProperty('recurrence-id'));
  }

  toString() {
    this.root.updatePropertyWithValue('prodid', PRODID);
    if (!this.root.hasProperty('version')) this.root.addPropertyWithValue('version', '2.0');
    let s = this.root.toString().replace(/\r?\n/g, '\r\n');
    if (!s.endsWith('\r\n')) s += '\r\n';
    return s;
  }

  count() { return this.items.size; }
  list() { return [...this.items.keys()].map((uid) => this.get(uid)); }

  categories() {
    const set = new Set();
    for (const it of this.items.values()) for (const c of readCategories(it.master)) set.add(c);
    return [...set].sort((a, b) => a.localeCompare(b));
  }
  todoLists() {
    const set = new Set();
    for (const it of this.items.values()) {
      if (it.master.name !== 'vtodo') continue;
      const l = it.master.getFirstPropertyValue('x-reminderfox-listid');
      if (l && String(l) !== DEFAULT_LIST) set.add(String(l));
    }
    return [DEFAULT_LIST, ...[...set].sort((a, b) => a.localeCompare(b))];
  }

  // ------------------------------------------------------------ DTO
  get(uid) {
    const it = this.items.get(String(uid));
    if (!it) return null;
    const c = it.master;
    const kind = c.name === 'vtodo' ? 'todo' : 'event';
    const startT = startOf(c);
    const dto = {
      uid: String(uid), kind,
      summary: str(c.getFirstPropertyValue('summary')),
      notes: str(c.getFirstPropertyValue('description')),
      location: str(c.getFirstPropertyValue('location')),
      url: str(c.getFirstPropertyValue('url')),
      categories: readCategories(c),
      important: isImportant(c),
      allDay: !!(startT && startT.isDate),
      date: null, time: null, endDate: null, endTime: null,
      repeat: null, repeatText: '', alarm: null, timezone: tzidOf(startT),
      completed: false, completedDate: null, doneLog: {},
      list: kind === 'todo' ? str(c.getFirstPropertyValue('x-reminderfox-listid')) || DEFAULT_LIST : null,
      untilDone: kind === 'event' && rucValue(c) > 0,
      showInTooltip: kind === 'todo' && flagOn(c, TOOLTIP_PROP),
      remind: null,
      display: '',
      archivedAt: (() => { const v = c.getFirstPropertyValue(ARCHIVED_PROP); return v && v.toJSDate ? v.toJSDate().getTime() : (v ? parseUtcStamp(v) : null); })(),
      archiveReason: str(c.getFirstPropertyValue(ARCHIVE_REASON_PROP)),
      order: (() => { const v = parseInt(str(c.getFirstPropertyValue(ORDER_PROP)), 10); return Number.isFinite(v) ? v : null; })(),
    };
    if (startT) {
      const sd = jsDate(startT);
      dto.date = dayKey(sd);
      dto.time = startT.isDate ? null : timeKey(sd);
      if (kind === 'event') {
        const endT = endOf(c, startT);
        if (endT) {
          if (startT.isDate) {
            const last = addDaysKey(dayKey(jsDate(endT)), -1);
            if (endT.isDate && last > dto.date) dto.endDate = last;
          } else if (endT.compare(startT) > 0) {
            const ed = jsDate(endT);
            if (dayKey(ed) !== dto.date) dto.endDate = dayKey(ed);
            dto.endTime = timeKey(ed);
          }
        }
      }
      const rr = c.getFirstPropertyValue('rrule');
      if (rr) { dto.repeat = parseRule(rr, startT); dto.repeatText = describeRecur(dto.repeat, dto.date); }
    }
    dto.remind = kind === 'todo' ? readRemind(c) : null;
    dto.alarm = dto.remind ? null : readAlarm(c, startT);
    if (kind === 'todo') {
      dto.completed = todoDone(c);
      const cd = c.getFirstPropertyValue('completed');
      if (dto.completed && cd) dto.completedDate = dayKey(cd.isDate ? jsDate(cd) : cd.toJSDate());
    } else {
      const st = completionState(c);
      for (const [d, at] of st.done) dto.doneLog[d] = at;
      if (dto.date && !dto.repeat) dto.completed = st.isDone(dto.date);
      if (st.through) dto.completedDate = st.through;
    }
    dto.display = expandAges(dto.summary, new Date(this._now()).getFullYear());
    return dto;
  }

  // ------------------------------------------------------------ edit
  upsert(dto) {
    let it = dto.uid ? this.items.get(String(dto.uid)) : null;
    const wantName = dto.kind === 'todo' ? 'vtodo' : 'vevent';
    let c;
    let isNew = false;
    if (!it) {
      c = new ICAL.Component(wantName);
      c.addPropertyWithValue('uid', dto.uid || newUid());
      this.root.addSubcomponent(c);
      it = { master: c, exceptions: [] };
      this.items.set(String(c.getFirstPropertyValue('uid')), it);
      isNew = true;
    } else {
      c = it.master;
      if (c.name !== wantName) {
        const copy = new ICAL.Component([wantName, c.jCal[1], c.jCal[2]]);
        this.root.removeSubcomponent(c);
        for (const ex of it.exceptions) this.root.removeSubcomponent(ex);
        it.exceptions = [];
        this.root.addSubcomponent(copy);
        it.master = c = copy;
        if (wantName === 'vtodo') { c.removeAllProperties('dtend'); c.removeAllProperties('duration'); stripEventCompletion(c); }
        else { c.removeAllProperties('due'); c.removeAllProperties('completed'); c.removeAllProperties('percent-complete'); if (String(c.getFirstPropertyValue('status') || '').toUpperCase() === 'COMPLETED') c.removeAllProperties('status'); }
      }
    }
    const uid = String(c.getFirstPropertyValue('uid'));
    setText(c, 'summary', dto.summary);
    setText(c, 'description', dto.notes);
    setText(c, 'location', dto.location);
    setText(c, 'url', dto.url);
    // categories
    c.removeAllProperties('categories');
    c.removeAllProperties('x-reminderfox-categories');
    const cats = uniq((dto.categories || []).map((x) => String(x).trim()).filter(Boolean));
    if (cats.length) { const p = new ICAL.Property('categories'); p.setValues(cats); c.addProperty(p); }
    // importance
    c.removeAllProperties('priority');
    c.removeAllProperties('x-reminderfox-priority');
    if (dto.important) c.addPropertyWithValue('priority', 1);
    // to-do list
    c.removeAllProperties('x-reminderfox-listid');
    if (wantName === 'vtodo' && dto.list && dto.list.trim() && dto.list.trim() !== DEFAULT_LIST) c.addPropertyWithValue('x-reminderfox-listid', dto.list.trim());

    // dates
    const oldStart = startOf(c);
    const oldStartStr = oldStart ? oldStart.toString() : null;
    let start = null;
    if (dto.date) {
      start = dateTime(dto.date, dto.allDay ? null : (dto.time || '09:00'));
      if (wantName === 'vtodo') {
        const hadStart = c.hasProperty('dtstart');
        const oldDue = c.getFirstPropertyValue('due');
        if (hadStart || !oldDue) {
          replaceTime(c, 'dtstart', start);
          if (oldDue && oldStart) { const due = start.clone(); due.addDuration(oldDue.subtractDate(oldStart)); replaceTime(c, 'due', toKind(due, start)); }
          else if (oldDue) replaceTime(c, 'due', start);
        } else replaceTime(c, 'due', start);
      } else {
        replaceTime(c, 'dtstart', start);
        c.removeAllProperties('duration');
        c.removeAllProperties('dtend');
        if (dto.allDay) {
          let endKey = dto.endDate && dto.endDate >= dto.date ? dto.endDate : dto.date;
          replaceTime(c, 'dtend', dateTime(addDaysKey(endKey, 1)));
        } else if (dto.endTime || (dto.endDate && dto.endDate !== dto.date)) {
          const end = dateTime(dto.endDate || dto.date, dto.endTime || dto.time || '09:00');
          if (end.compare(start) > 0) replaceTime(c, 'dtend', end);
        }
      }
    } else {
      // undated (to-dos only); an event without a date keeps no start
      for (const p of ['dtstart', 'due', 'dtend', 'duration', 'rrule', 'rdate', 'exdate']) c.removeAllProperties(p);
    }
    const startChanged = !!start && oldStartStr !== null && oldStartStr !== start.toString();

    // repeat
    if (!dto.repeat || !start) {
      c.removeAllProperties('rrule'); c.removeAllProperties('exdate'); c.removeAllProperties('rdate');
      this._dropExceptions(it);
    } else {
      const rule = buildRule(dto.repeat, start);
      const old = c.getFirstPropertyValue('rrule');
      c.removeAllProperties('rrule');
      c.addPropertyWithValue('rrule', rule);
      if (startChanged || (old && oldStart && oldStart.isDate !== start.isDate)) {
        c.removeAllProperties('exdate'); c.removeAllProperties('rdate'); this._dropExceptions(it);
      }
    }

    // to-do completion
    if (wantName === 'vtodo') {
      if (dto.completed) { if (!todoDone(c)) markTodoDone(c, this._now()); }
      else clearTodoDone(c);
    }

    // alarm: a to-do's reminder plan, or an ordinary alarm
    const plan = wantName === 'vtodo' ? normRemind(dto.remind) : null;
    if (plan && plan.start === 'before' && !dto.date) { plan.start = 'date'; plan.date = dayKey(new Date(this._now())); }
    if (plan && plan.start === 'before' && plan.every === 'once') {
      // "once, N days before the due date at HH:MM" is exactly an ordinary alarm relative to the due date: write it the
      // add-on's way (TRIGGER:-P6DT15H, no plan property), so the original add-on and other apps read it unchanged
      const dueMin = dto.allDay || !dto.time ? 0 : toMinutes(dto.time);
      c.removeAllProperties(REMIND_PROP);
      writeAlarm(c, { minutes: plan.days * 1440 + dueMin - toMinutes(plan.at) }, dto.summary);
    } else if (plan) {
      writeRemind(c, plan);
      writeRemindAlarm(c, plan, dto.date, dto.summary);
    } else {
      c.removeAllProperties(REMIND_PROP);
      writeAlarm(c, dto.alarm, dto.summary);
    }

    // the add-on's flags
    if (wantName === 'vtodo') c.removeAllProperties(RUC_PROP);
    let newlyFlagged = false;
    if (wantName === 'vevent' && 'untilDone' in dto) {
      if (!dto.untilDone) c.removeAllProperties(RUC_PROP);
      else if (!rucValue(c)) {
        // like the add-on: a one-off that is already missed is carried straight away; a repeating reminder
        // starts with its next occurrence (earlier misses happened before this edit)
        const repeatingNow = c.hasProperty('rrule') || c.hasProperty('rdate');
        c.updatePropertyWithValue(RUC_PROP, !repeatingNow && this._lastMissed(uid, it, this._now(), Infinity) ? '2' : '1');
        newlyFlagged = true;
      }
    }
    if (wantName === 'vtodo' && 'showInTooltip' in dto) {
      if (dto.showInTooltip) c.updatePropertyWithValue(TOOLTIP_PROP, '1'); else c.removeAllProperties(TOOLTIP_PROP);
    }
    if (!newlyFlagged) this._syncUntilDone(uid, it, this._now());

    touch(c, isNew, this._now());
    return uid;
  }

  _dropExceptions(it) {
    for (const ex of it.exceptions) this.root.removeSubcomponent(ex);
    it.exceptions = [];
  }

  setCompleted(uid, done, occurrenceStartMs) {
    const it = this.items.get(String(uid));
    if (!it) throw new Error('That item no longer exists.');
    const c = it.master;
    if (c.name === 'vtodo') {
      if (done && c.hasProperty('rrule') && startOf(c)) {
        const res = this._advanceTodo(it);
        touch(c, false, this._now());
        if (res) return 'advanced';
        markTodoDone(c, this._now());
        touch(c, false, this._now());
        return true;
      }
      if (done) markTodoDone(c, this._now()); else clearTodoDone(c);
      touch(c, false, this._now());
      return !!done;
    }
    // reminder (VEVENT)
    const st0 = startOf(c);
    if (!st0) return false;
    const occMs = occurrenceStartMs == null ? jsDate(st0).getTime() : ms(occurrenceStartMs);
    const D = dayKey(occMs);
    const st = completionState(c);
    if (done) {
      if (!st.isDone(D)) addDone(c, D, this._now());
    } else {
      if (st.through && D <= st.through) {
        const have = new Set(st.done.keys());
        this._iter(c, it.exceptions, (o) => {
          const d = dayKey(o.startMs);
          if (d > st.through) return false;
          if (d !== D && !have.has(d)) { addDone(c, d, null); have.add(d); }
          return true;
        });
        c.removeAllProperties('x-reminderfox-completed');
      }
      for (const p of c.getAllProperties('x-reminderfox-done')) if (String(p.getFirstValue()).trim() === compact(D)) c.removeProperty(p);
    }
    this._recomputeThrough(it);
    this._syncUntilDone(uid, it, this._now());
    touch(c, false, this._now());
    return !!done;
  }

  // ------------------------------------------------------------ remind daily until completed
  // The last occurrence that ended before today and isn't done (only one within `lookbackDays` counts).
  _lastMissed(uid, it, nowMs, lookbackDays = RUC_LOOKBACK_DAYS) {
    const m = it.master;
    if (m.name !== 'vevent' || !startOf(m)) return null;
    const today0 = startOfDayMs(nowMs);
    let last = null;
    this._iter(m, it.exceptions, (o) => {
      if (o.startMs >= today0) return false;
      if (o.endMs <= today0 || o.endMs === o.startMs) last = o;
      return true;
    });
    if (!last) return null;
    if (completionState(m).isDone(dayKey(last.startMs))) return null;
    if (last.startMs < today0 - lookbackDays * DAY_MS) return null;
    return last;
  }
  // For a flag of 1 on a repeating reminder the add-on only carries an occurrence that came after the last edit
  // (an edit after the miss, such as ticking it, means it was dealt with).
  _missedSinceEdit(it, o) {
    const m = it.master;
    if (!(m.hasProperty('rrule') || m.hasProperty('rdate'))) return true;
    const lm = lastModified(m);
    return lm == null || dayKey(lm) <= dayKey(o.startMs);
  }
  // The occurrence being carried over to today (flag 2 keeps carrying however old it is).
  _carried(uid, it, nowMs) {
    const v = rucValue(it.master);
    if (!v) return null;
    const o = this._lastMissed(uid, it, nowMs, v === 2 ? Infinity : RUC_LOOKBACK_DAYS);
    if (o && v === 1 && !this._missedSinceEdit(it, o)) return null;
    return o;
  }
  // Today's copy of a carried occurrence: same time of day, shown and alarmed as today's.
  _carriedRow(uid, it, o, nowMs) {
    const base = this._row(uid, it, o);
    const sd = new Date(o.startMs); const now = new Date(nowMs);
    const s = o.startT.isDate ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), sd.getHours(), sd.getMinutes());
    let e;
    if (o.startT.isDate) { e = new Date(s); e.setDate(e.getDate() + 1); } else e = new Date(s.getTime() + (o.endMs - o.startMs));
    return { ...base, summary: expandAges(rawSummary(o.item || it.master, it.master), s.getFullYear()),
      start: s.getTime(), end: e.getTime(), date: dayKey(s), occStart: o.startMs, carried: true, overdueSince: dayKey(o.startMs),
      completed: false, completedAt: null };
  }
  // Keeps the stored flag at 2 while an occurrence is being carried and 1 otherwise, so the add-on reads it the same way.
  _syncUntilDone(uid, it, nowMs) {
    const m = it.master;
    const v = rucValue(m);
    if (!v || m.name !== 'vevent') return false;
    const want = this._carried(uid, it, nowMs) ? 2 : 1;
    if (want === v) return false;
    m.updatePropertyWithValue(RUC_PROP, String(want));
    return true;
  }
  // Called by the app now and then (no edit timestamps change). Returns true when the file should be saved.
  syncUntilDone(now = this._now()) {
    let changed = false;
    for (const [uid, it] of this.items) if (this._syncUntilDone(uid, it, ms(now))) changed = true;
    return changed;
  }
  // To-dos flagged "show in tooltip": open, and undated or due within the next 15 days.
  tooltipTodos(now = this._now()) {
    const limit = dayKey(startOfDayMs(ms(now)) + TOOLTIP_DAYS * DAY_MS);
    return this.list().filter((d) => d.kind === 'todo' && d.showInTooltip && !d.completed && (!d.date || d.date <= limit))
      .sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')) || a.display.localeCompare(b.display));
  }

  _recomputeThrough(it) {
    const c = it.master;
    const st = completionState(c);
    let last = null;
    this._iter(c, it.exceptions, (o) => {
      const d = dayKey(o.startMs);
      if (!st.isDone(d)) return false;
      last = d;
      return true;
    });
    c.removeAllProperties('x-reminderfox-completed');
    if (last) c.addPropertyWithValue('x-reminderfox-completed', compact(last));
  }

  _advanceTodo(it) {
    const c = it.master;
    const cur = startOf(c);
    const curMs = jsDate(cur).getTime();
    let next = null;
    this._iter(c, it.exceptions, (o) => {
      if (o.startMs > curMs) { next = o; return false; }
      return true;
    });
    if (!next) return false;
    const target = next.recurrenceId || next.startT;
    const delta = target.subtractDate(cur);
    for (const name of ['dtstart', 'due']) {
      const p = c.getFirstProperty(name);
      if (!p) continue;
      const v = p.getFirstValue().clone();
      v.addDuration(delta);
      p.setValue(v);
    }
    const rp = c.getFirstProperty('rrule');
    const r = rp.getFirstValue();
    if (r.count) {
      if (r.count <= 1) return false;
      const nr = r.clone(); nr.count = r.count - 1; rp.setValue(nr);
    }
    clearTodoDone(c);
    const plan = readRemind(c);
    if (plan) { const st = startOf(c); writeRemindAlarm(c, plan, st ? dayKey(jsDate(st)) : null, str(c.getFirstPropertyValue('summary'))); }
    return true;
  }

  // The reminder times of a to-do's plan that fall in [from, to): only the latest one is returned, so a to-do never
  // shows twice in the alarm window (each fire time has its own key, so dismissing one doesn't stop the next).
  _remindFires(it, r, from, to) {
    const m = it.master;
    const st = startOf(m);
    const dueKey = st ? dayKey(jsDate(st)) : null;
    const first = remindFirst(r, dueKey);
    if (!first) return [];
    const step = REMIND_STEPS[r.every] || null;
    let end = Infinity;
    if (dueKey && !r.afterDue) end = st.isDate ? new Date(parseDay(dueKey).y, parseDay(dueKey).m - 1, parseDay(dueKey).d, 23, 59, 59).getTime() : jsDate(st).getTime();
    let k = 0;
    const t0 = remindAt(first, 0, step);
    if (step && from > t0) {
      const per = step[1] === 'm' ? 28 * DAY_MS * step[0] : step[0] * DAY_MS;
      k = Math.max(0, Math.floor((from - t0) / per) - 2);
    }
    let last = null;
    for (let i = 0; i < 2000; i++, k++) {
      const at = remindAt(first, k, step);
      if (at == null || at >= to || at > end) break;
      if (at >= from) last = at;
      if (!step) break;
    }
    return last == null ? [] : [last];
  }
  _todoRow(uid, it) {
    const m = it.master;
    const st = startOf(m);
    if (!st) return { ...this._row(uid, it, { startT: ICAL.Time.fromJSDate(new Date(0)), startMs: 0, endMs: 0, item: m }), start: null, end: null, date: null, time: null, allDay: false };
    const s = jsDate(st).getTime();
    return this._row(uid, it, { startT: st, startMs: s, endMs: s, item: m });
  }

  remove(uid, occurrenceStartMs) {
    const it = this.items.get(String(uid));
    if (!it) return false;
    const c = it.master;
    const repeating = c.hasProperty('rrule') || c.hasProperty('rdate');
    if (occurrenceStartMs != null && repeating) {
      const target = ms(occurrenceStartMs);
      let hit = null;
      this._iter(c, it.exceptions, (o) => {
        if (o.startMs === target) { hit = o; return false; }
        return o.startMs < target;
      });
      if (hit) {
        const rid = (hit.recurrenceId || hit.startT).clone();
        const dtp = c.getFirstProperty('dtstart') || c.getFirstProperty('due');
        const p = new ICAL.Property('exdate');
        const tz = dtp && dtp.getParameter('tzid');
        if (rid.isDate) p.resetType('date');
        p.setValue(rid);
        if (tz && !rid.isDate) p.setParameter('tzid', tz);
        c.addProperty(p);
        for (const ex of [...it.exceptions]) {
          const r = ex.getFirstPropertyValue('recurrence-id');
          if (r && jsDate(r).getTime() === jsDate(rid).getTime()) { this.root.removeSubcomponent(ex); it.exceptions.splice(it.exceptions.indexOf(ex), 1); }
        }
        touch(c, false, this._now());
        return 'occurrence';
      }
    }
    this.root.removeSubcomponent(c);
    for (const ex of it.exceptions) this.root.removeSubcomponent(ex);
    this.items.delete(String(uid));
    return true;
  }

  // ------------------------------------------------------------ occurrences
  // Walks occurrences in order; fn({startT, endT, startMs, endMs, item, recurrenceId}) returns false to stop.
  _iter(comp, exceptions, fn) {
    const startT = startOf(comp);
    if (!startT) return;
    let steps = 0;
    if (comp.name === 'vevent') {
      let ev;
      try { ev = new ICAL.Event(comp, { strictExceptions: false, exceptions: exceptions || [] }); } catch (e) { return; }
      const span = (s, e) => {
        let end = e;
        if (!end || end.compare(s) < 0) { end = s.clone(); if (s.isDate) end.day += 1; }
        return end;
      };
      if (!ev.isRecurring()) {
        const s = ev.startDate; const e = span(s, endOf(comp, s));
        fn({ startT: s, endT: e, startMs: jsDate(s).getTime(), endMs: jsDate(e).getTime(), item: comp, recurrenceId: null });
        return;
      }
      let iter;
      try { iter = ev.iterator(); } catch (e) { return; }
      let t;
      while ((t = safeNext(iter)) && steps++ < MAX_STEPS) {
        let d;
        try { d = ev.getOccurrenceDetails(t); } catch (e) { continue; }
        const s = d.startDate; const e = span(s, d.endDate);
        if (fn({ startT: s, endT: e, startMs: jsDate(s).getTime(), endMs: jsDate(e).getTime(), item: d.item.component || comp, recurrenceId: d.recurrenceId }) === false) return;
      }
      return;
    }
    // VTODO
    const mk = (s) => { const e = s.clone(); if (s.isDate) e.day += 1; return { startT: s, endT: e, startMs: jsDate(s).getTime(), endMs: jsDate(e).getTime(), item: comp, recurrenceId: s }; };
    if (!comp.hasProperty('rrule') && !comp.hasProperty('rdate')) { fn(mk(startT)); return; }
    let ex;
    try { ex = new ICAL.RecurExpansion({ component: comp, dtstart: startT }); } catch (e) { fn(mk(startT)); return; }
    let t;
    while ((t = safeNext(ex)) && steps++ < MAX_STEPS) if (fn(mk(t)) === false) return;
  }

  _row(uid, it, o) {
    const m = it.master;
    const c = o.item || m;
    const kind = m.name === 'vtodo' ? 'todo' : 'event';
    const repeating = m.hasProperty('rrule') || m.hasProperty('rdate');
    let completed = false;
    let completedAt = null;
    if (kind === 'todo') {
      completed = todoDone(m);
      const cd = m.getFirstPropertyValue('completed');
      if (completed && cd) completedAt = cd.toJSDate().getTime();
    } else {
      const st = this._stCache && this._stCache.get(uid) || completionState(m);
      const d = dayKey(o.startMs);
      completed = st.isDone(d);
      completedAt = st.done.has(d) ? st.done.get(d) : null;
    }
    const rr = m.getFirstPropertyValue('rrule');
    const startDateKey = dayKey(o.startMs);
    return {
      uid, kind,
      summary: expandAges(rawSummary(c, m), new Date(o.startMs).getFullYear()),
      start: o.startMs, end: o.endMs,
      date: startDateKey, time: o.startT.isDate ? null : timeKey(o.startMs),
      allDay: !!o.startT.isDate,
      repeating,
      repeatText: rr ? describeRecur(parseRule(rr, startOf(m)), dayKey(jsDate(startOf(m)))) : '',
      important: isImportant(c),
      categories: readCategories(c),
      hasAlarm: c.getAllSubcomponents('valarm').length > 0,
      completed, completedAt,
      notes: str(c.getFirstPropertyValue('description')),
      location: str(c.getFirstPropertyValue('location')),
      list: kind === 'todo' ? str(m.getFirstPropertyValue('x-reminderfox-listid')) || DEFAULT_LIST : null,
      untilDone: kind === 'event' && rucValue(m) > 0,
      showInTooltip: kind === 'todo' && flagOn(m, TOOLTIP_PROP),
    };
  }

  occurrences(from, to, opts = {}) {
    const includeTodos = opts.includeTodos !== false;
    const a = ms(from); const b = ms(to);
    const now = opts.now == null ? this._now() : ms(opts.now);
    const overlaps = (s, e) => (s < b) && (e > s ? e > a : s >= a);
    const out = [];
    for (const [uid, it] of this.items) {
      if (!includeTodos && it.master.name === 'vtodo') continue;
      const rows = [];
      this._iter(it.master, it.exceptions, (o) => {
        if (o.startMs >= b) return false;
        if (overlaps(o.startMs, o.endMs)) rows.push(this._row(uid, it, o));
        return true;
      });
      // a missed "remind until completed" occurrence moves to today
      const c = this._carried(uid, it, now);
      if (c) {
        const cr = this._carriedRow(uid, it, c, now);
        if (overlaps(cr.start, cr.end)) {
          for (let i = rows.length - 1; i >= 0; i--) if (rows[i].start === c.startMs) rows.splice(i, 1);
          rows.push(cr);
        }
      }
      out.push(...rows);
    }
    return out.sort(byStart);
  }

  nextOccurrences(from, opts = {}) {
    const a = ms(from);
    const now = opts.now == null ? this._now() : ms(opts.now);
    // opts.count: how many upcoming occurrences of a repeating item to return; opts.until: and only those starting
    // before then (default a year ahead; the horizon itself excluded). The next occurrence is always returned, however far off.
    const count = Math.max(1, opts.count == null ? 1 : Number(opts.count) || 1);
    const horizon = opts.until == null ? a + 366 * DAY_MS : ms(opts.until);
    const out = [];
    for (const [uid, it] of this.items) {
      const m = it.master;
      const carried = this._carried(uid, it, now);
      if (carried) out.push(this._carriedRow(uid, it, carried, now));
      if (carried && count === 1) continue;
      if (!startOf(m)) {
        out.push({ ...this._row(uid, it, { startT: ICAL.Time.fromJSDate(new Date(0)), startMs: 0, endMs: 0, item: m }), start: null, end: null, date: null, time: null, allDay: false });
        continue;
      }
      const found = []; let last = null;
      const want = carried ? count - 1 : count;
      this._iter(m, it.exceptions, (o) => {
        const ended = o.endMs > o.startMs ? o.endMs > a : o.startMs >= a;
        if (ended) {
          if (found.length && (o.startMs >= horizon)) return false; // the horizon itself is excluded
          found.push(o);
          return found.length < want;
        }
        last = o;
        return true;
      });
      for (const o of found) out.push(this._row(uid, it, o));
      if (!found.length && !carried && last) out.push({ ...this._row(uid, it, last), past: true });
    }
    return out.sort(byStart);
  }

  // Past occurrences of repeating reminders, for the All and Past lists. Without opts.since: every occurrence up to the
  // last one ticked. With opts.since: every occurrence from then on, ticked or not (null = since the series began),
  // plus older ones that were ticked.
  // At most maxPerItem per item, the most recent kept.
  completedHistory(before, opts = {}) {
    const maxPerItem = opts.maxPerItem || 2000;
    const b = ms(before);
    const all = 'since' in opts;
    const since = opts.since == null ? -Infinity : ms(opts.since);
    const out = [];
    for (const [uid, it] of this.items) {
      const m = it.master;
      if (m.name !== 'vevent' || !m.hasProperty('rrule')) continue;
      const st = completionState(m);
      let latest = st.through;
      for (const d of st.done.keys()) if (!latest || d > latest) latest = d;
      if (!latest && !all) continue;
      const rows = [];
      this._iter(m, it.exceptions, (o) => {
        if (o.startMs >= b) return false;
        const d = dayKey(o.startMs);
        if (!all && d > latest) return false;
        // with a limit, older occurrences are kept only when they were ticked themselves
        if (all && o.startMs < since && !st.isDone(d)) return true;
        rows.push(o);
        if (rows.length > maxPerItem) rows.shift();
        return true;
      });
      for (const o of rows) out.push({ ...this._row(uid, it, o), past: true, history: true });
    }
    return out.sort(byStart);
  }

  alarms(from, to, opts = {}) {
    const a = ms(from); const b = ms(to);
    const now = opts.now == null ? this._now() : ms(opts.now);
    const out = [];
    for (const [uid, it] of this.items) {
      const m = it.master;
      if (m.name === 'vtodo' && todoDone(m)) continue;
      const plan = m.name === 'vtodo' ? readRemind(m) : null;
      if (plan) {
        for (const at of this._remindFires(it, plan, a, b)) {
          const row = this._todoRow(uid, it);
          row.at = at; row.key = `${uid}|${row.start == null ? 0 : row.start}|${at}`; row.remind = true;
          out.push(row);
        }
        continue;
      }
      const startT = startOf(m);
      if (!startT) continue;
      const defs = alarmDefs(m);
      for (const ex of it.exceptions) for (const d of alarmDefs(ex)) if (d.abs == null && !defs.some((x) => x.offset === d.offset && x.related === d.related)) defs.push(d);
      if (!defs.length) continue;
      const rel = defs.filter((d) => d.abs == null);
      const minOff = rel.length ? Math.min(...rel.map((d) => d.offset)) : 0;
      const maxOff = rel.length ? Math.max(...rel.map((d) => d.offset)) : 0;
      let first = true;
      const st = m.name === 'vevent' ? completionState(m) : null;
      const carried = this._carried(uid, it, now);
      if (carried) {
        // the carried occurrence alarms again every day, at the same offset from today's copy
        const cr = this._carriedRow(uid, it, carried, now);
        const sd = new Date(cr.start);
        const base = carried.startT.isDate ? ICAL.Time.fromData({ year: sd.getFullYear(), month: sd.getMonth() + 1, day: sd.getDate(), isDate: true })
          : ICAL.Time.fromData({ year: sd.getFullYear(), month: sd.getMonth() + 1, day: sd.getDate(), hour: sd.getHours(), minute: sd.getMinutes(), second: 0, isDate: false });
        const baseEnd = base.clone(); baseEnd.addDuration(carried.endT.subtractDate(carried.startT));
        for (const d of rel) {
          const at = fireAt(d.related === 'END' ? baseEnd : base, d.dur);
          if (at >= a && at < b) out.push({ ...cr, at, key: `${uid}|${carried.startMs}|${at}` });
        }
      }
      this._iter(m, it.exceptions, (o) => {
        if (carried && o.startMs === carried.startMs) return true; // replaced by today's copy
        if (o.startMs + minOff - 2 * DAY_MS >= b && !first) return false;
        const isFirst = first; first = false;
        const itemDefs = o.item && o.item !== m ? alarmDefs(o.item) : defs;
        const useDefs = itemDefs.length ? itemDefs : defs;
        if (st && st.isDone(dayKey(o.startMs))) return o.startMs + minOff - 2 * DAY_MS < b;
        for (const d of useDefs) {
          let at;
          if (d.abs != null) { if (!isFirst) continue; at = d.abs; }
          else at = fireAt(d.related === 'END' ? o.endT : o.startT, d.dur);
          if (at >= a && at < b) {
            const row = this._row(uid, it, o);
            row.at = at; row.key = `${uid}|${o.startMs}|${at}`;
            if (!out.some((x) => x.key === row.key)) out.push(row);
          }
        }
        // keep walking while a later occurrence could still fire inside the window
        return o.startMs + minOff - 2 * DAY_MS < b || o.endMs + maxOff - 2 * DAY_MS < b;
      });
    }
    return out.sort((x, y) => x.at - y.at || byStart(x, y));
  }

  // ------------------------------------------------------------ lists, categories, order
  // Puts an item on a to-do list. A to-do keeps everything (only its list changes, and it goes to the end of the
  // new list's manual order); a reminder becomes a to-do there, as the add-on's "Move to list" did.
  moveToList(uid, list) {
    const it = this.items.get(String(uid));
    if (!it) return null;
    list = String(list || '').trim() || DEFAULT_LIST;
    if (it.master.name === 'vtodo') {
      const cur = str(it.master.getFirstPropertyValue('x-reminderfox-listid')) || DEFAULT_LIST;
      if (cur === list) return String(uid);
      for (const c of [it.master, ...it.exceptions]) {
        c.removeAllProperties('x-reminderfox-listid');
        if (list !== DEFAULT_LIST) c.addPropertyWithValue('x-reminderfox-listid', list);
      }
      it.master.removeAllProperties(ORDER_PROP);
      touch(it.master, false, this._now());
      return String(uid);
    }
    const dto = this.get(uid);
    return this.upsert({ ...dto, kind: 'todo', list, untilDone: false, completed: false });
  }
  // An exact copy of an item under a new UID: repeats and their exceptions, alarms, reminder plan, notes, categories,
  // star and any property the app doesn't know all come along. The copy starts fresh (not completed, not archived).
  // opts.list puts the copy on that to-do list (a reminder copied to a list becomes a to-do there); without it the
  // copy stays where the original is, right after it in "My order". opts.suffix is added to the title.
  duplicate(uid, opts = {}) {
    const it = this.items.get(String(uid));
    if (!it) throw new Error('That item no longer exists.');
    const nu = newUid();
    const now = this._now();
    const title = str(it.master.getFirstPropertyValue('summary'));
    const comps = [it.master, ...it.exceptions].map((c) => new ICAL.Component(JSON.parse(JSON.stringify(c.jCal))));
    for (const c of comps) {
      c.updatePropertyWithValue('uid', nu);
      if (c.name === 'vtodo') clearTodoDone(c); else stripEventCompletion(c);
      c.removeAllProperties(ARCHIVED_PROP);
      c.removeAllProperties(ARCHIVE_REASON_PROP);
      if (rucValue(c) === 2) c.updatePropertyWithValue(RUC_PROP, '1');
      if (opts.suffix && str(c.getFirstPropertyValue('summary')) === title) c.updatePropertyWithValue('summary', title + opts.suffix);
      if (c.hasProperty('created')) c.updatePropertyWithValue('created', ICAL.Time.fromJSDate(new Date(now), true));
      touch(c, true, now);
    }
    for (const c of comps) this.root.addSubcomponent(c);
    this._reindex();
    const sameList = opts.list == null || (it.master.name === 'vtodo' && (String(opts.list).trim() || DEFAULT_LIST) === (str(it.master.getFirstPropertyValue('x-reminderfox-listid')) || DEFAULT_LIST));
    if (!sameList) return this.moveToList(nu, opts.list);
    // keep "My order": the copy goes right after the original
    if (it.master.name === 'vtodo' && it.master.hasProperty(ORDER_PROP)) {
      const list = str(it.master.getFirstPropertyValue('x-reminderfox-listid')) || DEFAULT_LIST;
      const ord = (c) => { const v = parseInt(str(c.getFirstPropertyValue(ORDER_PROP)), 10); return Number.isFinite(v) ? v : 1e9; };
      const ids = [...this.items].filter(([u, x]) => u !== nu && x.master.name === 'vtodo' && (str(x.master.getFirstPropertyValue('x-reminderfox-listid')) || DEFAULT_LIST) === list)
        .sort((a, b) => ord(a[1].master) - ord(b[1].master)).map(([u]) => u);
      ids.splice(ids.indexOf(String(uid)) + 1, 0, nu);
      this.setOrder(ids);
    }
    return nu;
  }
  // Deletes every to-do on a list (used when a list is removed together with its items).
  removeListItems(name) {
    const uids = [...this.items].filter(([, x]) => x.master.name === 'vtodo' && (str(x.master.getFirstPropertyValue('x-reminderfox-listid')) || DEFAULT_LIST) === name).map(([u]) => u);
    for (const u of uids) this.remove(u);
    return uids.length;
  }
  // Renames a to-do list on every item that uses it ("To-Do's" is the default list: items there carry no list id).
  renameList(from, to) {
    let n = 0;
    to = String(to || '').trim() || DEFAULT_LIST;
    for (const it of this.items.values()) {
      const m = it.master;
      if (m.name !== 'vtodo') continue;
      const cur = str(m.getFirstPropertyValue('x-reminderfox-listid')) || DEFAULT_LIST;
      if (cur !== from) continue;
      m.removeAllProperties('x-reminderfox-listid');
      if (to !== DEFAULT_LIST) m.addPropertyWithValue('x-reminderfox-listid', to);
      touch(m, false, this._now());
      n++;
    }
    return n;
  }
  // Renames (or, with an empty name, removes) a category on every item; merging into an existing name is fine.
  renameCategory(from, to) {
    let n = 0;
    const target = String(to || '').trim();
    for (const it of this.items.values()) {
      for (const c of [it.master, ...it.exceptions]) {
        const cats = readCategories(c);
        if (!cats.includes(from)) continue;
        const next = uniq(cats.map((x) => (x === from ? target : x)).filter(Boolean));
        c.removeAllProperties('categories');
        c.removeAllProperties('x-reminderfox-categories');
        if (next.length) { const p = new ICAL.Property('categories'); p.setValues(next); c.addProperty(p); }
        if (c === it.master) { touch(c, false, this._now()); n++; }
      }
    }
    return n;
  }
  categoryCounts() {
    const counts = {};
    for (const it of this.items.values()) for (const c of readCategories(it.master)) counts[c] = (counts[c] || 0) + 1;
    return counts;
  }
  listCounts() {
    const counts = {};
    for (const it of this.items.values()) {
      if (it.master.name !== 'vtodo') continue;
      const l = str(it.master.getFirstPropertyValue('x-reminderfox-listid')) || DEFAULT_LIST;
      counts[l] = (counts[l] || 0) + 1;
    }
    return counts;
  }
  // Manual order: gives the to-dos in `uids` the order 1, 2, 3… (only those whose order changes are touched).
  setOrder(uids) {
    let i = 0;
    for (const uid of uids) {
      i++;
      const it = this.items.get(String(uid));
      if (!it) continue;
      const m = it.master;
      if (parseInt(str(m.getFirstPropertyValue(ORDER_PROP)), 10) === i) continue;
      m.updatePropertyWithValue(ORDER_PROP, String(i));
      touch(m, false, this._now());
    }
    return i;
  }

  // ------------------------------------------------------------ archive support
  // Takes an item out of this calendar, whole (master, exceptions and the time zones it uses), as plain jCal data.
  extract(uid) {
    const it = this.items.get(String(uid));
    if (!it) return null;
    const comps = [it.master, ...it.exceptions];
    const zones = new Set();
    for (const c of comps) collectZones(c, zones);
    const tz = this.root.getAllSubcomponents('vtimezone').filter((z) => zones.has(z.getFirstPropertyValue('tzid'))).map((z) => z.jCal);
    const data = { uid: String(uid), comps: comps.map((c) => JSON.parse(JSON.stringify(c.jCal))), tz: JSON.parse(JSON.stringify(tz)) };
    for (const c of comps) this.root.removeSubcomponent(c);
    this.items.delete(String(uid));
    return data;
  }
  // Puts an extracted item in (replacing one with the same UID). `archive` stamps or clears the archive marks.
  insert(data, archive) {
    if (!data) return null;
    if (this.items.has(data.uid)) { const old = this.items.get(data.uid); for (const c of [old.master, ...old.exceptions]) this.root.removeSubcomponent(c); this.items.delete(data.uid); }
    for (const z of data.tz || []) {
      const tz = new ICAL.Component(z);
      if (!this.root.getAllSubcomponents('vtimezone').some((x) => x.getFirstPropertyValue('tzid') === tz.getFirstPropertyValue('tzid'))) { this.root.addSubcomponent(tz); registerZone(tz); }
    }
    const comps = data.comps.map((j) => new ICAL.Component(j));
    for (const c of comps) this.root.addSubcomponent(c);
    this._reindex();
    const master = this.items.get(data.uid) && this.items.get(data.uid).master;
    if (master && archive) {
      master.removeAllProperties(ARCHIVED_PROP); master.removeAllProperties(ARCHIVE_REASON_PROP);
      if (archive.archived) {
        master.addPropertyWithValue(ARCHIVED_PROP, ICAL.Time.fromJSDate(new Date(this._now()), true));
        if (archive.reason) master.addPropertyWithValue(ARCHIVE_REASON_PROP, String(archive.reason));
      }
    }
    return data.uid;
  }
  // Items that are finished before `cutoff`: one-off reminders that ended, repeating reminders whose series ended,
  // and completed to-dos. Flagged "remind until completed" reminders that are still open are left alone.
  finishedBefore(cutoff) {
    const b = ms(cutoff);
    const out = [];
    for (const [uid, it] of this.items) {
      const m = it.master;
      if (m.name === 'vtodo') {
        if (!todoDone(m)) continue;
        const cd = m.getFirstPropertyValue('completed');
        const when = cd && cd.toJSDate ? cd.toJSDate().getTime() : null;
        if (when == null || when < b) out.push({ uid, kind: 'todo', summary: rawSummary(m), reason: 'Completed' });
        continue;
      }
      if (!startOf(m)) continue;
      const rr = m.getFirstPropertyValue('rrule');
      if (rr && !rr.count && !rr.until) continue; // repeats forever
      let last = null; let steps = 0;
      this._iter(m, it.exceptions, (o) => { last = o; return ++steps < MAX_STEPS; });
      if (!last || last.endMs > b || (last.endMs === last.startMs && last.startMs >= b)) continue;
      if (rucValue(m) && !completionState(m).isDone(dayKey(last.startMs))) continue;
      out.push({ uid, kind: 'event', summary: rawSummary(m), reason: rr ? 'Series ended' : 'Expired' });
    }
    return out.sort((x, y) => x.summary.localeCompare(y.summary));
  }

  // ------------------------------------------------------------ import / export
  // What an import of `text` would do, without changing anything: how many reminders and to-dos it holds, how many are
  // already here (same UID), and how many look like duplicates (no UID match, but the same title and date as an item
  // you have). Used by the import dialog.
  previewImport(text) {
    const inc = new Store(text);
    const keys = this._dupKeys();
    const out = { events: 0, todos: 0, existing: 0, duplicates: 0 };
    for (const [uid, it] of inc.items) {
      if (it.master.name === 'vtodo') out.todos++; else out.events++;
      if (this.items.has(uid)) out.existing++;
      else if (keys.has(dupKey(it.master))) out.duplicates++;
    }
    return out;
  }
  _dupKeys() { return new Set([...this.items.values()].map((x) => dupKey(x.master))); }
  // Merges items from another calendar. Same UID: the newer copy (LAST-MODIFIED) wins. opts.duplicates 'skip' leaves out
  // items whose title and date match one you already have under another UID (counted in `duplicates`); opts.category
  // adds that category to every item that comes in (added or updated).
  import(text, opts = {}) {
    const inc = parseCalendars(text);
    const res = { added: 0, updated: 0, skipped: 0, duplicates: 0 };
    const keys = opts.duplicates === 'skip' ? this._dupKeys() : null;
    const cat = String(opts.category || '').trim();
    for (const tz of inc.getAllSubcomponents('vtimezone')) {
      const id = tz.getFirstPropertyValue('tzid');
      if (!this.root.getAllSubcomponents('vtimezone').some((z) => z.getFirstPropertyValue('tzid') === id)) {
        inc.removeSubcomponent(tz);
        this.root.addSubcomponent(tz);
        registerZone(tz);
      }
    }
    const groups = new Map();
    for (const c of inc.getAllSubcomponents()) {
      if (c.name !== 'vevent' && c.name !== 'vtodo') continue;
      let uid = c.getFirstPropertyValue('uid');
      if (!uid) { uid = newUid(); c.updatePropertyWithValue('uid', uid); }
      uid = String(uid);
      if (!groups.has(uid)) groups.set(uid, []);
      groups.get(uid).push(c);
    }
    for (const [uid, comps] of groups) {
      const ex = this.items.get(uid);
      if (ex) {
        const mine = [ex.master, ...ex.exceptions].map((c) => c.toString()).join('\n');
        const theirs = comps.map((c) => c.toString()).join('\n');
        if (mine === theirs) { res.skipped++; continue; }
        const lmMine = lastModified(ex.master);
        const master = comps.find((c) => !c.hasProperty('recurrence-id')) || comps[0];
        const lmTheirs = lastModified(master);
        if (lmMine != null && (lmTheirs == null || lmMine > lmTheirs)) { res.skipped++; continue; }
        this.root.removeSubcomponent(ex.master);
        for (const e of ex.exceptions) this.root.removeSubcomponent(e);
        res.updated++;
      } else {
        const master = comps.find((c) => !c.hasProperty('recurrence-id')) || comps[0];
        if (keys && keys.has(dupKey(master))) { res.duplicates++; continue; }
        if (keys) keys.add(dupKey(master));
        res.added++;
      }
      for (const c of comps) {
        if (cat) addCategory(c, cat);
        inc.removeSubcomponent(c); this.root.addSubcomponent(c);
      }
    }
    this._reindex();
    if (!keys) delete res.duplicates; // only counted when skipping them was asked for
    return res;
  }

  export(opts = {}) {
    const kinds = opts.kinds ? [].concat(opts.kinds) : null;
    const uids = opts.uids ? new Set([].concat(opts.uids).map(String)) : null;
    const cal = emptyCalendar();
    const comps = [];
    const zones = new Set();
    for (const [uid, it] of this.items) {
      const kind = it.master.name === 'vtodo' ? 'todo' : 'event';
      if (kinds && !kinds.includes(kind)) continue;
      if (uids && !uids.has(uid)) continue;
      for (const c of [it.master, ...it.exceptions]) { comps.push(c); collectZones(c, zones); }
    }
    for (const tz of this.root.getAllSubcomponents('vtimezone')) {
      if (zones.has(tz.getFirstPropertyValue('tzid'))) cal.addSubcomponent(new ICAL.Component(JSON.parse(JSON.stringify(tz.jCal))));
    }
    for (const c of comps) cal.addSubcomponent(new ICAL.Component(JSON.parse(JSON.stringify(c.jCal))));
    let s = cal.toString().replace(/\r?\n/g, '\r\n');
    if (!s.endsWith('\r\n')) s += '\r\n';
    return s;
  }
}

// ---------------------------------------------------------------- component helpers
// "Same title and date" for the import's duplicate check: the title (letter case and spaces ignored) and the local day
// of its start or due date (none for an undated to-do).
function dupKey(c) {
  const st = startOf(c);
  return `${str(c.getFirstPropertyValue('summary')).trim().replace(/\s+/g, ' ').toLowerCase()}|${st ? dayKey(jsDate(st)) : ''}`;
}
function addCategory(c, cat) {
  const cats = readCategories(c);
  if (cats.some((x) => x.toLowerCase() === cat.toLowerCase())) return;
  c.removeAllProperties('categories');
  c.removeAllProperties('x-reminderfox-categories');
  const p = new ICAL.Property('categories'); p.setValues([...cats, cat]); c.addProperty(p);
}
function newUid() { return `${crypto.randomUUID()}@reminderfoxagain`; }
function str(v) { return v == null ? '' : String(v); }
function uniq(a) { return [...new Set(a)]; }
function byStart(x, y) { return (x.start == null) - (y.start == null) || (x.start || 0) - (y.start || 0) || String(x.summary).localeCompare(String(y.summary)); }
function safeNext(it) { try { return it.next(); } catch (e) { return null; } }

function startOf(c) { return c.getFirstPropertyValue('dtstart') || (c.name === 'vtodo' ? c.getFirstPropertyValue('due') : null) || null; }
function endOf(c, startT) {
  const e = c.getFirstPropertyValue('dtend');
  if (e) return e;
  const dur = c.getFirstPropertyValue('duration');
  if (dur && startT) { const x = startT.clone(); x.addDuration(dur); return x; }
  return null;
}
function readCategories(c) {
  const out = [];
  for (const p of c.getAllProperties('categories')) for (const v of p.getValues()) out.push(...String(v).split(','));
  for (const p of c.getAllProperties('x-reminderfox-categories')) out.push(...String(p.getFirstValue() || '').split(','));
  return uniq(out.map((s) => s.trim()).filter(Boolean));
}
function isImportant(c) {
  const p = c.getFirstPropertyValue('priority');
  if (p != null && p !== '') { const n = Number(p); return n >= 1 && n <= 4; }
  return String(c.getFirstPropertyValue('x-reminderfox-priority') || '') === '1';
}
function setText(c, name, value) {
  const v = value == null ? '' : String(value);
  if (v.trim() === '') { c.removeAllProperties(name); return; }
  const p = c.getFirstProperty(name);
  if (p) p.setValue(v); else c.addPropertyWithValue(name, v);
}
function replaceTime(c, name, t) {
  const old = c.getFirstProperty(name);
  const p = new ICAL.Property(name);
  if (t.isDate) p.resetType('date');
  p.setValue(t);
  if (old) {
    // keep unknown parameters, drop the ones that describe the old value
    for (const [k, v] of Object.entries(old.jCal[1] || {})) if (!['tzid', 'value'].includes(k)) p.setParameter(k, v);
    c.removeProperty(old);
  }
  c.addProperty(p);
}
function toKind(t, like) {
  if (like.isDate && !t.isDate) { const x = t.clone(); x.isDate = true; return x; }
  return t;
}
function todoDone(c) {
  if (String(c.getFirstPropertyValue('status') || '').toUpperCase() === 'COMPLETED') return true;
  if (c.hasProperty('completed')) return true;
  return Number(c.getFirstPropertyValue('percent-complete')) >= 100;
}
function markTodoDone(c, nowMs) {
  c.updatePropertyWithValue('status', 'COMPLETED');
  c.removeAllProperties('completed');
  c.addPropertyWithValue('completed', nowMs == null ? utcNow() : ICAL.Time.fromJSDate(new Date(nowMs), true));
  c.updatePropertyWithValue('percent-complete', 100);
}
function clearTodoDone(c) {
  c.removeAllProperties('completed');
  c.removeAllProperties('percent-complete');
  if (String(c.getFirstPropertyValue('status') || '').toUpperCase() === 'COMPLETED') c.removeAllProperties('status');
}
function stripEventCompletion(c) { c.removeAllProperties('x-reminderfox-completed'); c.removeAllProperties('x-reminderfox-done'); }
function touch(c, isNew, nowMs) {
  const now = nowMs == null ? utcNow() : ICAL.Time.fromJSDate(new Date(nowMs), true);
  c.updatePropertyWithValue('dtstamp', now);
  c.updatePropertyWithValue('last-modified', now.clone());
  const seq = parseInt(c.getFirstPropertyValue('sequence'), 10);
  c.updatePropertyWithValue('sequence', isNew ? 0 : (Number.isFinite(seq) ? seq + 1 : 1));
}
function rucValue(c) { const v = parseInt(str(c.getFirstPropertyValue(RUC_PROP)).trim(), 10); return v === 1 || v === 2 ? v : 0; }
function flagOn(c, prop) { if (!c.hasProperty(prop)) return false; const v = str(c.getFirstPropertyValue(prop)).trim().toLowerCase(); return v !== '0' && v !== 'false'; }
function rawSummary(c, m) { return str(c.getFirstPropertyValue('summary') || (m && m.getFirstPropertyValue('summary'))); }
function lastModified(c) { const v = c.getFirstPropertyValue('last-modified'); return v && v.toJSDate ? v.toJSDate().getTime() : null; }

// completion of reminders
function completionState(c) {
  const t = str(c.getFirstPropertyValue('x-reminderfox-completed')).trim();
  const through = /^\d{8}/.test(t) ? expand(t) : null;
  const done = new Map();
  for (const p of c.getAllProperties('x-reminderfox-done')) {
    const v = str(p.getFirstValue()).trim();
    if (!/^\d{8}$/.test(v)) continue;
    const at = parseUtcStamp(p.getParameter('x-completed-at'));
    const k = expand(v);
    if (!done.has(k) || (done.get(k) == null && at != null)) done.set(k, at);
  }
  return { through, done, isDone: (d) => (through && d <= through) || done.has(d) };
}
function addDone(c, day, atMs) {
  const p = new ICAL.Property('x-reminderfox-done');
  p.setValue(compact(day));
  if (atMs != null) p.setParameter('x-completed-at', utcStamp(atMs));
  c.addProperty(p);
}

// alarms
function alarmDefs(c) {
  const out = [];
  for (const a of c.getAllSubcomponents('valarm')) {
    const tp = a.getFirstProperty('trigger');
    if (!tp) continue;
    const v = tp.getFirstValue();
    if (v instanceof ICAL.Duration) out.push({ dur: v, offset: v.toSeconds() * 1000, related: String(tp.getParameter('related') || 'START').toUpperCase() });
    else if (v && v.toJSDate) out.push({ abs: v.toJSDate().getTime() });
  }
  return out;
}
// fire time of a relative trigger: days and weeks are calendar days, hours and minutes wall-clock
function fireAt(base, dur) {
  const t = base.clone();
  if (t.isDate) { t.isDate = false; t.hour = 0; t.minute = 0; t.second = 0; }
  t.addDuration(dur);
  return t.toJSDate().getTime();
}
function readAlarm(c, startT) {
  const a = c.getFirstSubcomponent('valarm');
  if (!a) return null;
  const tp = a.getFirstProperty('trigger');
  if (!tp) return { keep: true, text: 'Custom alarm' };
  const v = tp.getFirstValue();
  if (v instanceof ICAL.Duration) {
    if (String(tp.getParameter('related') || 'START').toUpperCase() === 'END') return { keep: true, text: 'Custom alarm' };
    return { minutes: Math.round(-v.toSeconds() / 60) };
  }
  if (v && v.toJSDate) { const d = v.toJSDate(); return { keep: true, text: `At ${dayKey(d)} ${timeKey(d)}` }; }
  return { keep: true, text: 'Custom alarm' };
}
// ---------------------------------------------------------------- to-do reminder plans
const toMinutes = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
function normRemind(r) {
  if (!r || typeof r !== 'object') return null;
  const out = {
    start: r.start === 'date' ? 'date' : 'before',
    days: Math.max(0, Math.min(366, parseInt(r.days, 10) || 0)),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(r.date || '')) ? String(r.date) : null,
    at: /^\d{2}:\d{2}$/.test(String(r.at || '')) ? String(r.at) : '09:00',
    every: Object.prototype.hasOwnProperty.call(REMIND_STEPS, r.every) ? r.every : 'once',
    afterDue: r.afterDue !== false,
  };
  if (out.start === 'date' && !out.date) return null;
  return out;
}
function readRemind(c) {
  const v = str(c.getFirstPropertyValue(REMIND_PROP)).trim();
  if (!v) return null;
  const o = {};
  for (const part of v.split(';')) { const i = part.indexOf('='); if (i > 0) o[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim(); }
  return normRemind({ start: o.start, days: o.days, date: o.date, at: o.at, every: o.every, afterDue: o.overdue !== '0' });
}
function writeRemind(c, r) {
  const parts = r.start === 'date' ? ['start=date', `date=${r.date}`] : ['start=before', `days=${r.days}`];
  parts.push(`at=${r.at}`, `every=${r.every}`, `overdue=${r.afterDue ? 1 : 0}`);
  c.updatePropertyWithValue(REMIND_PROP, parts.join(';'));
}
function remindFirst(r, dueKey) {
  const day = r.start === 'date' ? r.date : (dueKey ? addDaysKey(dueKey, -r.days) : null);
  if (!day) return null;
  const { y, m, d } = parseDay(day);
  const [h, mi] = r.at.split(':').map(Number);
  return { y, m, d, h, mi };
}
// the k-th reminder time (local wall clock); a month step keeps the day, or the month's last day
function remindAt(f, k, step) {
  if (!step) return k ? null : new Date(f.y, f.m - 1, f.d, f.h, f.mi).getTime();
  const [n, u] = step;
  if (u === 'd') return new Date(f.y, f.m - 1, f.d + k * n, f.h, f.mi).getTime();
  const mo = f.m - 1 + k * n;
  const last = new Date(f.y, mo + 1, 0).getDate();
  return new Date(f.y, mo, Math.min(f.d, last), f.h, f.mi).getTime();
}
// the standard VALARM beside a plan, for other apps: the first reminder as an absolute trigger, and for day and week
// steps a REPEAT/DURATION covering the time up to the due date (or 30 repeats when there's no end)
function writeRemindAlarm(c, r, dueKey, summary) {
  for (const a of c.getAllSubcomponents('valarm')) c.removeSubcomponent(a);
  const first = remindFirst(r, dueKey);
  if (!first) return;
  const step = REMIND_STEPS[r.every] || null;
  const at = remindAt(first, 0, step);
  const a = new ICAL.Component('valarm');
  const p = new ICAL.Property('trigger');
  p.resetType('date-time'); // writes TRIGGER;VALUE=DATE-TIME
  p.setValue(ICAL.Time.fromJSDate(new Date(at), true));
  a.addProperty(p);
  if (step && step[1] === 'd') {
    let n = 30;
    if (dueKey && !r.afterDue) {
      const { y, m, d } = parseDay(dueKey);
      n = Math.max(0, Math.floor((new Date(y, m - 1, d, 23, 59).getTime() - at) / (step[0] * DAY_MS)));
    }
    if (n > 0) { a.updatePropertyWithValue('repeat', Math.min(n, 365)); a.updatePropertyWithValue('duration', ICAL.Duration.fromSeconds(step[0] * 86400)); }
  }
  a.updatePropertyWithValue('action', 'DISPLAY');
  a.updatePropertyWithValue('description', (summary && String(summary).trim()) || 'To-do');
  c.addSubcomponent(a);
}
function writeAlarm(c, alarm, summary) {
  if (alarm && alarm.keep) return;
  const all = c.getAllSubcomponents('valarm');
  if (!alarm || alarm.minutes == null || !Number.isFinite(Number(alarm.minutes))) { for (const a of all) c.removeSubcomponent(a); return; }
  let a = all[0];
  if (!a) { a = new ICAL.Component('valarm'); c.addSubcomponent(a); }
  const old = a.getFirstProperty('trigger');
  if (old) a.removeProperty(old);
  a.addPropertyWithValue('trigger', ICAL.Duration.fromSeconds(-Math.round(Number(alarm.minutes)) * 60));
  a.updatePropertyWithValue('action', 'DISPLAY');
  a.updatePropertyWithValue('description', (summary && String(summary).trim()) || 'Reminder');
}
function collectZones(c, set) {
  for (const p of c.getAllProperties()) { const tz = p.getParameter('tzid'); if (tz) set.add(tz); }
  for (const s of c.getAllSubcomponents()) collectZones(s, set);
}

module.exports = { setPhrases, Store, DEFAULT_LIST, describeRecur, dayKey, timeKey, parseCalendars, expandAges, normRemind, remindFirst, remindAt, REMIND_STEPS };
