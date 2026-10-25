#!/usr/bin/env node
// Writes realistic sample data for screenshots and UI tests.
//   node tools/sample-data.js <dataDir> [basic|bills]
// basic = a mix of reminders/to-dos around today (one alarm due 5 minutes from now)
// bills = monthly bill payments with past occurrences ticked off (for the All-view history)
'use strict';
const path = require('path');
const fs = require('fs');
const { Store } = require(path.join(__dirname, '..', 'src', 'core', 'store'));

const dir = process.argv[2];
const kind = process.argv[3] || 'basic';
if (!dir) { console.error('usage: node tools/sample-data.js <dataDir> [basic|bills]'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });

const pad = (n) => String(n).padStart(2, '0');
const k = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const t = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const now = new Date();
const add = (days) => { const d = new Date(now); d.setDate(d.getDate() + days); return k(d); };
const s = new Store('');

if (kind === 'basic') {
  const soon = new Date(now.getTime() + 5 * 60000);
  s.upsert({ kind: 'event', summary: "Thanksgiving dinner at Mom's", date: add(0), time: '17:30', endTime: '21:00', location: 'Oakville', alarm: { minutes: 120 }, categories: ['Family'] });
  s.upsert({ kind: 'event', summary: 'Call the pharmacy', date: k(soon), time: t(soon), alarm: { minutes: 10 }, important: true, notes: 'Prescription refill #4471' });
  s.upsert({ kind: 'event', summary: 'Thanksgiving (Canada)', date: '2020-10-12', allDay: true, repeat: { freq: 'YEARLY', mode: 'weekday', nth: 2, wd: 'MO', end: 'never' }, categories: ['Holiday'] });
  s.upsert({ kind: 'event', summary: 'Dentist — Dr. Patel', date: add(8), time: '14:30', endTime: '15:30', location: 'Yonge & Eglinton', alarm: { minutes: 60 }, categories: ['Health'] });
  s.upsert({ kind: 'event', summary: 'Recycling & green bin', date: '2026-01-01', allDay: true, repeat: { freq: 'WEEKLY', interval: 2, byday: ['TH'], end: 'never' }, alarm: { minutes: 180 }, categories: ['Home'] });
  s.upsert({ kind: 'event', summary: "Sarah's birthday", date: '1985-10-24', allDay: true, repeat: { freq: 'YEARLY', end: 'never' }, important: true, alarm: { minutes: 900 }, categories: ['Birthday'] });
  s.upsert({ kind: 'event', summary: 'Team stand-up', date: add(1), time: '09:30', endTime: '09:45', repeat: { freq: 'WEEKLY', byday: ['MO', 'TU', 'WE', 'TH', 'FR'], end: 'never' }, alarm: { minutes: 5 }, categories: ['Work'] });
  s.upsert({ kind: 'event', summary: 'Pay property tax instalment', date: add(17), allDay: true, important: true, alarm: { minutes: -540 }, categories: ['Bills'] });
  s.upsert({ kind: 'event', summary: 'Car service', date: add(-6), time: '08:00', categories: ['Car'] });
  s.upsert({ kind: 'event', summary: 'Book club', date: '2026-01-20', time: '19:00', repeat: { freq: 'MONTHLY', mode: 'weekday', nth: -1, wd: 'TU', end: 'never' }, location: 'Library' });
  s.upsert({ kind: 'event', summary: 'Cottage weekend', date: add(18), endDate: add(20), allDay: true, categories: ['Family'] });
  s.upsert({ kind: 'todo', summary: 'Buy milk and eggs', list: 'Errands' });
  s.upsert({ kind: 'todo', summary: 'Renew passport', date: add(-2), allDay: true, important: true });
  s.upsert({ kind: 'todo', summary: 'Water the plants', date: add(1), allDay: true, repeat: { freq: 'DAILY', interval: 3, end: 'never' } });
  s.upsert({ kind: 'todo', summary: 'Return library books', date: add(4), allDay: true, list: 'Errands' });
  const done = s.upsert({ kind: 'todo', summary: 'Book flu shot' }); s.setCompleted(done, true);
  s.upsert({ kind: 'todo', summary: 'Back up photos', categories: ['Home'] });
} else if (kind === 'bills') {
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const items = [
    ['Mortgage (auth payment)', 14, 'Bills'], ['Enbridge Gas', 28, 'Bills', true], ['RBC WestJet MC', 29, 'Credit card', true],
    ['Telus Cell Phone (auth payment)', 29, 'Bills'], ['Rogers Cell Phone (auth payment)', 4, 'Bills'], ['Toronto Hydro', 5, 'Bills', true],
    ['CIBC Costco MC', 12, 'Credit card', true], ['Netflix (auth payment)', 17, 'Subscriptions'],
  ];
  for (const [summary, day, cat, imp] of items) {
    const first = new Date(start.getFullYear(), start.getMonth(), day);
    const uid = s.upsert({ kind: 'event', summary, date: k(first), allDay: true, important: !!imp, categories: [cat],
      alarm: { minutes: 2340 }, repeat: { freq: 'MONTHLY', interval: 1, end: 'never' } });
    for (const o of s.occurrences(first, now, { includeTodos: false }).filter((x) => x.uid === uid)) s.setCompleted(uid, true, o.start);
  }
  // give each completion a believable time: 0-2 days after it was due, early afternoon UTC
  let text = s.toString().replace(/X-REMINDERFOX-DONE;X-COMPLETED-AT=\w+:(\d{8})/g, (m, d) => {
    const due = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)));
    const dd = +d.slice(6, 8);
    const at = new Date(Math.min(due.getTime() + (dd % 3) * 86400000, now.getTime() - 86400000)); // never in the future
    const stamp = `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}T${pad(13 + (dd % 5))}${pad((dd * 7) % 60)}00Z`;
    return `X-REMINDERFOX-DONE;X-COMPLETED-AT=${stamp}:${d}`;
  });
  s.load(text);
  s.upsert({ kind: 'event', summary: 'Dentist', date: add(8), time: '14:30' });
  // one-off reminders that have already passed, so the Past view has enough rows to scroll
  const past = ['Car service', 'Passport photos', 'Return library books', 'Parent-teacher night', 'Furnace filter',
    'Vet appointment', 'Pick up dry cleaning', 'Renew licence plate sticker', 'Book holiday flights', 'Haircut',
    'Call the insurance broker', 'Pay parking ticket', 'Hand in expense report', 'Drop off donations', 'Eye exam',
    'Change smoke alarm batteries', 'Order printer ink', 'Bank appointment'];
  past.forEach((summary, i) => s.upsert({ kind: 'event', summary, date: add(-3 - i * 6), time: `${9 + (i % 8)}:00` }));
}
fs.writeFileSync(path.join(dir, 'reminders.ics'), s.toString());
fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ settings: { trayHintShown: true } }, null, 2));
console.log(`wrote ${s.count()} items to ${path.join(dir, 'reminders.ics')}`);
