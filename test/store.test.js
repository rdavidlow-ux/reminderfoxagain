'use strict';
// Unit tests for the data layer. Run with: npm test  (any TZ; build.sh runs seven zones)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Store, DEFAULT_LIST, describeRecur, dayKey, timeKey, expandAges } = require('../src/core/store');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'reminderfox-addon-sample.ics'), 'utf8');
const D = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi);
const load = () => new Store(FIXTURE);
const rows = (s, uid, from, to) => s.occurrences(from, to).filter((r) => r.uid === uid);

test('1. field mapping from the add-on file and repeat summaries', () => {
  const s = load();
  assert.equal(s.count(), 6);
  const b = s.get('1234567890');
  assert.equal(b.kind, 'event');
  assert.equal(b.summary, "Mom's birthday");
  assert.equal(b.allDay, true);
  assert.equal(b.date, '1960-03-15');
  assert.equal(b.endDate, null);
  assert.deepEqual(b.categories, ['Birthday']);
  assert.equal(b.important, true);
  assert.deepEqual(b.alarm, { minutes: 1440 });
  assert.equal(b.repeat.freq, 'YEARLY');
  assert.equal(b.repeatText, 'Yearly on Mar 15');

  const d = s.get('2222');
  assert.equal(d.summary, 'Dentist, Dr. Smith');
  assert.equal(d.notes, 'Bring insurance card\nand forms');
  assert.equal(d.location, 'Main St');
  assert.equal(d.date, '2026-10-20');
  assert.equal(d.time, '14:30');
  assert.equal(d.endTime, '15:30');
  assert.equal(d.endDate, null);
  assert.deepEqual(d.alarm, { minutes: 15 });
  assert.equal(d.timezone, null);
  assert.equal(d.important, false);

  assert.equal(s.get('3333').repeatText, 'Every 2 weeks on Thu');
  assert.equal(s.get('4444').repeatText, 'Yearly on the 2nd Mon of Oct');
  assert.deepEqual(s.get('4444').repeat, { freq: 'YEARLY', interval: 1, end: 'never', mode: 'weekday', nth: 2, wd: 'MO' });

  const milk = s.get('5555');
  assert.equal(milk.kind, 'todo');
  assert.equal(milk.date, null);
  assert.equal(milk.list, DEFAULT_LIST);
  assert.equal(milk.completed, false);
  const pass = s.get('6666');
  assert.equal(pass.list, 'Errands');
  assert.equal(pass.completed, true);
  assert.equal(pass.date, '2026-11-01');
  assert.deepEqual(s.todoLists(), [DEFAULT_LIST, 'Errands']);
  assert.deepEqual(s.categories(), ['Birthday']);

  // plain-English summaries
  assert.equal(describeRecur({ freq: 'DAILY', interval: 1, end: 'never' }, '2026-10-14'), 'Daily');
  assert.equal(describeRecur({ freq: 'DAILY', interval: 3, end: 'never' }, '2026-10-14'), 'Every 3 days');
  assert.equal(describeRecur({ freq: 'WEEKLY', interval: 1, byday: ['TH', 'TU'], end: 'count', count: 8 }, '2026-10-14'), 'Weekly on Tue, Thu, 8 times');
  assert.equal(describeRecur({ freq: 'WEEKLY', interval: 2, byday: ['TH'], end: 'never' }, '2026-10-14'), 'Every 2 weeks on Thu');
  assert.equal(describeRecur({ freq: 'WEEKLY', interval: 1, byday: ['MO', 'TU', 'WE', 'TH', 'FR'], end: 'never' }, '2026-10-14'), 'Every weekday');
  assert.equal(describeRecur({ freq: 'MONTHLY', interval: 1, mode: 'date', end: 'never' }, '2026-10-14'), 'Monthly on day 14');
  assert.equal(describeRecur({ freq: 'MONTHLY', interval: 1, mode: 'weekday', nth: -1, wd: 'TU', end: 'never' }, '2026-10-27'), 'Monthly on the last Tue');
  assert.equal(describeRecur({ freq: 'YEARLY', interval: 1, mode: 'date', end: 'never' }, '1985-10-24'), 'Yearly on Oct 24');
  assert.equal(describeRecur({ freq: 'YEARLY', interval: 1, mode: 'weekday', nth: 2, wd: 'MO', end: 'never' }, '2020-10-12'), 'Yearly on the 2nd Mon of Oct');
  assert.equal(describeRecur({ freq: 'DAILY', interval: 1, end: 'until', until: '2026-12-31' }, '2026-10-14'), 'Daily, until 2026-12-31');
  assert.equal(describeRecur({ custom: true, rrule: 'FREQ=MONTHLY;BYSETPOS=-1;BYDAY=FR' }), 'Custom (monthly, bysetpos=-1, byday=fr)');

  // a custom rule is kept verbatim
  const c = new Store('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:c1\r\nSUMMARY:Last Friday\r\nDTSTART;VALUE=DATE:20261030\r\nRRULE:FREQ=MONTHLY;BYSETPOS=-1;BYDAY=FR\r\nEND:VEVENT\r\nEND:VCALENDAR');
  const dto = c.get('c1');
  assert.equal(dto.repeat.custom, true);
  assert.equal(dto.repeatText, 'Custom (monthly, bysetpos=-1, byday=fr)');
  c.upsert({ ...dto, summary: 'Last Friday!' });
  assert.match(c.toString(), /RRULE:FREQ=MONTHLY;BYSETPOS=-1;BYDAY=FR\r\n/);
});

test('2. Thanksgiving falls on Oct 12 2026 and Oct 11 2027', () => {
  const s = load();
  const r = rows(s, '4444', D(2026, 1, 1), D(2028, 1, 1));
  assert.deepEqual(r.map((x) => x.date), ['2026-10-12', '2027-10-11']);
  assert.equal(r[0].allDay, true);
  assert.equal(r[0].repeating, true);
});

test('3. completed-through semantics of the biweekly series', () => {
  const s = load();
  const r = rows(s, '3333', D(2026, 9, 1), D(2026, 11, 1));
  // every second Thursday from Jan 1; "completed through Oct 1" covers up to Sep 24
  assert.deepEqual(r.map((x) => x.date), ['2026-09-10', '2026-09-24', '2026-10-08', '2026-10-22']);
  assert.deepEqual(r.map((x) => x.completed), [true, true, false, false]);
  assert.equal(r[0].completedAt, null);
  assert.equal(s.get('3333').completedDate, '2026-10-01');
  // ticking Oct 22 alone does not move the through-date (Oct 8 is still open)
  s.setCompleted('3333', true, r[3].start);
  assert.match(s.toString(), /X-REMINDERFOX-COMPLETED:20260924/);
  assert.equal(rows(s, '3333', D(2026, 10, 22), D(2026, 10, 23))[0].completed, true);
  // ticking Oct 8 moves it to Oct 22
  s.setCompleted('3333', true, r[2].start);
  assert.match(s.toString(), /X-REMINDERFOX-COMPLETED:20261022/);
});

test('4. alarm timing: 15 minutes before, and one day before at midnight', () => {
  const s = load();
  const a = s.alarms(D(2026, 10, 20, 0, 0), D(2026, 10, 21, 0, 0)).filter((x) => x.uid === '2222');
  assert.equal(a.length, 1);
  assert.equal(a[0].at, D(2026, 10, 20, 14, 15).getTime());
  assert.equal(a[0].key, `2222|${D(2026, 10, 20, 14, 30).getTime()}|${a[0].at}`);
  const b = s.alarms(D(2027, 3, 13), D(2027, 3, 16)).filter((x) => x.uid === '1234567890');
  assert.equal(b.length, 1);
  assert.equal(b[0].at, D(2027, 3, 14).getTime());
  assert.equal(b[0].start, D(2027, 3, 15).getTime());
  assert.equal(b[0].summary, "Mom's birthday");
});

