'use strict';
// Unit tests for the host core (src/host/core.js), the platform-neutral host the Thunderbird add-on runs.
// An in-memory adapter stands in for Thunderbird: files in a Map, a clock the test moves, timers it fires.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createHost } = require('../src/host/core');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'reminderfox-addon-sample.ics'), 'utf8');
const PREFS = fs.readFileSync(path.join(__dirname, 'reminderfox-addon-prefs.js'), 'utf8');
const LOCALES = path.join(__dirname, '..', 'src', 'ui', 'locales');

function fakeThunderbird(files = new Map(), start = new Date(2026, 9, 20, 9, 0).getTime()) {
  const log = { emits: [], notes: [], windows: [], badge: null, tooltip: '', menu: [], lang: null, urls: [] };
  let clock = start;
  let timers = [];
  let tid = 0;
  const ad = {
    platform: 'thunderbird', os: 'linux', version: 'test', dataLabel: 'your Thunderbird profile',
    files: {
      read: async (n) => (files.has(n) ? files.get(n).text : null),
      write: async (n, text) => { files.set(n, { text, mtime: clock }); },
      remove: async (n) => { files.delete(n); },
      list: async () => [...files].map(([name, f]) => ({ name, size: f.text.length, mtime: f.mtime })),
    },
    emit: (ch, payload, target) => log.emits.push({ ch, payload, target }),
    windows: {
      showMain: async () => { log.windows.push('main'); },
      alarm: { show: () => log.windows.push('alarm:show'), raise: () => log.windows.push('alarm:raise'), close: () => log.windows.push('alarm:close'), hide: () => log.windows.push('alarm:hide') },
      slider: { show: (c) => log.windows.push(`slider:${c}`), close: () => log.windows.push('slider:close') },
    },
    notify: (title, body) => log.notes.push({ title, body }),
    badge: (n) => { log.badge = n; },
    tooltip: (t) => { log.tooltip = t; },
    menu: (items) => { log.menu = items; },
    openUrl: (u) => log.urls.push(u),
    openEmail: async (mid) => { if (mid === '<gone@example.com>') throw new Error('not found'); log.opened = mid; },
    systemLocale: () => 'en-CA',
    loadDict: async (lang) => JSON.parse(fs.readFileSync(path.join(LOCALES, `${lang}.json`), 'utf8')),
    languageChanged: (info) => { log.lang = info; },
    now: () => clock,
    setTimeout: (fn, ms) => { timers.push({ id: ++tid, fn, at: clock + ms }); return tid; },
    clearTimeout: (id) => { timers = timers.filter((t) => t.id !== id); },
    setInterval: () => 0,
    clearInterval: () => {},
  };
  // calendar subscriptions: the web as a Map of address → text (or an Error to throw)
  log.web = new Map();
  ad.fetchText = async (url) => { log.fetched = (log.fetched || []).concat(url); const v = log.web.get(url); if (v instanceof Error) throw v; if (v == null) throw new Error('The calendar could not be fetched.'); return v; };
  const host = createHost(ad);
  const call = (ch, ...args) => host.call(ch, args);
  // move the clock and run the timers that came due (in order)
  async function advance(ms) {
    clock += ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= clock).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers = timers.filter((t) => t !== due);
      await due.fn();
    }
    await host.flush();
  }
  return { host, call, log, files, advance, now: () => clock };
}

test('host 1. starts empty, saves to reminders.ics, and a new start reads it back', async () => {
  const tb = fakeThunderbird();
  await tb.host.start();
  const m0 = await tb.call('data:meta');
  assert.equal(m0.count, 0);
  assert.equal(m0.platform, 'thunderbird');
  assert.equal(m0.dataFile, 'your Thunderbird profile');
  const uid = await tb.call('data:save', { kind: 'event', summary: 'Dentist', date: '2026-10-22', time: '14:30', allDay: false });
  await tb.host.flush();
  assert.match(tb.files.get('reminders.ics').text, /SUMMARY:Dentist/);
  const again = fakeThunderbird(tb.files);
  await again.host.start();
  assert.equal((await again.call('data:get', uid)).summary, 'Dentist');
  assert.equal(tb.log.menu.find((i) => i.id === 'open').title, 'Open ReminderFoxAgain');
});

test('host 2. a daily backup keeps the file as it was before the day\'s first change', async () => {
  const tb = fakeThunderbird();
  await tb.host.start();
  await tb.call('data:save', { kind: 'event', summary: 'First', date: '2026-10-22', allDay: true });
  await tb.advance(DAY);
  await tb.call('data:save', { kind: 'event', summary: 'Second', date: '2026-10-23', allDay: true });
  await tb.host.flush();
  const daily = [...tb.files.keys()].filter((n) => /^backups\/reminders-\d{4}-\d{2}-\d{2}\.ics$/.test(n));
  assert.equal(daily.length, 1);
  const b = tb.files.get(daily[0]).text;
  assert.match(b, /SUMMARY:First/);
  assert.doesNotMatch(b, /SUMMARY:Second/);
  const list = await tb.call('backup:list');
  assert.equal(list[0].kind, 'Daily backup');
  assert.equal(list[0].items, 1);
});
const DAY = 86400000;

