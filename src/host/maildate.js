'use strict';
// Finds the date (and time) an email is about, for "Add reminder…" on an email in the Thunderbird add-on.
// Plain functions, no Thunderbird or Node APIs, so it is unit-tested (test/maildate.test.js).
//
// findDate(text, { ref, now, locale }) → { date: 'YYYY-MM-DD', time: 'HH:MM' | null, text } | null
//   ref     the email's own date (ms): "tomorrow", "Friday" and dates without a year are read from it
//   now     today (ms): dates before today are passed over (a reminder is for something ahead)
//   locale  the date locale ('en-CA', 'de'…): its month and weekday names are understood besides English, and its
//           order of day and month decides what 3/11/2026 means
// Understood: 2026-11-03, 2026/11/03, 2026.11.03, 2026年11月3日 · November 3, 2026 · Nov 3 · Tuesday, Nov 3rd · 3 November 2026 · 3. November · 03/11/2026
// (in the locale's order) · today, tonight, tomorrow · on Friday, this Friday, next Friday — each optionally with a
// time next to it: at 2:30 pm, 2pm, 14:30, 9 a.m., noon. Quoted replies (> lines, "On … wrote:") are left out.

const EN_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const EN_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.$/, '');

// month and weekday names: English plus the locale's long and short forms, longest first so "sept" beats "sep"
function names(locale) {
  const months = new Map(); const days = new Map();
  EN_MONTHS.forEach((m, i) => { months.set(m, i); months.set(m.slice(0, 3), i); });
  months.set('sept', 8);
  EN_DAYS.forEach((d, i) => { days.set(d, i); days.set(d.slice(0, 3), i); });
  for (const loc of [...new Set([locale, String(locale || '').split('-')[0]].filter(Boolean))]) {
    try {
      for (const style of ['long', 'short']) {
        const fm = new Intl.DateTimeFormat(loc, { month: style });
        const fmd = new Intl.DateTimeFormat(loc, { month: style, day: 'numeric' });
        for (let i = 0; i < 12; i++) {
          months.set(fold(fm.format(new Date(2024, i, 15))), i);
          const part = fmd.formatToParts(new Date(2024, i, 15)).find((p) => p.type === 'month'); // genitive forms (ru, pl…)
          if (part) months.set(fold(part.value), i);
        }
        const fw = new Intl.DateTimeFormat(loc, { weekday: style });
        for (let i = 0; i < 7; i++) days.set(fold(fw.format(new Date(2024, 0, 7 + i))), i);
      }
    } catch (e) { /* English only */ }
  }
  for (const m of [...months.keys()]) if (m.length < 3 || /\d/.test(m)) months.delete(m);
  for (const d of [...days.keys()]) if (d.length < 2 || /\d/.test(d)) days.delete(d);
  const alt = (map) => [...map.keys()].sort((a, b) => b.length - a.length).map(esc).join('|');
  return { months, days, M: alt(months), W: alt(days) };
}
// is 3/11 the 3rd of November (day first) in this locale?
function dayFirst(locale) {
  try {
    const parts = new Intl.DateTimeFormat(locale || 'en-US').formatToParts(new Date(2026, 10, 23));
    return parts.findIndex((p) => p.type === 'day') < parts.findIndex((p) => p.type === 'month');
  } catch (e) { return false; }
}
function valid(y, m, d) {
  const t = new Date(y, m, d);
  return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d ? t : null;
}
const fullYear = (y) => (y < 100 ? 2000 + y : y);
// a date without a year: the first time it comes on or after the email's own day
function nextYearly(m, d, ref) {
  const r = new Date(ref); r.setHours(0, 0, 0, 0);
  for (let y = r.getFullYear(); y <= r.getFullYear() + 1; y++) { const t = valid(y, m, d); if (t && t >= r) return t; }
  return null;
}

// the time written next to a date (just after it, or just before it)
const TIME = String.raw`(?:at\s+|um\s+|à\s+|a las\s+|alle\s+|om\s+|@\s*)?(\d{1,2})(?:[:.h](\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?|uhr|h)?\b|\b(noon|midday|mittag)\b`;
// a "Time" label before a time: "Date: Nov 26, Time 11:40 AM", "Uhrzeit: 14:30"
const TIME_LABEL = String.raw`(?:start(?:ing)?\s+time|time|heure|uhrzeit|zeit|hora|ora|tijd|tid|klo|aika|godzina|czas|время|час|時間|时间)`;
function hm(m, lead) {
  if (m[4]) return '12:00';
  let h = Number(m[1]); const min = m[2] ? Number(m[2]) : 0; const ap = (m[3] || '').toLowerCase().replace(/[\s.]/g, '');
  // a bare number is a time only with a colon, am/pm, "Uhr"/"h" or a lead word ("at 3")
  if (!m[2] && !ap && !lead) return null;
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}
function timeNear(text, start, end) {
  const after = text.slice(end, end + 48);
  const before = text.slice(Math.max(0, start - 24), start);
  for (const [chunk, anchored] of [[after, true], [before, false]]) {
    const re = new RegExp(anchored ? `^[\\s,;|]*(?:[-–]\\s*)?(${TIME_LABEL}\\s*[:\\-]?\\s*)?(?:${TIME})` : `(?:${TIME})[\\s,]*(?:on\\s+|am\\s+|le\\s+|el\\s+)?$`, 'i');
    const m = re.exec(chunk);
    if (!m) continue;
    const g = anchored ? [m[0], m[2], m[3], m[4], m[5]] : m; // (the label is the first group after the date)
    const t = hm(g, (anchored && m[1]) || /^(at|um|à|a las|alle|om|@)/i.test(m[0].replace(/^[\s,;|–-]+/, '')));
    if (t) return t;
  }
  return null;
}
// a time with its own label anywhere in the text ("Time: 9:15 am" on the line under "Date: …")
function labelledTime(text) {
  const re = new RegExp(String.raw`(?:^|[\s,;|])${TIME_LABEL}\s*[:\-]?\s*(?:${TIME})`, 'i');
  const m = re.exec(text);
  return m ? hm(m, true) : null;
}