test('5. create/edit round trip: weekly Tue/Thu × 6, EXDATE, then monthly 2nd Tuesday all-day', () => {
  const s = new Store('');
  const uid = s.upsert({ kind: 'event', summary: 'Piano', date: '2026-10-13', time: '16:15', endTime: '17:00',
    repeat: { freq: 'WEEKLY', interval: 1, byday: ['TU', 'TH'], end: 'count', count: 6 }, alarm: { minutes: 30 }, categories: ['Kids', 'Music'] });
  assert.match(uid, /^[0-9a-f-]{36}@reminderfoxagain$/);
  let text = s.toString();
  assert.match(text, /RRULE:FREQ=WEEKLY;COUNT=6;BYDAY=TU,TH\r\n/);
  assert.match(text, /DTSTART:20261013T161500\r\n/);
  assert.match(text, /DTEND:20261013T170000\r\n/);
  assert.match(text, /TRIGGER:-PT30M\r\n/);
  assert.match(text, /CATEGORIES:Kids,Music\r\n/);
  assert.match(text, /PRODID:-\/\/ReminderFoxAgain\/\/ReminderFoxAgain 0\.6\/\/EN\r\n/);
  assert.ok(!/[^\r]\n/.test(text), 'CRLF line endings');
  let r = rows(s, uid, D(2026, 10, 1), D(2027, 1, 1));
  assert.deepEqual(r.map((x) => x.date), ['2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22', '2026-10-27', '2026-10-29']);
  assert.equal(s.get(uid).repeatText, 'Weekly on Tue, Thu, 6 times');

  // reload from text, delete one occurrence
  const s2 = new Store(text);
  assert.equal(s2.remove(uid, r[2].start), 'occurrence');
  text = s2.toString();
  assert.match(text, /EXDATE:20261020T161500\r\n/);
  r = rows(s2, uid, D(2026, 10, 1), D(2027, 1, 1));
  assert.deepEqual(r.map((x) => x.date), ['2026-10-13', '2026-10-15', '2026-10-22', '2026-10-27', '2026-10-29']);
  const seq1 = Number(/SEQUENCE:(\d+)/.exec(text)[1]);

  // switch to monthly on the 2nd Tuesday, all day
  const dto = s2.get(uid);
  dto.allDay = true; dto.time = null; dto.endTime = null;
  dto.repeat = { freq: 'MONTHLY', interval: 1, mode: 'weekday', nth: 2, wd: 'TU', end: 'never' };
  dto.alarm = { minutes: -540 };
  s2.upsert(dto);
  text = s2.toString();
  assert.match(text, /DTSTART;VALUE=DATE:20261013\r\n/);
  assert.match(text, /DTEND;VALUE=DATE:20261014\r\n/);
  assert.match(text, /RRULE:FREQ=MONTHLY;BYDAY=2TU\r\n/);
  assert.match(text, /TRIGGER:PT9H\r\n/);
  assert.ok(!/EXDATE/.test(text), 'old timed EXDATE is dropped when the start changes');
  assert.equal(Number(/SEQUENCE:(\d+)/.exec(text)[1]), seq1 + 1);
  const back = new Store(text).get(uid);
  assert.equal(back.repeatText, 'Monthly on the 2nd Tue');
  assert.deepEqual(back.alarm, { minutes: -540 });
  assert.deepEqual(rows(new Store(text), uid, D(2026, 10, 1), D(2027, 1, 1)).map((x) => x.date), ['2026-10-13', '2026-11-10', '2026-12-08']);

  // no repeat clears EXDATE/RDATE
  const s3 = new Store(text);
  s3.remove(uid, D(2026, 11, 10).getTime());
  assert.match(s3.toString(), /EXDATE;VALUE=DATE:20261110\r\n/);
  s3.upsert({ ...s3.get(uid), repeat: null });
  assert.ok(!/EXDATE|RRULE/.test(s3.toString()));
  // removing the whole item
  assert.equal(s3.remove(uid), true);
  assert.equal(s3.count(), 0);
});

test('6. an all-day multi-day event writes an exclusive DTEND', () => {
  const s = new Store('');
  const uid = s.upsert({ kind: 'event', summary: 'Cottage', date: '2026-11-01', endDate: '2026-11-03', allDay: true });
  assert.match(s.toString(), /DTEND;VALUE=DATE:20261104\r\n/);
  const dto = new Store(s.toString()).get(uid);
  assert.equal(dto.endDate, '2026-11-03');
  assert.deepEqual(rows(s, uid, D(2026, 10, 1), D(2026, 12, 1)).length, 1);
  // overlaps every covered day
  assert.equal(s.occurrences(D(2026, 11, 3), D(2026, 11, 4)).length, 1);
  assert.equal(s.occurrences(D(2026, 11, 4), D(2026, 11, 5)).length, 0);
  // single all-day: end defaults to the start day
  const u2 = s.upsert({ kind: 'event', summary: 'One day', date: '2026-11-07', allDay: true });
  assert.equal(s.get(u2).endDate, null);
  assert.match(s.export({ uids: [u2] }), /DTEND;VALUE=DATE:20261108\r\n/);
  // a timed end before the start is dropped
  const u3 = s.upsert({ kind: 'event', summary: 'Bad end', date: '2026-11-07', time: '10:00', endTime: '09:00' });
  assert.ok(!/DTEND/.test(s.export({ uids: [u3] })));
});

test('7. ticking a repeating to-do advances it', () => {
  const s = new Store('');
  const uid = s.upsert({ kind: 'todo', summary: 'Water the plants', date: '2026-10-15', allDay: true, repeat: { freq: 'DAILY', interval: 3, end: 'count', count: 3 } });
  assert.equal(s.setCompleted(uid, true), 'advanced');
  let dto = s.get(uid);
  assert.equal(dto.date, '2026-10-18');
  assert.equal(dto.completed, false);
  assert.equal(dto.repeat.count, 2);
  assert.equal(s.setCompleted(uid, true), 'advanced');
  assert.equal(s.get(uid).date, '2026-10-21');
  // end of the series → done
  assert.equal(s.setCompleted(uid, true), true);
  dto = s.get(uid);
  assert.equal(dto.completed, true);
  assert.match(s.toString(), /STATUS:COMPLETED\r\n/);
  assert.match(s.toString(), /PERCENT-COMPLETE:100\r\n/);
  assert.match(s.toString(), /COMPLETED:\d{8}T\d{6}Z\r\n/);
  // un-tick a plain to-do
  s.setCompleted(uid, false);
  assert.equal(s.get(uid).completed, false);
  assert.ok(!/STATUS:COMPLETED/.test(s.toString()));
  // timed repeating to-do keeps its time
  const u2 = s.upsert({ kind: 'todo', summary: 'Pill', date: '2026-10-15', time: '08:00', repeat: { freq: 'WEEKLY', interval: 1, byday: ['TH'], end: 'never' } });
  s.setCompleted(u2, true);
  assert.equal(s.get(u2).date, '2026-10-22');
  assert.equal(s.get(u2).time, '08:00');
});