test('host 3. import: picked files are previewed, then imported; a picked prefs.js brings the add-on\'s lists', async () => {
  const tb = fakeThunderbird();
  await tb.host.start();
  const tokens = await tb.call('upload', [{ name: 'reminderfox.ics', text: FIXTURE }, { name: 'prefs.js', text: PREFS }]);
  assert.equal(tokens.length, 2);
  const p = await tb.call('ics:preview', tokens);
  assert.deepEqual(p.files, ['reminderfox.ics']);
  assert.equal(p.events + p.todos, 6);
  const r = await tb.call('ics:importPaths', tokens, {});
  assert.equal(r.added, 6);
  assert.ok(r.lists.length > 0, 'lists from prefs.js');
  const m = await tb.call('data:meta');
  for (const l of r.lists) assert.ok(m.todoLists.includes(l));
  await assert.rejects(tb.call('ics:importPaths', ['upload:999/x.ics'], {}), /no longer available/);
});

test('host 4. an unreadable reminders file is kept aside and never overwritten', async () => {
  const files = new Map([['reminders.ics', { text: 'this is not a calendar', mtime: 0 }]]);
  const tb = fakeThunderbird(files);
  await tb.host.start();
  const m = await tb.call('data:meta');
  assert.match(m.loadError, /could not be read/);
  await tb.host.flush();
  assert.equal(files.get('reminders.ics.unreadable').text, 'this is not a calendar');
});

test('host 5. alarms: due → the alarm window and a notification; snooze, then due again; dismiss closes it', async () => {
  const tb = fakeThunderbird();
  await tb.host.start();
  await tb.call('data:save', { kind: 'event', summary: 'Call the pharmacy', date: '2026-10-20', time: '09:30', allDay: false, alarm: { minutes: 15 } });
  assert.equal((await tb.call('alarm:state')).alarms.length, 0);
  await tb.advance(16 * 60000); // 9:16, the alarm was at 9:15
  tb.host.checkAlarms();
  const st = await tb.call('alarm:state');
  assert.equal(st.alarms.length, 1);
  assert.ok(tb.log.windows.includes('alarm:show'));
  assert.equal(tb.log.notes[0].title, 'Call the pharmacy');
  assert.ok(tb.log.emits.some((e) => e.ch === 'alarms:update' && e.target === 'alarm' && e.payload.alarms.length === 1));
  const key = st.alarms[0].key;
  assert.equal(await tb.call('alarm:snooze', key, 600), true);
  assert.equal((await tb.call('alarm:state')).alarms.length, 0);
  assert.equal(tb.log.windows.at(-1), 'alarm:close');
  await tb.advance(601000); // the snooze timer fires checkAlarms
  assert.equal((await tb.call('alarm:state')).alarms.length, 1);
  await tb.call('alarm:dismiss', key);
  assert.equal((await tb.call('alarm:state')).alarms.length, 0);
  assert.match(tb.log.tooltip, /Call the pharmacy/);
});

test('host 6. quick alarms ring on time; suspend holds them until resumed', async () => {
  const tb = fakeThunderbird();
  await tb.host.start();
  await assert.rejects(tb.call('quick:add', { text: 'Tea', at: tb.now() - 3600000 }), /future/);
  const q = await tb.call('quick:add', { text: 'Tea', at: tb.now() + 5 * 60000 });
  assert.equal((await tb.call('quick:list')).length, 1);
  await tb.call('suspend:set', null); // until resumed
  assert.match(tb.log.tooltip, /alarms off/);
  assert.equal(tb.log.menu.find((i) => i.id === 'resume').title, 'Resume alarms');
  await tb.advance(6 * 60000);
  assert.equal((await tb.call('alarm:state')).alarms.length, 0);
  await tb.call('suspend:set', 0);
  const st = await tb.call('alarm:state');
  assert.equal(st.alarms.length, 1);
  assert.equal(st.alarms[0].summary, 'Tea');
  await tb.call('alarm:dismiss', st.alarms[0].key);
  assert.equal((await tb.call('quick:list')).find((x) => x.id === q.id), undefined);
});