// the text worth reading: no quoted replies, no forwarded headers
function ownText(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (/^\s*-{2,}\s*(original message|forwarded message|ursprüngliche nachricht|message d'origine)/i.test(line)) break;
    if (/^\s*(on|am|le|el|il|op)\s.{6,120}\s(wrote|schrieb|a écrit|escribió|ha scritto|schreef)\s*:\s*$/i.test(line)) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out.join('\n');
}

function candidates(text, { ref, locale }) {
  const { months, days, M, W } = names(locale);
  const found = [];
  const add = (index, length, date, word) => { if (date) found.push({ index, length, date, word }); };
  const r0 = new Date(ref); r0.setHours(0, 0, 0, 0);
  let m;
  // year first is always year, month, day: 2026-11-03, 2026/11/03, 2026.11.03, and 2026年11月3日 (Chinese, Japanese)
  for (const re = /\b(\d{4})([-/.])(\d{1,2})\2(\d{1,2})\b/g; (m = re.exec(text));) add(m.index, m[0].length, valid(+m[1], +m[3] - 1, +m[4]));
  for (const re = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g; (m = re.exec(text));) add(m.index, m[0].length, valid(+m[1], +m[2] - 1, +m[3]));
  // (Tuesday,) November 3(rd)(, 2026)
  const mdy = new RegExp(String.raw`(?:\b(?:${W})\.?,?\s+)?\b(${M})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?`, 'gi');
  for (; (m = mdy.exec(text));) {
    const mo = months.get(fold(m[1])); const d = +m[2];
    add(m.index, m[0].length, m[3] ? valid(+m[3], mo, d) : nextYearly(mo, d, ref));
  }
  // (Tuesday,) 3(rd)( of) November( 2026) · 3. November 2026
  const dmy = new RegExp(String.raw`(?:\b(?:${W})\.?,?\s+)?\b(\d{1,2})(?:st|nd|rd|th|\.)?\s+(?:of\s+|de\s+)?(${M})\.?(?:,?\s+(?:de\s+)?(\d{4}))?\b`, 'gi');
  for (; (m = dmy.exec(text));) {
    const mo = months.get(fold(m[2])); const d = +m[1];
    add(m.index, m[0].length, m[3] ? valid(+m[3], mo, d) : nextYearly(mo, d, ref));
  }
  // 03/11/2026, 3.11.26 — in the locale's order
  const df = dayFirst(locale);
  for (const re = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4}|\d{2})\b/g; (m = re.exec(text));) {
    const a = +m[1]; const b = +m[2]; const y = fullYear(+m[3]);
    add(m.index, m[0].length, df ? valid(y, b - 1, a) : valid(y, a - 1, b));
  }
  // today, tonight, tomorrow (and a few other languages)
  for (const re = /\b(today|tonight|this evening|heute|aujourd'hui|hoy|oggi|vandaag|tomorrow|morgen|demain|mañana|domani)\b/gi; (m = re.exec(text));) {
    const w = m[1].toLowerCase();
    const plus = /^(tomorrow|morgen|demain|mañana|domani)$/.test(w) ? 1 : 0;
    add(m.index, m[0].length, new Date(r0.getFullYear(), r0.getMonth(), r0.getDate() + plus), true);
  }
  // on Friday, this Friday, next Friday: the next one after the email's day
  const wd = new RegExp(String.raw`\b(on|this|next|coming|am|nächsten|ce|le|el|este|questo)?\s*\b(${W})\b`, 'gi'); // \"Tuesday, Nov 3\" was found above at the same place, and comes first
  for (; (m = wd.exec(text));) {
    const lead = (m[1] || '').toLowerCase();
    if (!lead && !/^[A-ZÀ-Ý]/.test(m[2])) continue; // a bare lowercase "sun" or "wed" is likely just a word
    if (!lead && fold(m[2]).length <= 3) continue;
    const want = days.get(fold(m[2]));
    const dd = new Date(r0); let n = (want - dd.getDay() + 7) % 7; if (n === 0) n = 7;
    dd.setDate(dd.getDate() + n);
    add(m.index + (m[0].length - m[0].trimStart().length), m[0].trim().length, dd, 'weekday');
  }
  // a weekday that is part of a full date ("on Tuesday, Nov 3rd") gives way to that date
  const full = found.filter((c) => !c.word);
  const overlaps = (a, b) => a.index < b.index + b.length && b.index < a.index + a.length;
  return found.filter((c) => c.word !== 'weekday' || !full.some((f) => overlaps(c, f))).sort((a, b) => a.index - b.index);
}

function findDate(text, opts = {}) {
  const now = opts.now != null ? opts.now : Date.now();
  const ref = opts.ref != null ? opts.ref : now;
  const body = ownText(text);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const limit = new Date(today.getTime() + 3 * 366 * DAY);
  // the first date in the text that is today or later, and not years away
  for (const c of candidates(body, { ref, locale: opts.locale })) {
    if (c.date < today || c.date > limit) continue;
    return { date: key(c.date), time: timeNear(body, c.index, c.index + c.length) || labelledTime(body), text: body.substr(c.index, c.length).trim() };
  }
  return null;
}

// the reminder for an email: the subject as its description, the first date ahead in the subject, else in the text
// ------------------------------------------------------------ the place
// A labelled field ("Location:", "Where:", "Address:"… and the same in other languages) with an address on the next
// lines joined to it, else a street address on a line of its own: "123 Main St", "Hauptstraße 12", or a postcode.
const LOC_LABEL = /(?:^|[\s,;|])(?:location|where|place|venue|address|meeting place|lieu|adresse|ort|standort|treffpunkt|ubicaci[oó]n|lugar|direcci[oó]n|luogo|indirizzo|locatie|plaats|adres|plats|sted|paikka|osoite|miejsce|adres|место|адрес|місце|адреса|場所|住所|地点|地址|장소|주소)\s*:\s*/i;
const POSTCODE = /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b|\b[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}\b|\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b|\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+/;
const STREET = /^\s*\d{1,5}[A-Za-z]?,?\s+[^\s,].*?\b(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|cres|crescent|ct|court|pl|place|pkwy|parkway|hwy|highway|sq|square|terr|terrace|cir|circle|rue|calle|via|avenida)\b\.?|\b[A-ZÄÖÜ][\wäöüß-]*(?:straße|strasse|str\.|weg|platz|gasse|allee|straat|laan|gatan|vägen|gate|veien)\s+\d{1,4}[a-z]?\b/i;
const clean = (s) => s.replace(/\s+/g, ' ').replace(/^[\s,;:–-]+|[\s,;.–-]+$/g, '').trim();
function findLocation(text) {
  const lines = ownText(text).split('\n');
  const looksLikeAddress = (l) => STREET.test(l) || POSTCODE.test(l);
  // the address lines after line i (up to two, a blank line between allowed)
  const more = (i) => {
    const out = [];
    for (let j = i + 1, blanks = 0; j < lines.length && out.length < 2; j++) {
      const l = lines[j].trim();
      if (!l) { if (++blanks > 1) break; continue; }
      if (!looksLikeAddress(l) || LOC_LABEL.test(l)) break;
      out.push(clean(l)); blanks = 0;
    }
    return out;
  };
  for (let i = 0; i < lines.length; i++) {
    const m = LOC_LABEL.exec(lines[i]);
    if (!m) continue;
    // the value runs to the end of the line, or to the next field (" , " or "  " or "Phone:")
    let v = lines[i].slice(m.index + m[0].length).split(/\s+,\s+|\s{2,}|\t|\s\|\s|\s+(?=[A-Z][a-z]+(?:\s[A-Za-z]+)?\s*:\s)/)[0];
    v = clean(v);
    let first = i;
    if (!v) { // the label on its own line: the value is on the next one
      for (first = i + 1; first < lines.length && !lines[first].trim(); first++);
      v = clean(lines[first] || '');
    }
    if (!v) continue;
    return [v, ...more(first)].join(', ').slice(0, 200);
  }
  for (let i = 0; i < lines.length; i++) {
    if (!STREET.test(lines[i])) continue;
    return [clean(lines[i]), ...more(i)].join(', ').slice(0, 200);
  }
  return null;
}

function reminderFromEmail(mail, opts = {}) {
  const subject = String((mail && mail.subject) || '').replace(/^\s*((re|fwd?|aw|wg|tr|sv|vs|r|rif|odp|antw)\s*(\[\d+\])?\s*:\s*)+/i, '').trim();
  const o = { ...opts, ref: mail && mail.date ? Number(mail.date) : opts.ref };
  const hit = findDate(subject, o) || findDate(String((mail && mail.body) || '').slice(0, 20000), o);
  const location = findLocation(String((mail && mail.body) || '').slice(0, 20000));
  return { summary: subject, date: hit ? hit.date : null, time: hit ? hit.time : null, location, found: hit ? hit.text : null };
}

module.exports = { findDate, findLocation, reminderFromEmail };