test('8. import merge counts and export filtering', () => {
  const s = load();
  const again = s.import(FIXTURE);
  assert.deepEqual(again, { added: 0, updated: 0, skipped: 6 });
  // edit one in-app: newer LAST-MODIFIED wins over the old file
  s.upsert({ ...s.get('2222'), summary: 'Dentist (moved)' });
  assert.deepEqual(s.import(FIXTURE), { added: 0, updated: 0, skipped: 6 });
  assert.equal(s.get('2222').summary, 'Dentist (moved)');
  // a newer incoming version replaces, a new UID is added
  const newer = FIXTURE.replace('SUMMARY:Buy milk', 'SUMMARY:Buy oat milk\r\nLAST-MODIFIED:20300101T000000Z')
    .replace('END:VCALENDAR', 'BEGIN:VTODO\r\nUID:7777\r\nSUMMARY:New one\r\nEND:VTODO\r\nEND:VCALENDAR');
  assert.deepEqual(s.import(newer), { added: 1, updated: 1, skipped: 5 });
  assert.equal(s.get('5555').summary, 'Buy oat milk');
  assert.equal(s.count(), 7);
  const ev = s.export({ kinds: ['event'] });
  assert.equal((ev.match(/BEGIN:VEVENT/g) || []).length, 4);
  assert.ok(!/BEGIN:VTODO/.test(ev));
  const td = s.export({ kinds: ['todo'] });
  assert.equal((td.match(/BEGIN:VTODO/g) || []).length, 3);
  const one = s.export({ uids: ['4444'] });
  assert.equal((one.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.equal(new Store(s.export()).count(), 7);
});

const LONDON = [
  'BEGIN:VCALENDAR', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN', 'VERSION:2.0', 'CALSCALE:GREGORIAN',
  'BEGIN:VTIMEZONE', 'TZID:Europe/London', 'X-LIC-LOCATION:Europe/London',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0000', 'TZOFFSETTO:+0100', 'TZNAME:BST', 'DTSTART:19700329T010000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0000', 'TZNAME:GMT', 'DTSTART:19701025T020000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
  'BEGIN:VEVENT', 'DTSTART;TZID=Europe/London:20261020T090000', 'DTEND;TZID=Europe/London:20261020T100000', 'UID:g1@google.com',
  'SUMMARY:London call', 'X-GOOGLE-CONFERENCE:https://meet.example/abc', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART;TZID=Europe/London:20261102T090000', 'RRULE:FREQ=WEEKLY;COUNT=2', 'UID:g2@google.com', 'SUMMARY:Winter call', 'END:VEVENT',
  'END:VCALENDAR', ''].join('\r\n');

test('9. a Google-style Europe/London zoned event lands on the right UTC instant', () => {
  const s = new Store('');
  assert.deepEqual(s.import(LONDON), { added: 2, updated: 0, skipped: 0 });
  const r = rows(s, 'g1@google.com', new Date(Date.UTC(2026, 9, 18)), new Date(Date.UTC(2026, 9, 23)));
  assert.equal(r.length, 1);
  assert.equal(r[0].start, Date.UTC(2026, 9, 20, 8, 0)); // BST = UTC+1
  assert.equal(r[0].end, Date.UTC(2026, 9, 20, 9, 0));
  const w = rows(s, 'g2@google.com', new Date(Date.UTC(2026, 9, 28)), new Date(Date.UTC(2026, 10, 20)));
  assert.deepEqual(w.map((x) => x.start), [Date.UTC(2026, 10, 2, 9, 0), Date.UTC(2026, 10, 9, 9, 0)]); // GMT
  const dto = s.get('g1@google.com');
  assert.equal(dto.timezone, 'Europe/London');
  assert.equal(dto.time, timeKey(Date.UTC(2026, 9, 20, 8, 0)));
  assert.equal(dto.date, dayKey(Date.UTC(2026, 9, 20, 8, 0)));
  const ex = s.export({ uids: ['g1@google.com'] });
  assert.match(ex, /BEGIN:VTIMEZONE\r\nTZID:Europe\/London/);
  // survives a save/reload
  const s2 = new Store(s.toString());
  assert.equal(rows(s2, 'g1@google.com', new Date(Date.UTC(2026, 9, 18)), new Date(Date.UTC(2026, 9, 23)))[0].start, Date.UTC(2026, 9, 20, 8, 0));
  // saving stores it as floating local time, same instant
  s2.upsert(s2.get('g1@google.com'));
  assert.equal(s2.get('g1@google.com').timezone, null);
  assert.equal(rows(s2, 'g1@google.com', new Date(Date.UTC(2026, 9, 18)), new Date(Date.UTC(2026, 9, 23)))[0].start, Date.UTC(2026, 9, 20, 8, 0));
});

test('10. unknown properties survive an edit', () => {
  const s = new Store(LONDON);
  const s1 = load();
  s1.upsert({ ...s1.get('1234567890'), summary: "Mom's 66th" });
  const t = s1.toString();
  assert.match(t, /X-REMINDERFOX-REMIND-UNTIL-COMPLETED:1\r\n/);
  assert.match(t, /X-WR-CALNAME:ReminderFox\r\n/);
  assert.match(t, /SUMMARY:Mom's 66th\r\n/);
  assert.ok(!/X-REMINDERFOX-CATEGORIES/.test(t));
  assert.ok(!/X-REMINDERFOX-PRIORITY/.test(t));
  assert.match(t, /PRIORITY:1\r\n/);
  s.upsert({ ...s.get('g1@google.com'), notes: 'agenda' });
  assert.match(s.toString(), /X-GOOGLE-CONFERENCE:https:\/\/meet\.example\/abc\r\n/);
  // later VALARMs are kept when the first one is edited
  const m = new Store('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nDTSTART:20261020T100000\r\nBEGIN:VALARM\r\nTRIGGER:-PT5M\r\nACTION:DISPLAY\r\nX-FOO:1\r\nEND:VALARM\r\nBEGIN:VALARM\r\nTRIGGER;RELATED=END:PT0M\r\nACTION:AUDIO\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR');
  m.upsert({ ...m.get('a'), alarm: { minutes: 60 } });
  const mt = m.toString();
  assert.match(mt, /TRIGGER:-PT1H\r\n/);
  assert.match(mt, /X-FOO:1\r\n/);
  assert.match(mt, /TRIGGER;RELATED=END:PT0M\r\n/);
  assert.equal(m.alarms(D(2026, 10, 20), D(2026, 10, 21)).length, 2);
});

test('11. nextOccurrences', () => {
  const s = load();
  const n = s.nextOccurrences(D(2026, 10, 14));
  const by = Object.fromEntries(n.map((r) => [r.uid, r]));
  assert.equal(by['1234567890'].date, '2027-03-15');
  assert.equal(by['2222'].date, '2026-10-20');
  assert.equal(by['3333'].date, '2026-10-22');
  assert.equal(by['4444'].date, '2027-10-11');
  assert.equal(by['5555'].start, null);
  assert.equal(by['6666'].date, '2026-11-01');
  // a past one-off is returned flagged past
  const p = s.nextOccurrences(D(2026, 10, 21));
  assert.equal(p.find((r) => r.uid === '2222').past, true);
  // an all-day item today is still upcoming
  assert.equal(s.nextOccurrences(D(2026, 10, 12, 0, 0)).find((r) => r.uid === '4444').date, '2026-10-12');
});

test('12. a clear error for non-calendar text', () => {
  assert.throws(() => new Store('hello, this is not a calendar'), { message: 'This file does not contain any iCalendar data (no BEGIN:VCALENDAR).' });
  assert.throws(() => new Store('').import('{"json": true}'), /no BEGIN:VCALENDAR/);
  // tolerant parsing: BOM, LF endings, junk before, blank lines, two calendars
  const messy = '﻿junk line\nBEGIN:VCALENDAR\nVERSION:2.0\n\nBEGIN:VEVENT\nUID:x1\nSUMMARY:One\nDTSTART:20261020T100000\nEND:VEVENT\nEND:VCALENDAR\nBEGIN:VCALENDAR\nBEGIN:VTODO\nUID:x2\nSUMMARY:Two\nEND:VTODO\nEND:VCALENDAR\n';
  const s = new Store(messy);
  assert.equal(s.count(), 2);
  assert.equal(s.get('x2').summary, 'Two');
  assert.equal(new Store('').count(), 0);
});

test('13. completed history with times survives save/reload; un-tick and re-tick one month', () => {
  const s = new Store('');
  const uid = s.upsert({ kind: 'event', summary: 'Hydro', date: '2026-01-05', allDay: true, repeat: { freq: 'MONTHLY', interval: 1, mode: 'date', end: 'never' } });
  const occ = rows(s, uid, D(2026, 1, 1), D(2026, 7, 1));
  assert.equal(occ.length, 6);
  for (const o of occ) s.setCompleted(uid, true, o.start);
  let text = s.toString();
  assert.match(text, /X-REMINDERFOX-COMPLETED:20260605\r\n/);
  assert.equal((text.match(/X-REMINDERFOX-DONE;X-COMPLETED-AT=\d{8}T\d{6}Z:2026\d{4}/g) || []).length, 6);
  let s2 = new Store(text);
  let h = s2.completedHistory(D(2026, 10, 1)).filter((r) => r.uid === uid);
  assert.equal(h.length, 6);
  assert.ok(h.every((r) => r.completed && typeof r.completedAt === 'number' && r.past && r.history));
  assert.ok(s2.get(uid).doneLog['2026-03-05'] > 0);
  // un-tick March only
  s2.setCompleted(uid, false, occ[2].start);
  text = s2.toString();
  assert.match(text, /X-REMINDERFOX-COMPLETED:20260205\r\n/);
  s2 = new Store(text);
  h = s2.completedHistory(D(2026, 10, 1)).filter((r) => r.uid === uid);
  assert.deepEqual(h.map((r) => r.completed), [true, true, false, true, true, true]);
  // missed months stay visible up to the latest done one
  assert.equal(h[2].completedAt, null);
  // tick again: through-date is restored
  s2.setCompleted(uid, true, occ[2].start);
  assert.match(s2.toString(), /X-REMINDERFOX-COMPLETED:20260605\r\n/);
  assert.ok(s2.completedHistory(D(2026, 10, 1)).filter((r) => r.uid === uid).every((r) => r.completed));
  // a one-off reminder is simply done / not done
  const one = s2.upsert({ kind: 'event', summary: 'Once', date: '2026-10-20', time: '10:00' });
  s2.setCompleted(one, true);
  assert.equal(s2.get(one).completed, true);
  assert.equal(s2.alarms(D(2026, 10, 1), D(2026, 11, 1)).filter((x) => x.uid === one).length, 0);
  s2.setCompleted(one, false);
  assert.equal(s2.get(one).completed, false);
});

test('14. un-ticking one occurrence of an imported through-date series keeps the others', () => {
  const s = new Store('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:w\r\nSUMMARY:Weekly\r\nDTSTART;VALUE=DATE:20260105\r\nRRULE:FREQ=WEEKLY\r\nX-REMINDERFOX-COMPLETED:20260518\r\nEND:VEVENT\r\nEND:VCALENDAR');
  let r = rows(s, 'w', D(2026, 1, 1), D(2026, 5, 19));
  assert.equal(r.length, 20);
  assert.ok(r.every((x) => x.completed));
  s.setCompleted('w', false, r[9].start);
  const s2 = new Store(s.toString());
  r = rows(s2, 'w', D(2026, 1, 1), D(2026, 5, 19));
  assert.equal(r.filter((x) => x.completed).length, 19);
  assert.equal(r[9].completed, false);
  assert.match(s2.toString(), /X-REMINDERFOX-COMPLETED:20260302\r\n/);
});

test('15. imported history has completedAt === null', () => {
  const s = load();
  const h = s.completedHistory(D(2026, 10, 14)).filter((r) => r.uid === '3333');
  assert.equal(h.length, 20); // Jan 1 .. Sep 24, every two weeks
  assert.ok(h.every((r) => r.completed === true && r.completedAt === null));
  assert.equal(s.get('3333').completedDate, '2026-10-01');
});

// ---------------------------------------------------------------- add-on compatibility (0.2.5)
const at = (y, m, d, h = 12, mi = 0) => () => new Date(y, m - 1, d, h, mi).getTime();
const ics = (body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body.join('\r\n')}\r\nEND:VCALENDAR\r\n`;

test('16. ages in titles: <1960> becomes an ordinal, <1960#> a number, per occurrence year', () => {
  assert.equal(expandAges("Mom's <1960> birthday", 2026), "Mom's 66th birthday");
  assert.equal(expandAges("Married <1990#> years", 2026), 'Married 36 years');
  assert.equal(expandAges('<2025> <2015> <2014> <2013> <2005> <1915> <1914>', 2026), '1st 11th 12th 13th 21st 111th 112th');
  assert.equal(expandAges('Launch <2030>', 2026), 'Launch 4th');
  assert.equal(expandAges('Not a year <12> or <abcd>', 2026), 'Not a year <12> or <abcd>');
  const s = new Store('');
  s.clock = at(2026, 10, 17);
  const uid = s.upsert({ kind: 'event', summary: "Sarah's <1985> birthday", date: '1985-10-24', allDay: true, repeat: { freq: 'YEARLY', end: 'never' } });
  const r = rows(s, uid, D(2026, 1, 1), D(2028, 1, 1));
  assert.deepEqual(r.map((x) => x.summary), ["Sarah's 41st birthday", "Sarah's 42nd birthday"]);
  assert.equal(s.get(uid).summary, "Sarah's <1985> birthday"); // the editor sees the raw title
  assert.equal(s.get(uid).display, "Sarah's 41st birthday");
  assert.match(s.toString(), /SUMMARY:Sarah's <1985> birthday\r\n/);
  // the add-on file's birthday has no variable; a title with one also shows up in alarms
  s.upsert({ ...s.get(uid), alarm: { minutes: 0 } });
  assert.equal(s.alarms(D(2026, 10, 23), D(2026, 10, 25))[0].summary, "Sarah's 41st birthday");
});

test('17. remind daily until completed is read from and written back to the add-on file', () => {
  const s = load();
  assert.equal(s.get('1234567890').untilDone, true);
  assert.equal(s.get('2222').untilDone, false);
  s.upsert({ ...s.get('1234567890'), summary: "Mom's birthday!" });
  assert.match(s.toString(), /X-REMINDERFOX-REMIND-UNTIL-COMPLETED:[12]\r\n/);
  s.upsert({ ...s.get('1234567890'), untilDone: false });
  assert.ok(!/REMIND-UNTIL-COMPLETED/.test(s.toString()));
  s.upsert({ ...s.get('2222'), untilDone: true });
  assert.equal(new Store(s.toString()).get('2222').untilDone, true);
  // a to-do never carries the flag
  s.upsert({ ...s.get('2222'), kind: 'todo' });
  assert.ok(!/REMIND-UNTIL-COMPLETED/.test(s.toString()));
});

test('18. a missed flagged reminder moves to today and alarms daily until it is ticked', () => {
  const s = new Store('');
  s.clock = at(2026, 10, 10, 8, 0);
  const uid = s.upsert({ kind: 'event', summary: 'Call the bank', date: '2026-10-10', time: '09:00', untilDone: true, alarm: { minutes: 15 } });
  assert.match(s.toString(), /X-REMINDERFOX-REMIND-UNTIL-COMPLETED:1\r\n/);
  // a week later it has not been ticked
  s.clock = at(2026, 10, 17, 7, 0);
  const today = s.occurrences(D(2026, 10, 17), D(2026, 10, 18));
  assert.equal(today.length, 1);
  assert.equal(today[0].carried, true);
  assert.equal(today[0].start, D(2026, 10, 17, 9, 0).getTime());
  assert.equal(today[0].occStart, D(2026, 10, 10, 9, 0).getTime());
  assert.equal(today[0].overdueSince, '2026-10-10');
  // it moved: the month shows it once, on today
  const month = s.occurrences(D(2026, 10, 1), D(2026, 11, 1)).filter((r) => r.uid === uid);
  assert.deepEqual(month.map((r) => r.date), ['2026-10-17']);
  // the original day on its own still shows the original occurrence
  assert.equal(s.occurrences(D(2026, 10, 10), D(2026, 10, 11))[0].carried, undefined);
  const next = s.nextOccurrences(D(2026, 10, 17)).find((r) => r.uid === uid);
  assert.equal(next.carried, true);
  assert.ok(!next.past);
  // daily alarm, a new one each day
  const a1 = s.alarms(D(2026, 10, 17), D(2026, 10, 18));
  assert.equal(a1.length, 1);
  assert.equal(a1[0].at, D(2026, 10, 17, 8, 45).getTime());
  s.clock = at(2026, 10, 18, 7, 0);
  const a2 = s.alarms(D(2026, 10, 18), D(2026, 10, 19));
  assert.equal(a2[0].at, D(2026, 10, 18, 8, 45).getTime());
  assert.notEqual(a2[0].key, a1[0].key);
  // the stored flag turns to 2 while carried, so the add-on reads the file the same way
  assert.equal(s.syncUntilDone(), true);
  assert.match(s.toString(), /X-REMINDERFOX-REMIND-UNTIL-COMPLETED:2\r\n/);
  assert.equal(s.syncUntilDone(), false);
  // ticking the missed occurrence stops it
  s.setCompleted(uid, true, a2[0].occStart);
  assert.equal(s.occurrences(D(2026, 10, 18), D(2026, 10, 19)).length, 0);
  assert.equal(s.alarms(D(2026, 10, 18), D(2026, 10, 19)).length, 0);
  assert.match(s.toString(), /X-REMINDERFOX-REMIND-UNTIL-COMPLETED:1\r\n/);
  // without the flag a missed reminder simply stays in the past
  const u2 = s.upsert({ kind: 'event', summary: 'Plain', date: '2026-10-12', time: '10:00' });
  assert.equal(s.nextOccurrences(D(2026, 10, 18)).find((r) => r.uid === u2).past, true);
});

test('19. repeating flagged reminders, the 90-day look-back and occurrences still in progress', () => {
  const s = new Store('');
  s.clock = at(2026, 8, 1);
  const uid = s.upsert({ kind: 'event', summary: 'Hydro bill', date: '2026-08-05', allDay: true, untilDone: true, repeat: { freq: 'MONTHLY', mode: 'date', end: 'never' } });
  s.clock = at(2026, 8, 6); s.setCompleted(uid, true, D(2026, 8, 5).getTime());
  s.clock = at(2026, 9, 6); s.setCompleted(uid, true, D(2026, 9, 5).getTime());
  s.clock = at(2026, 10, 17);
  // October 5 was missed: it is carried to today
  let n = s.nextOccurrences(D(2026, 10, 17)).find((r) => r.uid === uid);
  assert.equal(n.carried, true);
  assert.equal(n.overdueSince, '2026-10-05');
  s.setCompleted(uid, true, n.occStart);
  n = s.nextOccurrences(D(2026, 10, 17)).find((r) => r.uid === uid);
  assert.equal(n.carried, undefined);
  assert.equal(n.date, '2026-11-05');
  // a flag of 1 only picks up an occurrence missed in the last 90 days (like the add-on) ...
  const old = new Store(ics(['BEGIN:VEVENT', 'UID:o1', 'SUMMARY:Old', 'DTSTART;VALUE=DATE:20260601', 'X-REMINDERFOX-REMIND-UNTIL-COMPLETED:1', 'END:VEVENT']));
  old.clock = at(2026, 10, 17);
  assert.equal(old.nextOccurrences(D(2026, 10, 17))[0].carried, undefined);
  // ... but a flag of 2 (already carried by the add-on) keeps carrying
  const two = new Store(ics(['BEGIN:VEVENT', 'UID:o2', 'SUMMARY:Old', 'DTSTART;VALUE=DATE:20260601', 'X-REMINDERFOX-REMIND-UNTIL-COMPLETED:2', 'END:VEVENT']));
  two.clock = at(2026, 10, 17);
  assert.equal(two.nextOccurrences(D(2026, 10, 17))[0].carried, true);
  // turning the flag on for an already-missed reminder carries it straight away (as the add-on did)
  const u3 = old.upsert({ ...old.get('o1'), untilDone: false });
  old.upsert({ ...old.get(u3), untilDone: true });
  assert.match(old.toString(), /X-REMINDERFOX-REMIND-UNTIL-COMPLETED:2\r\n/);
  assert.equal(old.nextOccurrences(D(2026, 10, 17))[0].carried, true);
  // turning the flag on for a repeating reminder starts with its next occurrence (an earlier miss is not carried)
  const u5 = s.upsert({ kind: 'event', summary: 'Gas bill', date: '2026-09-28', allDay: true, repeat: { freq: 'MONTHLY', mode: 'date', end: 'never' } });
  s.upsert({ ...s.get(u5), untilDone: true });
  assert.match(s.export({ uids: [u5] }), /X-REMINDERFOX-REMIND-UNTIL-COMPLETED:1\r\n/);
  assert.equal(s.nextOccurrences(D(2026, 10, 17)).find((r) => r.uid === u5).date, '2026-10-28');
  // ... and a later miss is carried
  s.clock = at(2026, 10, 30);
  assert.equal(s.nextOccurrences(D(2026, 10, 30)).find((r) => r.uid === u5).carried, true);
  s.clock = at(2026, 10, 17);
  // a multi-day event still in progress is not missed
  const u4 = s.upsert({ kind: 'event', summary: 'Cottage', date: '2026-10-16', endDate: '2026-10-18', allDay: true, untilDone: true });
  assert.equal(s.nextOccurrences(D(2026, 10, 17)).find((r) => r.uid === u4).carried, undefined);
});

test('20. "show in tooltip" to-dos: read, written and listed like the add-on', () => {
  const s = new Store(ics([
    'BEGIN:VTODO', 'UID:t1', 'SUMMARY:Buy milk', 'X-REMINDERFOX-SHOW-IN-TOOLTIP:1', 'END:VTODO',
    'BEGIN:VTODO', 'UID:t2', 'SUMMARY:Passport', 'DTSTART;VALUE=DATE:20261025', 'X-REMINDERFOX-SHOW-IN-TOOLTIP:1', 'END:VTODO',
    'BEGIN:VTODO', 'UID:t3', 'SUMMARY:Far away', 'DTSTART;VALUE=DATE:20261120', 'X-REMINDERFOX-SHOW-IN-TOOLTIP:1', 'END:VTODO',
    'BEGIN:VTODO', 'UID:t4', 'SUMMARY:Done one', 'STATUS:COMPLETED', 'X-REMINDERFOX-SHOW-IN-TOOLTIP:1', 'END:VTODO',
    'BEGIN:VTODO', 'UID:t5', 'SUMMARY:Not flagged', 'END:VTODO']));
  s.clock = at(2026, 10, 17);
  assert.equal(s.get('t1').showInTooltip, true);
  assert.equal(s.get('t5').showInTooltip, false);
  assert.deepEqual(s.tooltipTodos().map((d) => d.uid), ['t2', 't1']); // due within 15 days first, then undated
  s.upsert({ ...s.get('t5'), showInTooltip: true });
  s.upsert({ ...s.get('t1'), showInTooltip: false });
  const text = s.toString();
  assert.equal((text.match(/X-REMINDERFOX-SHOW-IN-TOOLTIP:1/g) || []).length, 4);
  assert.deepEqual(new Store(text).tooltipTodos(D(2026, 10, 17)).map((d) => d.uid), ['t2', 't5']);
});

// ---------------------------------------------------------------- archive (0.2.6)
test('21. extract and insert move an item whole between calendars, with its zone and unknown data', () => {
  const main = new Store(LONDON);
  const arch = new Store('');
  arch.clock = at(2026, 10, 18);
  const before = main.export({ uids: ['g1@google.com'] });
  const data = main.extract('g1@google.com');
  assert.equal(main.get('g1@google.com'), null);
  assert.equal(main.count(), 1);
  arch.insert(data, { archived: true, reason: 'No longer valid' });
  const dto = arch.get('g1@google.com');
  assert.equal(dto.archivedAt, D(2026, 10, 18, 12).getTime());
  assert.equal(dto.archiveReason, 'No longer valid');
  const text = arch.toString();
  assert.match(text, /X-GOOGLE-CONFERENCE:https:\/\/meet\.example\/abc\r\n/);
  assert.match(text, /BEGIN:VTIMEZONE\r\nTZID:Europe\/London/);
  assert.match(text, /X-REMINDERFOXAGAIN-ARCHIVE-REASON:No longer valid\r\n/);
  // and back again, without the archive marks: identical to before
  const back = new Store(text).extract('g1@google.com');
  main.insert(back, { archived: false });
  assert.equal(main.export({ uids: ['g1@google.com'] }), before);
  assert.equal(main.get('g1@google.com').archivedAt, null);
  // a repeating item keeps its exceptions and completion history
  const s = new Store('');
  const u = s.upsert({ kind: 'event', summary: 'Weekly', date: '2026-01-05', allDay: true, repeat: { freq: 'WEEKLY', interval: 1, byday: ['MO'], end: 'never' } });
  s.setCompleted(u, true, D(2026, 1, 5).getTime());
  s.remove(u, D(2026, 1, 12).getTime());
  const a2 = new Store('');
  a2.insert(s.extract(u), { archived: true });
  const t2 = a2.toString();
  assert.match(t2, /EXDATE;VALUE=DATE:20260112\r\n/);
  assert.match(t2, /X-REMINDERFOX-COMPLETED:20260105\r\n/);
  assert.equal(s.count(), 0);
});

test('22. finishedBefore finds ended one-offs, ended series and completed to-dos', () => {
  const s = new Store('');
  s.clock = at(2026, 10, 18);
  const past = s.upsert({ kind: 'event', summary: 'Car service', date: '2026-09-01', time: '09:00' });
  s.upsert({ kind: 'event', summary: 'Dentist', date: '2026-11-01', time: '09:00' });
  const ended = s.upsert({ kind: 'event', summary: 'Course', date: '2026-01-05', time: '18:00', repeat: { freq: 'WEEKLY', interval: 1, byday: ['MO'], end: 'count', count: 4 } });
  s.upsert({ kind: 'event', summary: 'Forever', date: '2020-01-01', allDay: true, repeat: { freq: 'YEARLY', end: 'never' } });
  s.clock = at(2026, 10, 1);
  const done = s.upsert({ kind: 'todo', summary: 'Book flu shot' }); s.setCompleted(done, true);
  s.clock = at(2026, 10, 18);
  s.upsert({ kind: 'todo', summary: 'Open to-do' });
  const flagged = s.upsert({ kind: 'event', summary: 'Flagged, not done', date: '2026-10-10', time: '09:00', untilDone: true });
  assert.ok(flagged);
  const found = s.finishedBefore(D(2026, 10, 18));
  assert.deepEqual(found.map((x) => x.uid).sort(), [past, ended, done].sort());
  assert.equal(found.find((x) => x.uid === ended).reason, 'Series ended');
  // an earlier cut-off leaves out what finished after it (the to-do was completed on Oct 1)
  assert.deepEqual(s.finishedBefore(D(2026, 9, 1)).map((x) => x.uid), [ended]);
});

// ---------------------------------------------------------------- 0.3.0
test('23. several upcoming occurrences of repeating items, and a one-year horizon for "all"', () => {
  const s = new Store('');
  s.clock = at(2026, 10, 18);
  const w = s.upsert({ kind: 'event', summary: 'Weekly', date: '2026-10-19', time: '09:00', repeat: { freq: 'WEEKLY', interval: 1, byday: ['MO'], end: 'never' } });
  const one = s.upsert({ kind: 'event', summary: 'Once', date: '2026-10-20', time: '09:00' });
  assert.equal(s.nextOccurrences(D(2026, 10, 18)).filter((r) => r.uid === w).length, 1);
  assert.deepEqual(s.nextOccurrences(D(2026, 10, 18), { count: 3 }).filter((r) => r.uid === w).map((r) => r.date), ['2026-10-19', '2026-10-26', '2026-11-02']);
  assert.equal(s.nextOccurrences(D(2026, 10, 18), { count: 3 }).filter((r) => r.uid === one).length, 1);
  const all = s.nextOccurrences(D(2026, 10, 18), { count: Infinity }).filter((r) => r.uid === w);
  assert.ok(all.length >= 52 && all.length <= 54, `a year of Mondays, got ${all.length}`);
});

test('24. move to list, rename lists and categories, manual order', () => {
  const s = new Store(FIXTURE);
  // a reminder moved to a list becomes a to-do there
  s.moveToList('2222', 'Errands');
  assert.equal(s.get('2222').kind, 'todo');
  assert.equal(s.get('2222').list, 'Errands');
  assert.equal(s.get('2222').notes, 'Bring insurance card\nand forms');
  assert.deepEqual(s.listCounts(), { "To-Do's": 1, Errands: 2 });
  assert.equal(s.renameList('Errands', 'Shopping'), 2);
  assert.deepEqual(s.todoLists(), ["To-Do's", 'Shopping']);
  assert.equal(s.renameList('Shopping', "To-Do's"), 2);
  assert.ok(!/X-REMINDERFOX-LISTID/.test(s.toString()));
  // categories
  s.upsert({ ...s.get('3333'), categories: ['Home', 'Birthday'] });
  assert.deepEqual(s.categoryCounts(), { Birthday: 2, Home: 1 });
  assert.equal(s.renameCategory('Birthday', 'Family'), 2);
  assert.deepEqual(s.categories(), ['Family', 'Home']);
  assert.equal(s.renameCategory('Home', 'Family'), 1); // merge
  assert.deepEqual(s.get('3333').categories, ['Family']);
  assert.equal(s.renameCategory('Family', ''), 2); // remove
  assert.deepEqual(s.categories(), []);
  assert.ok(!/CATEGORIES/.test(s.toString()));
  // manual order (X-APPLE-SORT-ORDER)
  s.setOrder(['6666', '5555', '2222']);
  assert.deepEqual(['5555', '6666', '2222'].map((u) => s.get(u).order), [2, 1, 3]);
  assert.match(s.toString(), /X-APPLE-SORT-ORDER:1\r\n/);
  assert.equal(new Store(s.toString()).get('2222').order, 3);
});

test('25. past occurrences of a repeating reminder, ticked or not', () => {
  const s = new Store('');
  s.clock = () => D(2026, 10, 18, 1, 0);
  const uid = s.upsert({ kind: 'event', summary: 'Netflix (auth payment)', date: '2024-09-17', allDay: true, time: null,
    repeat: { freq: 'MONTHLY', interval: 1, mode: 'date', end: 'never' }, alarm: null, categories: [] });
  const t0 = D(2026, 10, 18);
  // before: only up to the last ticked occurrence, so a never-ticked series showed nothing in All and Past
  assert.equal(s.completedHistory(t0).length, 0);
  // now: every past occurrence, from the start of the series
  let h = s.completedHistory(t0, { since: null });
  assert.equal(h.length, 26); // 2024-09-17 … 2026-10-17
  assert.equal(h[0].date, '2024-09-17');
  assert.equal(h.at(-1).date, '2026-10-17');
  assert.ok(h.every((r) => r.uid === uid && r.past && !r.completed));
  // ticked and unticked ones together
  s.setCompleted(uid, true, D(2025, 3, 17).getTime());
  h = s.completedHistory(t0, { since: null });
  assert.deepEqual(h.filter((r) => r.completed).map((r) => r.date), ['2025-03-17']);
  // a limit keeps the recent ones, ticked or not, and older ones only if ticked
  h = s.completedHistory(t0, { since: t0.getTime() - 90 * 864e5 });
  assert.deepEqual(h.map((r) => r.date), ['2025-03-17', '2026-08-17', '2026-09-17', '2026-10-17']);
  // without since, the old rule: everything up to the last tick
  assert.equal(s.completedHistory(t0).length, 7);
  // a one-off in the past is still reported by nextOccurrences, marked past
  const one = s.upsert({ kind: 'event', summary: 'Car service', date: '2026-10-12', time: '08:00', allDay: false, repeat: null, alarm: null, categories: [] });
  assert.ok(s.nextOccurrences(t0).some((r) => r.uid === one && r.past));
});

test('26. projecting repeats ahead: nextOccurrences with until', () => {
  const s = new Store('');
  s.clock = () => D(2026, 10, 24, 11, 0);
  const wk = s.upsert({ kind: 'event', summary: 'Stand-up', date: '2026-10-26', time: '09:30', allDay: false,
    repeat: { freq: 'WEEKLY', byday: ['MO', 'TU', 'WE', 'TH', 'FR'], end: 'never' }, alarm: null, categories: [] });
  const yr = s.upsert({ kind: 'event', summary: 'Anniversary', date: '2020-06-01', allDay: true, time: null,
    repeat: { freq: 'YEARLY', end: 'never' }, alarm: null, categories: [] });
  const one = s.upsert({ kind: 'event', summary: 'Dentist', date: '2026-11-02', time: '14:30', allDay: false, repeat: null, alarm: null, categories: [] });
  const t0 = D(2026, 10, 24);
  const of = (rows, uid) => rows.filter((r) => r.uid === uid);
  // default: one row per item
  assert.equal(of(s.nextOccurrences(t0), wk).length, 1);
  // every date in the next 3 months (to Jan 24): weekdays Oct 26 … Jan 22
  const three = s.nextOccurrences(t0, { count: Infinity, until: D(2027, 1, 24) });
  assert.equal(of(three, wk).length, 65);
  assert.equal(of(three, wk)[0].date, '2026-10-26');
  assert.equal(of(three, wk).at(-1).date, '2027-01-22');
  // the next occurrence is kept even beyond the horizon; one-offs once
  assert.deepEqual(of(three, yr).map((r) => r.date), ['2027-06-01']);
  assert.equal(of(three, one).length, 1);
  // the same dates as occurrences() over that span
  assert.equal(of(three, wk).length, s.occurrences(t0, D(2027, 1, 24)).filter((r) => r.uid === wk).length);
  // a count still limits
  assert.equal(of(s.nextOccurrences(t0, { count: 3, until: D(2027, 1, 24) }), wk).length, 3);
});

test('27. to-do reminder plans: due-by date, start, frequency, after the due date, conversion', () => {
  const s = new Store('');
  s.clock = () => D(2026, 10, 24, 8, 0);
  // due by Nov 30; remind from 7 days before at 9:00, every day, stop at the due date
  const uid = s.upsert({ kind: 'todo', summary: 'File the expense report', date: '2026-11-30', allDay: true, time: null, categories: [],
    remind: { start: 'before', days: 7, at: '09:00', every: 'day', afterDue: false } });
  const d = s.get(uid);
  assert.deepEqual(d.remind, { start: 'before', days: 7, date: null, at: '09:00', every: 'day', afterDue: false });
  assert.equal(d.alarm, null);
  const fires = (from, to) => s.alarms(from, to).filter((a) => a.uid === uid).map((a) => `${dayKey(a.at)} ${timeKey(a.at)}`);
  assert.deepEqual(fires(D(2026, 11, 22), D(2026, 11, 23, 10)), ['2026-11-23 09:00']); // the first one
  assert.deepEqual(fires(D(2026, 11, 24), D(2026, 11, 25)), ['2026-11-24 09:00']); // daily
  assert.deepEqual(fires(D(2026, 11, 29), D(2026, 12, 3)), ['2026-11-30 09:00']); // the last one is on the due date
  assert.deepEqual(fires(D(2026, 12, 1), D(2026, 12, 3)), []); // stops after the due date
  // only the latest one in a window (a PC that was off for two days shows one card, not three)
  assert.equal(fires(D(2026, 11, 23), D(2026, 11, 26)).length, 1);
  // each reminder has its own key, so dismissing one doesn't stop the next
  const k1 = s.alarms(D(2026, 11, 24), D(2026, 11, 25)).find((a) => a.uid === uid).key;
  const k2 = s.alarms(D(2026, 11, 25), D(2026, 11, 26)).find((a) => a.uid === uid).key;
  assert.notEqual(k1, k2);
  // keep reminding after the due date
  s.upsert({ ...s.get(uid), remind: { ...s.get(uid).remind, afterDue: true } });
  assert.deepEqual(fires(D(2026, 12, 2), D(2026, 12, 3)), ['2026-12-02 09:00']);
  // done: no more reminders
  s.setCompleted(uid, true);
  assert.deepEqual(fires(D(2026, 12, 2), D(2026, 12, 3)), []);
  s.setCompleted(uid, false);
  // weekly and monthly; a month step keeps the day or uses the month's last day
  s.upsert({ ...s.get(uid), remind: { start: 'date', date: '2026-10-31', at: '18:30', every: 'month', afterDue: true } });
  assert.deepEqual(fires(D(2026, 11, 1), D(2026, 12, 1)), ['2026-11-30 18:30']);
  assert.deepEqual(fires(D(2027, 2, 1), D(2027, 3, 1)), ['2027-02-28 18:30']);
  s.upsert({ ...s.get(uid), remind: { start: 'before', days: 14, at: '07:45', every: 'week', afterDue: false } });
  assert.deepEqual(fires(D(2026, 11, 16), D(2026, 11, 17)), ['2026-11-16 07:45']);
  assert.deepEqual(fires(D(2026, 11, 17), D(2026, 11, 23)), []);
  assert.deepEqual(fires(D(2026, 11, 23), D(2026, 11, 24)), ['2026-11-23 07:45']);
  // an undated to-do: "starting on a date", every 2 days
  const nd = s.upsert({ kind: 'todo', summary: 'Call the plumber', date: null, categories: [], remind: { start: 'date', date: '2026-10-25', at: '10:00', every: '2days' } });
  assert.deepEqual(s.alarms(D(2026, 10, 27), D(2026, 10, 28)).filter((a) => a.uid === nd).map((a) => dayKey(a.at)), ['2026-10-27']);
  assert.deepEqual(s.alarms(D(2026, 10, 28), D(2026, 10, 29)).filter((a) => a.uid === nd).length, 0);
  // "before the due date" without a due date becomes "from today"
  const nd2 = s.upsert({ kind: 'todo', summary: 'Undated', date: null, categories: [], remind: { start: 'before', days: 3, at: '09:00', every: 'once' } });
  assert.deepEqual(s.get(nd2).remind.start + ' ' + s.get(nd2).remind.date, 'date 2026-10-24');
  // other apps get a standard alarm: an absolute first trigger, repeated daily up to the due date
  const plain = new Store(s.toString());
  const v = plain.root.getAllSubcomponents('vtodo').find((c) => c.getFirstPropertyValue('summary') === 'File the expense report').getFirstSubcomponent('valarm');
  assert.equal(v.getFirstProperty('trigger').type, 'date-time');
  assert.equal(String(v.getFirstPropertyValue('repeat')), '2'); // weekly from Nov 16: + Nov 23, Nov 30 = up to the due date
  assert.equal((s.toString().match(/VALUE=DATE-TIME/g) || []).length >= 1 && !/VALUE=DATE-TIME;VALUE=DATE-TIME/.test(s.toString()), true);
  // the plan survives a save and reload
  assert.deepEqual(new Store(s.toString()).get(uid).remind, s.get(uid).remind);
  // once the date is known it becomes a reminder: the plan goes, the alarm is an ordinary one
  s.upsert({ ...s.get(uid), kind: 'event', date: '2026-11-27', time: '14:00', allDay: false, alarm: { minutes: 30 }, remind: null, list: null });
  const ev = s.get(uid);
  assert.equal(ev.kind, 'event');
  assert.equal(`${ev.date} ${ev.time} ${ev.alarm.minutes} ${ev.remind}`, '2026-11-27 14:00 30 null');
  assert.ok(!s.toString().split('BEGIN:VEVENT')[1].includes('X-REMINDERFOXAGAIN-REMIND'));
  assert.deepEqual(s.alarms(D(2026, 11, 27, 13), D(2026, 11, 27, 14)).filter((a) => a.uid === uid).map((a) => timeKey(a.at)), ['13:30']);
  // "once, N days before" is saved the add-on's way: an ordinary relative alarm, no plan property
  const once = s.upsert({ kind: 'todo', summary: 'Once', date: '2026-11-10', allDay: true, time: null, categories: [],
    remind: { start: 'before', days: 7, at: '09:00', every: 'once' } });
  const onceText = s.toString().split('SUMMARY:Once')[1].split('END:VTODO')[0];
  assert.ok(/TRIGGER:-P6DT15H/.test(onceText), onceText);
  assert.ok(!onceText.includes('X-REMINDERFOXAGAIN-REMIND'));
  assert.deepEqual(s.get(once).alarm, { minutes: 7 * 1440 - 540 });
  assert.deepEqual(s.alarms(D(2026, 11, 3), D(2026, 11, 4)).filter((x) => x.uid === once).map((x) => `${dayKey(x.at)} ${timeKey(x.at)}`), ['2026-11-03 09:00']);
  // an old-style to-do alarm (from the add-on) still works as before
  const old = s.upsert({ kind: 'todo', summary: 'Old style', date: '2026-11-10', allDay: true, time: null, categories: [], alarm: { minutes: -540 } });
  assert.equal(s.get(old).remind, null);
  assert.deepEqual(s.alarms(D(2026, 11, 10), D(2026, 11, 11)).filter((a) => a.uid === old).map((a) => timeKey(a.at)), ['09:00']);
});

test('28. a fuller add-on file: everything loads, survives a save, and an unchanged edit keeps it in add-on form', () => {
  const text = fs.readFileSync(path.join(__dirname, 'reminderfox-addon-full.ics'), 'utf8');
  const s = new Store(text);
  s.clock = () => D(2026, 10, 24, 13);
  assert.equal(s.count(), 9);
  const once = s.toString();
  assert.equal(new Store(once).toString(), once); // stable
  for (const kept of ['X-REMINDERFOX-MESSAGEID:<abc123@mail.example.com>', 'X-SOME-OTHER-APP:keep me', 'X-REMINDERFOX-REMIND-UNTIL-COMPLETED:1',
    'X-REMINDERFOX-LISTID:Errands', 'RECURRENCE-ID;TZID=America/Toronto:20240115T093000', 'TRIGGER;RELATED=END:-PT2H', 'BEGIN:VTIMEZONE']) assert.ok(once.includes(kept), kept);
  // saving every item unchanged writes no ReminderFoxAgain-only properties
  for (const d of s.list()) s.upsert({ ...d });
  assert.ok(!/X-REMINDERFOXAGAIN/.test(s.toString()));
  assert.deepEqual(s.get('rf-2001').alarm, { minutes: 10080 });
  assert.equal(s.get('rf-2001').remind, null);
});

test('29. duplicate, copy to another list and move between lists keep the whole item', () => {
  const text = fs.readFileSync(path.join(__dirname, 'reminderfox-addon-full.ics'), 'utf8');
  const s = new Store(text);
  s.clock = () => D(2026, 10, 24, 13);
  const before = s.count();
  // a repeating reminder with an exception, a skipped date, an alarm and a ticked occurrence
  const dup = s.duplicate('rf-1002', { suffix: ' (copy)' });
  assert.notEqual(dup, 'rf-1002');
  assert.equal(s.count(), before + 1);
  const a = s.get('rf-1002'); const b = s.get(dup);
  assert.equal(b.summary, 'Staff meeting (copy)');
  for (const k of ['kind', 'date', 'time', 'endTime', 'location', 'notes', 'url', 'important', 'repeatText']) assert.deepEqual(b[k], a[k], k);
  assert.deepEqual(b.alarm, a.alarm);
  const occ = (uid) => s.occurrences(D(2024, 1, 1), D(2024, 1, 31)).filter((r) => r.uid === uid).map((r) => `${dayKey(r.start)} ${timeKey(r.start)} ${r.summary}`);
  assert.deepEqual(occ(dup), occ('rf-1002').map((x) => x.replace('Staff meeting', 'Staff meeting (copy)').replace('(copy) (moved)', '(moved)')));
  const starts = (uid) => s.occurrences(D(2024, 1, 1), D(2024, 1, 31)).filter((r) => r.uid === uid).map((r) => r.start);
  assert.ok(s.occurrences(D(2024, 1, 1), D(2024, 1, 31)).some((r) => r.uid === dup && r.summary === 'Staff meeting (moved)' && r.start === Date.UTC(2024, 0, 15, 16)), 'the moved occurrence comes along');
  assert.ok(!starts(dup).includes(Date.UTC(2024, 0, 10, 14, 30)), 'the skipped date stays skipped');
  assert.deepEqual(starts(dup), starts('rf-1002'));
  const comp = (uid, kind = 'VEVENT') => s.toString().split(`UID:${uid}`).slice(1).map((x) => x.split(`END:${kind}`)[0]).join('\n');
  assert.ok(comp('rf-1002').includes('X-REMINDERFOX-DONE'));
  assert.ok(!comp(dup).includes('X-REMINDERFOX-DONE'), 'the copy starts not done');
  assert.ok(s.occurrences(D(2024, 1, 1), D(2024, 1, 31)).filter((r) => r.uid === dup).every((r) => !r.completed));
  // unknown properties come along; the original is untouched
  const club = s.duplicate('rf-1004');
  assert.ok(s.toString().split(`UID:${club}`)[1].split('END:VEVENT')[0].includes('X-SOME-OTHER-APP:keep me'));
  assert.equal(s.get(club).summary, 'Book club');
  // copy a to-do to another list: the original stays where it was
  const cp = s.duplicate('rf-2001', { list: 'Home' });
  assert.equal(s.get('rf-2001').list, 'Errands');
  assert.equal(s.get(cp).list, 'Home');
  assert.equal(s.get(cp).summary, 'Renew passport');
  assert.deepEqual(s.get(cp).alarm, s.get('rf-2001').alarm);
  // a completed to-do's copy is open again; copied to the main list it carries no list id
  const flu = s.duplicate('rf-2004', { list: DEFAULT_LIST });
  assert.equal(s.get('rf-2004').completed, true);
  assert.equal(s.get(flu).completed, false);
  assert.ok(!s.toString().split(`UID:${flu}`)[1].split('END:VTODO')[0].includes('LISTID'));
  // a reminder copied to a list becomes a to-do there; the reminder stays
  const tax = s.duplicate('rf-1003', { list: 'Errands' });
  assert.equal(s.get(tax).kind, 'todo');
  assert.equal(s.get(tax).list, 'Errands');
  assert.equal(s.get('rf-1003').kind, 'event');
  // My order: a duplicate goes right after its original
  s.setOrder(['rf-2002', 'rf-2003', flu]);
  const d2 = s.duplicate('rf-2002');
  const order = s.list().filter((d) => d.kind === 'todo' && d.list === DEFAULT_LIST && d.order != null).sort((x, y) => x.order - y.order).map((d) => d.uid);
  assert.deepEqual(order.slice(0, 3), ['rf-2002', d2, 'rf-2003']);
  // moving a to-do between lists changes only its list (and drops its place in the old list's order)
  const mv = s.moveToList('rf-2002', 'Home');
  assert.equal(mv, 'rf-2002');
  assert.equal(s.get('rf-2002').list, 'Home');
  assert.equal(s.get('rf-2002').order, null);
  assert.equal(s.get('rf-2002').repeatText, s.get(d2).repeatText);
  // removing a list with its items
  assert.equal(s.removeListItems('Home'), 3);
  assert.equal(s.list().some((d) => d.list === 'Home'), false);
  // the file still reads back the same
  const out = s.toString();
  assert.equal(new Store(out).toString(), out);
});

test('30. import options: duplicates by title and date, a category for imported items, and a preview', () => {
  const s = load();
  const have = s.upsert({ kind: 'event', summary: 'Book Club', date: '2026-11-12', allDay: true, categories: [] });
  const file = new Store('');
  file.upsert({ kind: 'event', summary: '  book   club ', date: '2026-11-12', allDay: true, categories: [] }); // same title and date
  file.upsert({ kind: 'event', summary: 'Book club', date: '2026-11-19', allDay: true, categories: [] }); // another date
  file.upsert({ kind: 'todo', summary: 'Pack for the trip', date: null, categories: ['Travel'] });
  file.upsert({ kind: 'todo', summary: 'Pack for the trip', date: null, categories: [] }); // a duplicate inside the file
  const text = file.toString();
  assert.deepEqual(s.previewImport(text), { events: 2, todos: 2, existing: 0, duplicates: 1 });
  const before = s.count();
  const r = s.import(text, { duplicates: 'skip', category: 'Imported' });
  assert.deepEqual(r, { added: 2, updated: 0, skipped: 0, duplicates: 2 });
  assert.equal(s.count(), before + 2);
  assert.deepEqual(s.list().find((d) => d.summary === 'Book club').categories, ['Imported']);
  assert.deepEqual(s.list().find((d) => d.summary === 'Pack for the trip').categories, ['Travel', 'Imported']);
  assert.deepEqual(s.get(have).categories, [], 'items already here are not touched');
  // importing them anyway brings the duplicates in too; a category already there isn't added twice
  const s2 = load(); s2.upsert({ kind: 'event', summary: 'Book Club', date: '2026-11-12', allDay: true, categories: [] });
  const r2 = s2.import(text, { duplicates: 'import', category: 'travel' });
  assert.deepEqual(r2, { added: 4, updated: 0, skipped: 0 });
  assert.deepEqual(s2.list().find((d) => d.summary === 'Pack for the trip' && d.categories.length === 1).categories, ['Travel']);
  // without options it behaves as before (merge by UID, nothing skipped as a duplicate)
  const s3 = load(); assert.deepEqual(s3.import(FIXTURE), { added: 0, updated: 0, skipped: 6 });
});

test('31. dates written the way other programs do are read, not fatal (0.9.1)', () => {
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//x//y//EN',
    'BEGIN:VEVENT', 'UID:js1', 'SUMMARY:JavaScript dates', 'DTSTAMP:Tue Oct 20 2026 10:00:00 GMT-0400 (Eastern Daylight Time)',
    'LAST-MODIFIED:Tue, 20 Oct 2026 14:00:00 GMT', 'DTSTART:Tue Nov 10 2026 09:30:00 GMT-0500', 'DTEND:Tue Nov 10 2026 10:30:00 GMT-0500',
    'RRULE:FREQ=WEEKLY;UNTIL=Tue Dec 01 2026 14:30:00 GMT+0000;BYDAY=TU', 'EXDATE:Tue Nov 17 2026 09:30:00 GMT-0500', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:iso1', 'SUMMARY:ISO day', 'DTSTART;VALUE=DATE:2026-12-25', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:bad1', 'SUMMARY:Unreadable stamp', 'DTSTART;VALUE=DATE:20261224', 'CREATED:Tue someday', 'END:VEVENT',
    'END:VCALENDAR', ''].join('\r\n');
  const s = new Store('');
  assert.deepEqual(s.previewImport(ics), { events: 3, todos: 0, existing: 0, duplicates: 0 });
  assert.equal(s.import(ics).added, 3);
  const starts = rows(s, 'js1', D(2026, 11, 1), D(2027, 1, 1)).map((r) => new Date(r.start).toISOString());
  assert.deepEqual(starts, ['2026-11-10T14:30:00.000Z', '2026-11-24T14:30:00.000Z', '2026-12-01T14:30:00.000Z']);
  assert.equal(s.get('iso1').allDay, true);
  assert.equal(dayKey(new Date(rows(s, 'iso1', D(2026, 12, 1), D(2027, 1, 1))[0].start)), '2026-12-25');
  assert.equal(rows(s, 'bad1', D(2026, 12, 1), D(2027, 1, 1)).length, 1);
  assert.equal(new Store(s.toString()).count(), 3);   // and the saved file reads back
});