test('host 7. backup now, then restore it: what you had is saved first', async () => {
  const tb = fakeThunderbird();
  await tb.host.start();
  await tb.call('data:save', { kind: 'event', summary: 'Keep me', date: '2026-10-22', allDay: true });
  const file = await tb.call('backup:now');
  assert.match(file, /^backups\/manual-/);
  await tb.call('data:save', { kind: 'event', summary: 'Added later', date: '2026-10-23', allDay: true });
  const r = await tb.call('backup:restore', file);
  assert.equal(r.items, 1);
  assert.match(r.safety, /^before-restore-/);
  const all = await tb.call('data:all');
  assert.deepEqual(all.map((d) => d.summary), ['Keep me']);
  const b = await tb.call('backup:text', file);
  assert.match(b.text, /Keep me/);
  // a backup the person picked from a file
  const [tok] = await tb.call('upload', [{ name: 'ReminderFoxAgain-backup.ics', text: FIXTURE }]);
  const d = await tb.call('backup:describe', tok);
  assert.equal(d.items, 6);
});

test('host 8. export text, the toolbar menu and the main tab', async () => {
  const tb = fakeThunderbird();
  await tb.host.start();
  await tb.call('data:save', { kind: 'todo', summary: 'Water the plants' });
  const all = await tb.call('ics:exportText', {});
  assert.match(all.name, /^reminderfoxagain-2026-10-20\.ics$/);
  assert.match(all.text, /VTODO/);
  const ev = await tb.call('ics:exportText', { kind: 'event' });
  assert.doesNotMatch(ev.text, /VTODO/);
  await tb.host.menuClick('new-todo');
  assert.equal(tb.log.windows.at(-1), 'main');
  assert.deepEqual(tb.log.emits.at(-1), { ch: 'ui:new', payload: { kind: 'todo' }, target: 'main' });
  await tb.call('alarm:open', 'abc|123|456');
  assert.deepEqual(tb.log.emits.at(-1), { ch: 'ui:edit', payload: { uid: 'abc', start: 123 }, target: 'main' });
  assert.equal(await tb.call('open:url', 'https://www.openstreetmap.org/'), true);
  assert.equal(await tb.call('open:url', 'file:///etc/passwd'), false);
  assert.deepEqual(await tb.call('rf:findOld'), []);
});

test('host 9. a chosen language: the menu, the pages and repeat descriptions follow it', async () => {
  const tb = fakeThunderbird();
  await tb.host.start();
  assert.equal(tb.log.lang.lang, 'en');
  assert.equal(tb.log.lang.host, 'thunderbird');
  await tb.call('settings:set', { language: 'de' });
  await tb.advance(100);
  assert.equal(tb.log.lang.lang, 'de');
  assert.ok(tb.log.emits.some((e) => e.ch === 'host:reload'));
  assert.equal(tb.log.menu.find((i) => i.id === 'new-event').title, 'Erinnerung hinzufügen…');
  const uid = await tb.call('data:save', { kind: 'event', summary: 'Team', date: '2026-10-20', allDay: true, repeat: { freq: 'WEEKLY', byday: ['TU'] } });
  assert.match((await tb.call('data:get', uid)).repeatText, /Di/);
  await tb.call('settings:set', { language: 'en' }); // back to English for the other tests
  await tb.advance(100);
});

test('host 10. a chosen sound is kept, typed by its extension, and handed to the alarm window', async () => {
  const tb = fakeThunderbird();
  await tb.host.start();
  await assert.rejects(tb.call('sound:set', { name: 'notes.txt', size: 3, dataUrl: 'data:text/plain;base64,YWJj' }), /sound file/);
  const s = await tb.call('sound:set', { name: 'bell.ogg', size: 3, dataUrl: 'data:application/octet-stream;base64,YWJj' });
  assert.equal(s.alarmTone, 'file');
  assert.equal(s.soundName, 'bell.ogg');
  assert.equal(await tb.call('sound:data'), 'data:audio/ogg;base64,YWJj');
});

