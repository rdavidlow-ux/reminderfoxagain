'use strict';
// The Alarms view: every alarm that is ringing, snoozed or still to ring in the next days, with what it is.
// Shared by the desktop main process (src/main.js) and the host core of the Thunderbird add-on (src/host/core.js),
// which keep the same alarm state: { dismissed: {key: when}, snoozed: {key: {until, alarm}}, quickAlarms: [] }.
// An alarm's key is "uid|occurrence start|alarm time" ("quick|id|time" for a quick alarm).
const HOUR = 3600000;
const DAY = 24 * HOUR;
const LIMIT = 500;

const alarmTime = (key) => Number(String(key).split('|')[2]);

// A dismissed alarm is forgotten a week after it was dismissed, unless it is still to come (skipped ahead of time).
function keepDismissed(key, when, at) {
  if (at - when <= 7 * DAY) return true;
  const t = alarmTime(key);
  return Number.isFinite(t) && t > at - 2 * DAY;
}

function rowOf(a, status, when) {
  return {
    key: a.key, uid: a.uid, kind: a.kind || 'event', summary: a.summary || '', start: a.start == null ? null : a.start, at: a.at,
    when, status, allDay: !!a.allDay, location: a.location || '', quick: !!a.quick, remind: !!a.remind, repeat: !!(a.repeating || a.repeat),
    important: !!a.important, list: a.list || '',
  };
}

// current: the alarms ringing now (the alarm window's list); quickRow(q): a quick alarm as an alarm row
function listAlarms({ store, state, current, quickRow, at, days }) {
  const span = Math.max(1, Math.min(366, Number(days) || 7));
  // calendar days, so a clock change on the way doesn't cut off the last day's alarm
  const end = new Date(at); end.setDate(end.getDate() + span);
  const until = end.getTime();
  const dismissed = state.dismissed || {};
  const out = [];
  const seen = new Set();
  const add = (a, status, when) => { if (!a || !a.key || seen.has(a.key)) return; seen.add(a.key); out.push(rowOf(a, status, when)); };
  for (const a of current || []) add(a, 'ringing', a.at);
  for (const [key, sn] of Object.entries(state.snoozed || {})) {
    if (sn && sn.until > at && sn.alarm && !dismissed[key]) add({ ...sn.alarm, key }, 'snoozed', sn.until);
  }
  let rows = [];
  try { rows = store.alarms(at + 1, until); } catch (e) { rows = []; }
  for (const q of state.quickAlarms || []) if (q.at > at && q.at < until) rows.push(quickRow(q));
  rows.sort((x, y) => x.at - y.at);
  for (const a of rows) add(a, dismissed[a.key] ? 'skipped' : 'upcoming', a.at);
  const rank = { ringing: 0, snoozed: 1, upcoming: 2, skipped: 2 };
  out.sort((x, y) => rank[x.status] - rank[y.status] || x.when - y.when);
  return { alarms: out.slice(0, LIMIT), more: out.length > LIMIT, days: span, until };
}

module.exports = { listAlarms, keepDismissed, alarmTime };
