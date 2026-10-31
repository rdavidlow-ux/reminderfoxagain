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
    systemLocale: () => 'en-CA',
    loadDict: async (lang) => JSON.parse(fs.readFileSync(path.join(LOCALES, `${lang}.json`), 'utf8')),
    languageChanged: (info) => { log.lang = info; },
    now: () => clock,
    setTimeout: (fn, ms) => { timers.push({ id: ++tid, fn, at: clock + ms }); return tid; },
    clearTimeout: (id) => { timers = timers.filter((t) => t.id !== id); },
    setInterval: () => 0,
    clearInterval: () => {},
  };
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