test('host 11. "Add reminder…" on an email: the menu item, and what the editor opens with', async () => {
  const tb = fakeThunderbird(); // today is Tue Oct 20, 2026, 9:00
  await tb.host.start();
  const item = tb.log.menu.find((i) => i.id === 'mail-reminder');
  assert.equal(item.title, 'Add reminder…');
  assert.deepEqual(item.contexts, ['message_list']);
  const todoItem = tb.log.menu.find((i) => i.id === 'mail-todo');
  assert.equal(todoItem.title, 'Add list item…');
  assert.deepEqual(todoItem.contexts, ['message_list']);
  const p = await tb.call('mail:reminder', { subject: 'Re: Dentist — Dr. Patel', date: tb.now(), body: 'Your appointment is on Thursday, October 22 at 2:30 pm.\n\nOn Mon, Oct 19, 2026 at 9:00 AM, the office wrote:\n> old text' });
  assert.deepEqual(p, { kind: 'event', date: '2026-10-22', prefill: { summary: 'Dentist — Dr. Patel', time: '14:30', location: null }, found: 'Thursday, October 22' });
  // the same email as a list item: the date and time become its "due by"
  const t = await tb.call('mail:reminder', { subject: 'Re: Renew passport', date: tb.now(), body: 'Due by Friday, October 30 at 5 pm.\nWhere: Service Canada', messageId: 'abc.42@mail.example.com' }, 'todo');
  assert.deepEqual(t, { kind: 'todo', date: '2026-10-30', prefill: { summary: 'Renew passport', time: '17:00', location: 'Service Canada', messageId: '<abc.42@mail.example.com>' }, found: 'Friday, October 30' });
  const none = await tb.call('mail:reminder', { subject: 'Hello', date: tb.now(), body: 'No date.' });
  assert.equal(none.date, null);
  assert.equal(none.prefill.summary, 'Hello');
});

test('host 12. the email an item came from: kept with it, kept on edits, opened through Thunderbird', async () => {
  const tb = fakeThunderbird();
  await tb.host.start();
  // saved from the editor opened on an email
  const uid = await tb.call('data:save', { kind: 'todo', summary: 'Renew passport', date: '2026-10-30', allDay: true, messageId: '<abc.42@mail.example.com>' });
  await tb.host.flush();
  assert.match(tb.files.get('reminders.ics').text, /X-REMINDERFOX-MESSAGEID:<abc\.42@mail\.example\.com>/);
  assert.equal((await tb.call('data:get', uid)).messageId, '<abc.42@mail.example.com>');
  // an edit that doesn't send it keeps it
  await tb.call('data:save', { uid, kind: 'todo', summary: 'Renew passport (form 12)', date: '2026-10-30', allDay: true });
  assert.equal((await tb.call('data:get', uid)).messageId, '<abc.42@mail.example.com>');
  // a reminder from the original ReminderFox add-on keeps its message id and can open it
  const [tok] = await tb.call('upload', [{ name: 'reminderfox.ics', text: require('fs').readFileSync(require('path').join(__dirname, 'reminderfox-addon-full.ics'), 'utf8') }]);
  await tb.call('ics:importPaths', [tok], {});
  const fromAddon = (await tb.call('data:all')).find((d) => d.messageId === '<abc123@mail.example.com>');
  assert.ok(fromAddon, 'the add-on item with X-REMINDERFOX-MESSAGEID');
  assert.equal(await tb.call('mail:open', fromAddon.messageId), true);
  assert.equal(tb.log.opened, '<abc123@mail.example.com>');
  await assert.rejects(tb.call('mail:open', ''), /no email/);
  await assert.rejects(tb.call('mail:open', '<gone@example.com>'), /not found/);
});

test('host 13. send an item by email, and the emails to tag', async () => {
  const tb = fakeThunderbird();
  await tb.host.start();
  const uid = await tb.call('data:save', { kind: 'event', summary: 'Dentist — Dr. Patel', date: '2026-10-22', time: '14:30', allDay: false, location: 'Yonge & Eglinton', notes: 'Bring the form', messageId: '<a@x.example>' });
  const m = await tb.call('mail:item', uid);
  assert.equal(m.subject, 'Dentist — Dr. Patel');
  assert.equal(m.file, 'Dentist — Dr. Patel.ics');
  assert.match(m.body, /^Dentist — Dr\. Patel\nThu, Oct 22, 2026, 2:30\sp\.m\.\nYonge & Eglinton\n\nBring the form$/);
  assert.match(m.ics, /BEGIN:VEVENT[\s\S]*SUMMARY:Dentist/);
  const t = await tb.call('data:save', { kind: 'todo', summary: 'Renew passport', messageId: '<b@x.example>' });
  assert.deepEqual(await tb.call('mail:linked'), { open: ['<a@x.example>', '<b@x.example>'], done: [] });
  await tb.call('data:complete', t, true);
  assert.deepEqual(await tb.call('mail:linked'), { open: ['<a@x.example>'], done: ['<b@x.example>'] });
  assert.equal(await tb.call('host:t', 'Add reminder…'), 'Add reminder…');
});

test('host 14. birthdays from address-book contacts: added, kept in step, removed', async () => {
  const tb = fakeThunderbird(); // today Oct 20, 2026
  await tb.host.start();
  const vc = (fn, bday) => `BEGIN:VCARD\r\nVERSION:4.0\r\nFN:${fn}\r\n${bday ? `BDAY:${bday}\r\n` : ''}END:VCARD\r\n`;
  const r = await tb.call('contacts:sync', [{ id: 'c1', vcard: vc('Olivia Martin', '19900315') }, { id: 'c2', vcard: vc('Noah Chen', '--1103') }, { id: 'c3', vcard: vc('No Birthday') }], true);
  assert.deepEqual(r, { added: 2, updated: 0, removed: 0 });
  const o = await tb.call('data:get', 'contact-c1@reminderfoxagain');
  assert.equal(o.summary, "Olivia Martin's birthday <1990>");
  assert.equal(o.date, '1990-03-15');
  assert.equal(o.repeat.freq, 'YEARLY');
  assert.deepEqual(o.categories, ['Birthday']);
  assert.equal((await tb.call('data:get', 'contact-c2@reminderfoxagain')).summary, "Noah Chen's birthday");
  // the same again: nothing changes; a changed birthday is updated; a contact gone is removed
  assert.deepEqual(await tb.call('contacts:sync', [{ id: 'c1', vcard: vc('Olivia Martin', '1990-03-15') }, { id: 'c2', vcard: vc('Noah Chen', '--11-03') }], true), { added: 0, updated: 0, removed: 0 });
  assert.deepEqual(await tb.call('contacts:sync', [{ id: 'c1', vcard: vc('Olivia Martin', '1990-03-16') }], true), { added: 0, updated: 1, removed: 1 });
  assert.equal((await tb.call('data:get', 'contact-c1@reminderfoxagain')).date, '1990-03-16');
  assert.equal(await tb.call('data:get', 'contact-c2@reminderfoxagain'), null);
});

test('host 15. invitations: sent from the organizer to attendees, replies recorded and announced', async () => {
  const tb = fakeThunderbird();
  await tb.host.start();
  const uid = await tb.call('data:save', { kind: 'event', summary: 'Thanksgiving dinner', date: '2026-10-25', time: '17:30', allDay: false });
  await assert.rejects(tb.call('mail:invite', uid, null, ['a@x.example']), /no email account/);
  await assert.rejects(tb.call('mail:invite', uid, { email: 'me@x.example' }, ['not an address']), /No email address/);
  const inv = await tb.call('mail:invite', uid, { email: 'me@x.example', name: 'David' }, ['Olivia@X.example', 'leo@x.example', 'olivia@x.example']);
  const unfold = (t) => t.replace(/\r\n[ \t]/g, '');
  inv.ics = unfold(inv.ics);
  assert.deepEqual(inv.to, ['olivia@x.example', 'leo@x.example']);
  assert.equal(inv.subject, 'Invitation: Thanksgiving dinner');
  assert.match(inv.ics, /\r\nMETHOD:REQUEST\r\n/);
  // the time is sent as UTC: 5:30 PM on Oct 25 here
  assert.match(inv.ics, new RegExp(`DTSTART:${new Date(2026, 9, 25, 17, 30).toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`));
  assert.match(inv.ics, /ORGANIZER;CN=David:mailto:me@x\.example/);
  assert.match(inv.ics, /ATTENDEE;[^\r]*PARTSTAT=NEEDS-ACTION[^\r]*:mailto:olivia@x\.example/);
  const seq = Number(/SEQUENCE:(\d+)/.exec(inv.ics)[1]);
  let d = await tb.call('data:get', uid);
  assert.deepEqual(d.attendees.map((a) => `${a.email} ${a.status}`), ['olivia@x.example needs-action', 'leo@x.example needs-action']);
  // Olivia's reply
  const reply = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nMETHOD:REPLY\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20261021T120000Z\r\nATTENDEE;PARTSTAT=ACCEPTED;CN=Olivia:mailto:olivia@x.example\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  const r = await tb.call('mail:reply', reply);
  assert.deepEqual(r, [{ uid, summary: 'Thanksgiving dinner', email: 'olivia@x.example', name: 'Olivia', status: 'accepted' }]);
  assert.deepEqual(tb.log.notes.at(-1), { title: 'Olivia: accepted', body: 'Thanksgiving dinner' });
  d = await tb.call('data:get', uid);
  assert.deepEqual(d.attendees.map((a) => `${a.name || a.email} ${a.status}`), ['Olivia accepted', 'leo@x.example needs-action']);
  // a second invitation keeps Olivia's answer and raises SEQUENCE; a reply from someone not invited changes nothing
  const again = await tb.call('mail:invite', uid, { email: 'me@x.example' }, ['olivia@x.example', 'leo@x.example', 'eliana@x.example']);
  again.ics = unfold(again.ics);
  assert.match(again.ics, new RegExp(`SEQUENCE:${seq + 1}\r`));
  assert.match(again.ics, /PARTSTAT=ACCEPTED[^\r]*:mailto:olivia@x\.example/);
  // the saved item keeps its own local time
  assert.equal((await tb.call('data:get', uid)).time, '17:30');
  assert.equal(await tb.call('mail:reply', reply.replace('olivia@x.example', 'stranger@x.example')), null);
  assert.equal(await tb.call('mail:reply', 'not a calendar'), null);
});

test('host 16. the Alarms view: ringing, snoozed, to come and skipped; a skip ahead of time holds past a week', async () => {
  const tb = fakeThunderbird(); // Oct 20, 2026, 9:00
  await tb.host.start();
  await tb.call('data:save', { kind: 'event', summary: 'Call the pharmacy', date: '2026-10-20', time: '09:30', allDay: false, alarm: { minutes: 15 } });
  await tb.call('data:save', { kind: 'event', summary: 'Water the plants', date: '2026-10-21', time: '08:00', allDay: false, alarm: { minutes: 0 }, repeat: { freq: 'DAILY', interval: 1, end: 'never' } });
  await tb.call('quick:add', { text: 'Tea', at: tb.now() + 60 * 60000 });
  let v = await tb.call('alarms:list', 7);
  assert.equal(v.days, 7);
  assert.deepEqual(v.alarms.slice(0, 3).map((a) => `${a.summary} ${a.status}${a.quick ? ' quick' : ''}`), ['Call the pharmacy upcoming', 'Tea upcoming quick', 'Water the plants upcoming']);
  assert.equal(v.alarms.filter((a) => a.summary === 'Water the plants' && a.repeat).length, 7); // Oct 21 … Oct 27
  assert.ok(v.alarms.every((a, i, all) => i === 0 || a.when >= all[i - 1].when));
  assert.equal((await tb.call('alarms:list', 1)).alarms.filter((a) => a.summary === 'Water the plants').length, 1);
  // 9:16: the pharmacy alarm rings; snoozed, it shows as snoozed until 9:26
  await tb.advance(16 * 60000);
  tb.host.checkAlarms();
  v = await tb.call('alarms:list', 7);
  const ring = v.alarms[0];
  assert.equal(`${ring.summary} ${ring.status}`, 'Call the pharmacy ringing');
  await tb.call('alarm:snooze', ring.key, 600);
  v = await tb.call('alarms:list', 7);
  assert.equal(`${v.alarms[0].summary} ${v.alarms[0].status} ${v.alarms[0].when - tb.now()}`, 'Call the pharmacy snoozed 600000');
  // skip Wednesday's watering ahead of time: listed as skipped, and it doesn't ring, even 8 days after the skip
  const wed = v.alarms.find((a) => a.summary === 'Water the plants');
  await tb.call('alarm:dismiss', wed.key);
  assert.equal((await tb.call('alarms:list', 7)).alarms.find((a) => a.key === wed.key).status, 'skipped');
  await tb.call('alarm:unskip', wed.key);
  assert.equal((await tb.call('alarms:list', 7)).alarms.find((a) => a.key === wed.key).status, 'upcoming');
  const later = (await tb.call('alarms:list', 30)).alarms.filter((a) => a.summary === 'Water the plants')[9]; // Oct 30
  await tb.call('alarm:dismiss', later.key);
  await tb.advance(new Date(2026, 9, 30, 8, 16).getTime() - tb.now()); // Oct 30, 8:16 (local, past any clock change)
  tb.host.checkAlarms();
  const ringing = (await tb.call('alarm:state')).alarms.map((a) => a.key);
  assert.ok(!ringing.includes(later.key), 'the skipped alarm rang');
  assert.equal((await tb.call('alarms:list', 1)).alarms.find((a) => a.key === later.key), undefined); // past now
  // a quick alarm is cancelled from the view; the toolbar menu has "Alarms…" and it opens the view
  assert.equal(tb.log.menu.find((i) => i.id === 'alarms').title, 'Alarms…');
  await tb.host.menuClick('alarms');
  assert.ok(tb.log.emits.some((e) => e.ch === 'ui:alarms' && e.target === 'main'));
});

test('host 17. calendar subscriptions: subscribe, show per view, read-only, copy, refresh on time, keep the last copy', async () => {
  const tb = fakeThunderbird(); // Oct 20, 2026, 9:00
  await tb.host.start();
  const cal = (title, day) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Example//Holidays//EN', 'X-WR-CALNAME:Holidays in Example', 'BEGIN:VEVENT', 'UID:h1@example.com', 'DTSTAMP:20260101T000000Z',
    `DTSTART;VALUE=DATE:${day}`, `SUMMARY:${title}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  tb.log.web.set('https://cal.example.com/holidays.ics', cal('Harvest Day', '20261026'));
  await assert.rejects(tb.call('subs:add', { url: 'ftp://x' }), /web address/);
  tb.log.web.set('https://cal.example.com/page.html', '<html>not a calendar</html>');
  await assert.rejects(tb.call('subs:add', { url: 'https://cal.example.com/page.html' }), /did not give a calendar/);
  const sub = await tb.call('subs:add', { url: 'webcal://cal.example.com/holidays.ics' });
  assert.equal(`${sub.name} ${sub.url} ${sub.count} ${sub.showList} ${sub.showMonth}`, 'Holidays in Example https://cal.example.com/holidays.ics 1 true true');
  await assert.rejects(tb.call('subs:add', { url: 'https://cal.example.com/holidays.ics' }), /already subscribe/);
  assert.ok(tb.files.has(`subscriptions/${sub.id}.ics`) || (await tb.host.flush(), tb.files.has(`subscriptions/${sub.id}.ics`)));
  const from = new Date(2026, 9, 20).getTime(); const to = new Date(2026, 10, 1).getTime();
  let rows = await tb.call('subs:range', from, to, 'month');
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(`${r.summary} ${r.readOnly} ${r.subColor === sub.color} ${r.uid.startsWith(`sub:${sub.id}:`)}`, 'Harvest Day true true true');
  assert.equal((await tb.call('subs:next', from, {}, 'list')).length, 1);
  // not in your own reminders, and it can't be changed
  assert.equal((await tb.call('data:range', from, to, {})).length, 0);
  await assert.rejects(tb.call('data:delete', r.uid), /subscribe to/);
  await assert.rejects(tb.call('data:save', { uid: r.uid, summary: 'x' }), /subscribe to/);
  const d = await tb.call('data:get', r.uid);
  assert.equal(`${d.summary} ${d.readOnly} ${d.subName}`, 'Harvest Day true Holidays in Example');
  // copied to your reminders: your own item, changeable
  const mine = await tb.call('data:duplicate', r.uid, { suffix: ' (copy)' });
  const own = await tb.call('data:get', mine);
  assert.equal(`${own.summary} ${!!own.readOnly} ${own.date}`, 'Harvest Day false 2026-10-26');
  // hidden from the Reminders view only
  await tb.call('subs:update', sub.id, { showList: false, color: '#123456', refreshHours: 6, name: 'Holidays' });
  assert.equal((await tb.call('subs:range', from, to, 'list')).length, 0);
  assert.equal((await tb.call('subs:range', from, to, 'month'))[0].subColor, '#123456');
  // refreshed on its timer (6 hours): the new copy replaces the old one
  tb.log.web.set('https://cal.example.com/holidays.ics', cal('Harvest Festival', '20261027'));
  await tb.advance(6 * 3600000 + 10000);
  rows = await tb.call('subs:range', from, to, 'month');
  assert.equal(`${rows[0].summary} ${rows[0].date}`, 'Harvest Festival 2026-10-27');
  // a failed refresh keeps the last good copy and says why
  tb.log.web.set('https://cal.example.com/holidays.ics', new Error('The calendar\'s web site answered “404 Not Found”.'));
  assert.equal(await tb.call('subs:refresh', sub.id), false);
  const st = (await tb.call('subs:list'))[0];
  assert.match(st.error, /404/);
  assert.equal((await tb.call('subs:range', from, to, 'month'))[0].summary, 'Harvest Festival');
  // a new start shows the kept copy without fetching
  await tb.host.flush();
  const again = fakeThunderbird(tb.files, tb.now());
  await again.host.start();
  assert.equal((await again.call('subs:range', from, to, 'month'))[0].summary, 'Harvest Festival');
  // removed: gone, its file too
  assert.equal(await tb.call('subs:remove', sub.id), true);
  await tb.host.flush();
  assert.equal((await tb.call('subs:list')).length, 0);
  assert.equal(tb.files.has(`subscriptions/${sub.id}.ics`), false);
});

test('host 18. calendar subscriptions: items can be ticked, and the ticks survive refreshes and restarts', async () => {
  const tb = fakeThunderbird(); // Oct 20, 2026, 9:00
  await tb.host.start();
  const ev = (uid, title, start, extra = []) => ['BEGIN:VEVENT', `UID:${uid}`, 'DTSTAMP:20260101T000000Z', `DTSTART;VALUE=DATE:${start}`, `SUMMARY:${title}`, ...extra, 'END:VEVENT'];
  const cal = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Example//Team//EN', ...events.flat(), 'END:VCALENDAR', ''].join('\r\n');
  const url = 'https://cal.example.com/team.ics';
  tb.log.web.set(url, cal(ev('a@x', 'Planning day', '20261022'), ev('w@x', 'Weekly sync', '20261021', ['RRULE:FREQ=WEEKLY'])));
  const sub = await tb.call('subs:add', { url });
  const from = new Date(2026, 9, 20).getTime(); const to = new Date(2026, 10, 10).getTime();
  const rows = async () => tb.call('subs:range', from, to, 'list');
  const one = async (t, i = 0) => (await rows()).filter((r) => r.summary === t)[i];
  // tick a one-off item and one date of a repeating one
  assert.equal(await tb.call('data:complete', (await one('Planning day')).uid, true), true);
  const w2 = await one('Weekly sync', 1);
  await tb.call('data:complete', w2.uid, true, w2.start);
  assert.equal(`${(await one('Planning day')).completed} ${!!(await one('Planning day')).completedAt}`, 'true true');
  const weekly = (await rows()).filter((r) => r.summary === 'Weekly sync').map((r) => r.completed);
  assert.deepEqual(weekly.slice(0, 3), [false, true, false]);
  // the calendar's own file is not changed; the ticks are kept in state.json
  await tb.host.flush();
  assert.ok(!/X-REMINDERFOX/.test(tb.files.get(`subscriptions/${sub.id}.ics`).text));
  assert.equal(Object.keys(JSON.parse(tb.files.get('state.json').text).subsDone[sub.id]).length, 2);
  // a refresh (same calendar) keeps them
  assert.equal(await tb.call('subs:refresh', sub.id), true);
  assert.equal((await one('Planning day')).completed, true);
  assert.equal((await one('Weekly sync', 1)).completed, true);
  // and so does a new start
  await tb.host.flush();
  const again = fakeThunderbird(tb.files, tb.now());
  await again.host.start();
  assert.equal((await again.call('subs:range', from, to, 'list')).filter((r) => r.completed).length, 2);
  // unticked
  await tb.call('data:complete', (await one('Planning day')).uid, false);
  assert.equal((await one('Planning day')).completed, false);
  // an item the calendar no longer has: its tick goes on the next refresh
  tb.log.web.set(url, cal(ev('a@x', 'Planning day', '20261022')));
  await tb.call('subs:refresh', sub.id);
  await tb.host.flush();
  assert.equal(JSON.parse(tb.files.get('state.json').text).subsDone[sub.id], undefined);
  // the rest of it is still read-only
  await assert.rejects(tb.call('data:delete', (await one('Planning day')).uid), /subscribe to/);
  // removing the subscription removes its ticks
  await tb.call('data:complete', (await one('Planning day')).uid, true);
  await tb.call('subs:remove', sub.id);
  await tb.host.flush();
  assert.deepEqual(JSON.parse(tb.files.get('state.json').text).subsDone || {}, {});
});

test('host 19. calendar subscriptions: an option marks events completed once they are over', async () => {
  const tb = fakeThunderbird(); // Oct 20, 2026, 9:00
  await tb.host.start();
  const ev = (uid, title, start, end) => ['BEGIN:VEVENT', `UID:${uid}`, 'DTSTAMP:20260101T000000Z', `DTSTART${end ? '' : ';VALUE=DATE'}:${start}`, ...(end ? [`DTEND:${end}`] : []), `SUMMARY:${title}`, 'END:VEVENT'];
  const url = 'https://cal.example.com/games.ics';
  tb.log.web.set(url, ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Example//Games//EN', ...ev('p@x', 'Past game', '20261018'),
    ...ev('t@x', 'Morning game', '20261020T070000', '20261020T083000'), ...ev('f@x', 'Next game', '20261022'), 'END:VCALENDAR', ''].join('\r\n'));
  const sub = await tb.call('subs:add', { url });
  assert.equal(sub.autoDone, false);
  const from = new Date(2026, 9, 15).getTime(); const to = new Date(2026, 9, 31).getTime();
  const done = async () => (await tb.call('subs:range', from, to, 'list')).map((r) => `${r.summary}:${r.completed}`).join(' ');
  assert.equal(await done(), 'Past game:false Morning game:false Next game:false');
  // on: what is over counts as completed (the all-day game the day before, the timed one that ended at 8:30)
  await tb.call('subs:update', sub.id, { autoDone: true });
  assert.equal(await done(), 'Past game:true Morning game:true Next game:false');
  // unticking one keeps it open, also after a refresh
  const past = (await tb.call('subs:range', from, to, 'list')).find((r) => r.summary === 'Past game');
  await tb.call('data:complete', past.uid, false, past.start);
  await tb.call('subs:refresh', sub.id);
  assert.equal(await done(), 'Past game:false Morning game:true Next game:false');
  // once the next one is over, it counts as completed too
  await tb.advance(3 * 24 * 3600000);
  assert.equal(await done(), 'Past game:false Morning game:true Next game:true');
  // off again: only what you ticked yourself
  await tb.call('subs:update', sub.id, { autoDone: false });
  assert.equal(await done(), 'Past game:false Morning game:false Next game:false');
});
