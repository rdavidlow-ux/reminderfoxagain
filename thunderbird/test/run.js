'use strict';
// Runs the built Thunderbird add-on (dist/thunderbird) in Chromium with a mock of Thunderbird's WebExtension API
// (mock-browser.js), and runs UI check scripts from tools/ui/ in its pages, as tools/e2e.sh does for the desktop app.
//   node thunderbird/test/run.js [--size 1180x760] [--lang de] [--sample basic|bills] [--alarm alarm-script.js] main-script.js
// Prints the scripts' "E2E …" lines plus the add-on's own checks ("E2E TB …"). Not a real Thunderbird: see
// docs/technical-system-design.md (Tried in a real Thunderbird) for what is still to be tried there.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'thunderbird');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const SIZE = opt('size', '1180x760').split('x').map(Number);
const LANG = opt('lang', '');
const SAMPLE = opt('sample', 'basic');
const ALARM = opt('alarm', '');
const SCRIPT = args[0] || 'none.js';
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const line = (name, got, want) => console.log(`E2E TB ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);

// Checks of the desktop scripts that the add-on answers differently on purpose
const DIFFERENT = [
];
function expected(t) {
  for (const [re, why] of DIFFERENT) if (re.test(t) && t.endsWith('  WRONG')) return `${t.slice(0, -7)}  (different on purpose: ${why})`;
  return t;
}

const TEAM_ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Example//Team//EN', 'BEGIN:VEVENT', 'UID:team-offsite-1@example.com', 'DTSTAMP:20260101T000000Z',
  'DTSTART;VALUE=DATE:20301015', 'SUMMARY:Team offsite at the lake', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain' };
function serve() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    // a calendar file behind a link in an email ("Import this calendar…")
    if (u.pathname === '/_cal/holidays.ics') { res.writeHead(200, { 'content-type': 'text/calendar' }); res.end(require(path.join(ROOT, 'tools', 'sample-calendar.js')).text()); return; }
    if (u.pathname === '/_cal/huge.ics') { require(path.join(ROOT, 'tools', 'sample-calendar.js')).sendHuge(res); return; }
    if (u.pathname === '/_cal/team.ics') { res.writeHead(200, { 'content-type': 'text/calendar' }); res.end(TEAM_ICS); return; }
    if (u.pathname === '/_bg.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><meta charset="utf-8"><script src="/host.js"></script><script src="/tb/background.js"></script>'); return; }
    const p = path.join(DIST, decodeURIComponent(u.pathname));
    if (!p.startsWith(DIST) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(fs.readFileSync(p));
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'manifest.json'))) throw new Error('Build the add-on first: ./build-thunderbird.sh');
  // the same made-up sample data as the desktop checks, put into the add-on's storage
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-tb-'));
  if (SAMPLE !== 'empty') execFileSync('node', [path.join(ROOT, 'tools', 'sample-data.js'), tmp, SAMPLE], { stdio: 'ignore' }); // empty: a brand-new installation
  const storage = { 'f-index': {} };
  for (const f of ['reminders.ics', 'state.json']) {
    if (!fs.existsSync(path.join(tmp, f))) continue;
    let text = fs.readFileSync(path.join(tmp, f), 'utf8');
    if (f === 'state.json' && LANG) { const s = JSON.parse(text); s.settings = { ...(s.settings || {}), language: LANG }; text = JSON.stringify(s); }
    storage[`f:${f}`] = text;
    storage['f-index'][f] = { size: text.length, mtime: Date.now() };
  }
  if (!storage['f:state.json'] && LANG) { const t = JSON.stringify({ settings: { language: LANG } }); storage['f:state.json'] = t; storage['f-index']['state.json'] = { size: t.length, mtime: Date.now() }; }

  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: SIZE[0], height: SIZE[1] } });
  // an email for "Add reminder…": an HTML message whose text names a date ten days ahead at 8:00 am
  const ahead = new Date(Date.now() + 10 * 86400000);
  const aheadKey = `${ahead.getFullYear()}-${String(ahead.getMonth() + 1).padStart(2, '0')}-${String(ahead.getDate()).padStart(2, '0')}`;
  const aheadWords = ahead.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const messages = { 42: { contentType: 'multipart/alternative', parts: [{ contentType: 'text/html', body: `<html><body><p>Hi Leo,</p><p>Your car service at the dealer is booked for <b>${aheadWords}</b> at 8:00 am.</p><p>Location: Maple Motors service desk<br><br>500 Queen St E, Toronto</p><blockquote type="cite">On an earlier day you wrote: January 1, 2030</blockquote></body></html>` }] } };
  // the folders, the account, an address book with birthdays, and the email shown when text is selected (all made up)
  const library = { 'car-service.42@dealer.example.com': { id: 42, tags: ['$label1'] }, 'lunch.7@example.com': { id: 7, tags: [] } };
  const account = { id: 'account1', name: 'Leo', identities: [{ id: 'id1', email: 'leo@example.com', name: 'Leo Park' }] };
  const addressBooks = [{ id: 'ab1', type: 'addressBook', name: 'Personal Address Book', contacts: [
    { id: 'c-ana', type: 'contact', vCard: 'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Ana Lima\r\nEMAIL;PREF=1:ana@example.com\r\nBDAY:19900314\r\nEND:VCARD' },
    { id: 'c-ben', type: 'contact', vCard: 'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Ben Ortiz\r\nEMAIL:ben@example.com\r\nBDAY:--0702\r\nEND:VCARD' },
    { id: 'c-cy', type: 'contact', vCard: 'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Cy Moore\r\nEMAIL:cy@example.com\r\nEND:VCARD' },
  ] }];
  const displayed = { id: 7, headerMessageId: 'lunch.7@example.com', subject: 'Plans', date: new Date().toISOString() };
  await ctx.addInitScript({ content: `window.__seed = ${JSON.stringify({ storage, os: 'linux', uiLanguage: 'en-CA', messages, knownMessageIds: ['car-service.42@dealer.example.com'], library, account, addressBooks, displayed })};\n${fs.readFileSync(path.join(__dirname, 'mock-browser.js'), 'utf8')}` });
  const pages = new Map(); // tab or window id → page
  const errors = [];
  const watch = (page, label) => {
    page.on('console', (m) => { const t = m.text(); if (t.startsWith('E2E')) console.log(expected(t)); else if (m.type() === 'error' && !/favicon|Failed to load resource/.test(t)) errors.push(`${label}: ${t}`); });
    page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  };
  const bg = await ctx.newPage();
  watch(bg, 'background');
  await bg.goto(`${origin}/_bg.html`);
  for (let i = 0; i < 100 && !(await bg.evaluate(() => window.__mock && window.__mock.state.menus.length > 0)); i++) await sleep(100);

  // open the pages the background page asks for (a tab, or a popup window at the size it asked for)
  let pumping = true;
  const pump = (async () => {
    while (pumping) {
      const reqs = await bg.evaluate(() => window.__mock.state.requests.splice(0)).catch(() => []);
      for (const r of reqs) {
        if (r.kind === 'close') { const p = pages.get(r.id); pages.delete(r.id); if (p) await p.close().catch(() => {}); continue; }
        const page = await ctx.newPage();
        if (r.kind === 'window') await page.setViewportSize({ width: r.width, height: r.height });
        watch(page, r.url.replace(/^.*\//, ''));
        pages.set(r.id, page);
        page.on('close', () => { if (pages.get(r.id) === page) { pages.delete(r.id); bg.evaluate(([k, id]) => window.__mock.closed(k, id), [r.kind, r.id]).catch(() => {}); } });
        await page.goto(`${r.url}?tab=${r.id}`);
        await bg.evaluate(([k, id, url]) => window.__mock.opened(k, id, url), [r.kind, r.id, r.url]);
      }
      await sleep(100);
    }
  })();
  const find = (name) => [...pages.values()].find((p) => p.url().includes(`/${name}.html`));
  const waitFor = async (name, ms = 8000) => { for (let t = 0; t < ms; t += 100) { const p = find(name); if (p) return p; await sleep(100); } return null; };

  // the toolbar button opens the main tab
  const menu = await bg.evaluate(() => window.__mock.state.menus.filter((m) => m.type !== 'separator' && m.contexts.includes('browser_action')).map((m) => m.title).join(' | '));
  if (!LANG) line('toolbar menu', menu, "Open ReminderFoxAgain | Add reminder… | Add list item… | Quick alarm… | Suspend alarms… | Show today's reminders | Alarms…");
  await bg.evaluate(() => window.__mock.clickButton());
  const main = await waitFor('index');
  line('the toolbar button opens the main tab', !!main, true);
  if (!main) throw new Error('no main tab');
  await main.waitForFunction(() => window.__rf && document.querySelector('.tabs'), null, { timeout: 15000 });
  await sleep(2500);
  if (SCRIPT === 'tb-smoke.js') {
    line('desktop settings hidden', await main.evaluate(() => ['stStart', 'stTray', 'stFolder', 'stBackups', 'stPath'].map((id) => document.getElementById(id)).filter((el) => el && el.offsetParent !== null).length), 0);
  }
  // The desktop scripts import test files by their path on disk; an add-on has no paths, only files the person picks.
  // Upload the same files the add-on's way and stand their tokens in for those paths.
  const fixture = (f) => fs.readFileSync(path.join(ROOT, 'test', f), 'utf8');
  await main.evaluate(async (fx) => {
    const up = async (files) => (await browser.runtime.sendMessage({ rf: 'call', ch: 'upload', args: [files] })).value;
    const map = [
      [/addon-profile\/reminderfox\/reminderfox\.ics$/, await up([{ name: 'reminderfox.ics', text: fx.full }, { name: 'prefs.js', text: fx.prefs }])],
      [/addon-sample\.ics$/, await up([{ name: 'addon-sample.ics', text: fx.sample }])],
    ];
    // addon-compat.js names the file next to meta().dataFile, which in the add-on is a label, not a path
    const label = (await window.rf.meta()).dataFile;
    map.push([new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), map[1][1]]);
    const tok = (p) => { for (const [re, t] of map) if (re.test(String(p))) return t; return null; };
    const toks = (files) => [].concat(files).flatMap((f) => tok(f) || [f]);
    const rf = window.rf;
    const { importPath, previewImport, importPaths } = rf;
    rf.importPath = (p) => (tok(p) ? importPaths(tok(p), {}) : importPath(p));
    rf.previewImport = (files) => previewImport(toks(files));
    rf.importPaths = (files, opts) => importPaths(toks(files), opts);
  }, { full: fixture('reminderfox-addon-full.ics'), prefs: fixture('reminderfox-addon-prefs.js'), sample: fixture('reminderfox-addon-sample.ics') });

  // the main page's script
  const code = fs.readFileSync(path.isAbsolute(SCRIPT) ? SCRIPT : fs.existsSync(path.join(__dirname, SCRIPT)) ? path.join(__dirname, SCRIPT) : path.join(ROOT, 'tools', 'ui', SCRIPT), 'utf8');
  try { await main.evaluate(`(async () => {\n${code}\n})()`); } catch (e) { console.log(`E2E ERROR ${SCRIPT}: ${e.message.split('\n')[0]}`); }
  await sleep(1200);
  if (ALARM) {
    const alarm = await waitFor('alarm');
    line('the alarm window opened', !!alarm, true);
    if (alarm) {
      await sleep(1500);
      try { await alarm.evaluate(`(async () => {\n${fs.readFileSync(path.join(ROOT, 'tools', 'ui', ALARM), 'utf8')}\n})()`); } catch (e) { console.log(`E2E ERROR ${ALARM}: ${e.message.split('\n')[0]}`); }
      await sleep(1500);
    }
  }
  if (SCRIPT === 'tb-smoke.js') {
    // what the smoke script did, seen from the background page and the runner
    const s = await bg.evaluate(() => ({ title: window.__mock.state.title, badge: window.__mock.state.badge, notes: window.__mock.state.notes.length, urls: window.__mock.state.urls }));
    const stored = await bg.evaluate(() => browser.storage.local.get('f:reminders.ics').then((r) => r['f:reminders.ics'] || ''));
    line('the new reminder is in storage', /SUMMARY:Smoke test reminder/.test(stored), true);
    line('a daily backup is in storage', await bg.evaluate(() => browser.storage.local.get('f-index').then((r) => Object.keys(r['f-index']).some((n) => /^backups\/reminders-/.test(n)))), true);
    line('toolbar tooltip', s.title.split(' — ')[0], 'ReminderFoxAgain');
    line('toolbar count is a number', /^\d+$/.test(s.badge), true);
    line('a notification for the quick alarm', s.notes >= 1, true);
    line('a map link opens in the system browser', s.urls.some((u) => /^https:\/\//.test(u)), true);
    line('the pop-up window opened', !!find('slider'), true);
    // a Thunderbird shortcut brings the tab forward and does what the desktop key does
    // (the app ignores shortcuts while a dialog is open, so close what the smoke script left open)
    await main.evaluate(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); });
    await bg.evaluate(() => window.__mock.command('new-reminder'));
    await sleep(800);
    line('Alt+Shift+A opens a new reminder', await main.evaluate(() => { const d = document.getElementById('edSummary'); return !!d && d.offsetParent !== null; }), true);
    await main.evaluate(() => document.getElementById('edCancel').click());
    await sleep(500);
    const side = () => main.evaluate(() => document.body.classList.contains('no-side'));
    const before = await side();
    await bg.evaluate(() => window.__mock.command('calendar-panel'));
    await sleep(600);
    line('Alt+Shift+B shows or hides the calendar panel', (await side()) !== before, true);
    await bg.evaluate(() => window.__mock.command('calendar-panel'));
    await sleep(400);
    await bg.evaluate(() => window.__mock.command('alarms'));
    await sleep(800);
    line('Alt+Shift+L opens the Alarms view', await main.evaluate(() => { const d = document.getElementById('alarmsDlg'); const o = !!d && d.open; if (o) d.close(); return o; }), true);
    line('its link says so', await main.evaluate(() => document.getElementById('alarmList').title), 'Every alarm that is ringing, snoozed or still to ring (Alt+Shift+L)');
    await bg.evaluate(() => window.__mock.clickMenu('rf-alarms'));
    await sleep(800);
    line('the toolbar menu\'s Alarms… opens it', await main.evaluate(() => { const d = document.getElementById('alarmsDlg'); const o = !!d && d.open; if (o) d.close(); return o; }), true);
    // right-click on an email → Add reminder…
    const mailItem = await bg.evaluate(() => window.__mock.state.menus.find((m) => m.id === 'rf-mail-reminder'));
    line('"Add reminder…" is on the email menu', mailItem ? `${mailItem.title} [${mailItem.contexts}]` : 'missing', 'Add reminder… [message_list]');
    await bg.evaluate(() => window.__mock.clickMenu('rf-mail-reminder', { selectedMessages: { messages: [{ id: 42, subject: 'Fwd: Car service at the dealer', author: 'Service <service@example.com>', date: new Date().toISOString() }] } }));
    await sleep(1200);
    const ed = await main.evaluate(() => ({ open: document.getElementById('edSummary').offsetParent !== null, summary: document.getElementById('edSummary').value, date: document.getElementById('edDate').value, time: document.getElementById('edTime').value, allDay: document.getElementById('edAllDay').checked, location: (document.getElementById('edLocation') || {}).value }));
    line('the email opens the editor', ed.open, true);
    line('its subject is the description', ed.summary, 'Car service at the dealer');
    line('the date found in the email', ed.date, aheadKey);
    line('the time next to it', `${ed.time}${ed.allDay ? ' (all day)' : ''}`, '08:00');
    line('the place from the email', ed.location, 'Maple Motors service desk, 500 Queen St E, Toronto');
    await main.evaluate(() => document.getElementById('edCancel').click());
    await sleep(300);
    // … or Add list item…: the same email as an item in the list being shown, its date and time the "due by"
    const todoItem = await bg.evaluate(() => window.__mock.state.menus.find((m) => m.id === 'rf-mail-todo'));
    line('"Add list item…" is on the email menu', todoItem ? `${todoItem.title} [${todoItem.contexts}]` : 'missing', 'Add list item… [message_list]');
    await bg.evaluate(() => window.__mock.clickMenu('rf-mail-todo', { selectedMessages: { messages: [{ id: 42, subject: 'Re: Car service at the dealer', date: new Date().toISOString(), headerMessageId: 'car-service.42@dealer.example.com' }] } }));
    await sleep(1200);
    const td = await main.evaluate(() => ({ open: document.getElementById('edSummary').offsetParent !== null, summary: document.getElementById('edSummary').value, noDateShown: document.getElementById('edNoDate').offsetParent !== null, noDate: document.getElementById('edNoDate').checked, date: document.getElementById('edDate').value, time: document.getElementById('edTime').value, allDay: document.getElementById('edAllDay').checked }));
    line('the email opens a list item', td.open && td.noDateShown, true);
    line('list item: the subject', td.summary, 'Car service at the dealer');
    line('list item: due by date', td.noDate ? 'no date' : td.date, aheadKey);
    line('list item: due by time', `${td.time}${td.allDay ? ' (all day)' : ''}`, '08:00');
    // the item made from an email can open it: the editor's button, and after saving, the row's right-click menu
    line('the editor offers "Open email"', await main.evaluate(() => !document.getElementById('edMail').classList.contains('hidden')), true);
    await main.evaluate(() => document.getElementById('edMail').click());
    await sleep(500);
    line('"Open email" opens it in Thunderbird', (await bg.evaluate(() => window.__mock.state.openedEmails || [])).join(','), 'car-service.42@dealer.example.com');
    await main.evaluate(() => document.getElementById('edSave').click());
    await sleep(800);
    const saved = await main.evaluate(async () => (await window.rf.all()).find((d) => d.summary === 'Car service at the dealer' && d.kind === 'todo'));
    line('the saved list item keeps its email', saved && saved.messageId, '<car-service.42@dealer.example.com>');
    const ctxHas = await main.evaluate(async (uid) => {
      await window.__rf.setTab('todos'); await new Promise((r) => setTimeout(r, 500));
      const row = [...document.querySelectorAll('#listView tbody tr')].find((tr) => tr.dataset.uid === uid);
      if (!row) return 'row not shown';
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
      await new Promise((r) => setTimeout(r, 300));
      const has = !!document.querySelector('.ctx:not(.hidden) button[data-ctx="mail"]');
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      return has;
    }, saved && saved.uid);
    line('its right-click menu has "Open email"', ctxHas, true);
    const plain = await main.evaluate(async () => { await window.__rf.openEditor({ kind: 'event' }); await new Promise((r) => setTimeout(r, 300)); const h = document.getElementById('edMail').classList.contains('hidden'); document.getElementById('edCancel').click(); return h; });
    line('an item not from an email has no "Open email"', plain, true);
    const gone = await main.evaluate(async () => { try { await window.rf.openEmail('<deleted@example.com>'); return 'opened'; } catch (e) { return e.message.split('.')[0]; } });
    line('a deleted email says so', gone, 'The email this came from was not found');
    await sleep(300);
    await thunderbirdOnly(saved);
    const alarm = await waitFor('alarm', 6000);
    line('the alarm window opened for the quick alarm', !!alarm, true);
    if (alarm) {
      await sleep(1500);
      line('the alarm window lists it', await alarm.evaluate(() => document.body.innerText.includes('Smoke test quick alarm')), true);
      await alarm.evaluate(() => window.rf.dismissAll());
      await sleep(1500);
      line('the alarm window closes when nothing is due', !find('alarm'), true);
    }
  }
  // ---------------------------------------------------------------- what only Thunderbird makes possible
  async function thunderbirdOnly(saved) {
    const st = () => bg.evaluate(() => JSON.parse(JSON.stringify(window.__mock.state)));
    const closeAll = () => main.evaluate(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); });
    const editor = () => main.evaluate(() => ({ open: document.getElementById('edSummary').offsetParent !== null, summary: document.getElementById('edSummary').value, date: document.getElementById('edDate').value, time: document.getElementById('edTime').value, allDay: document.getElementById('edAllDay').checked, mail: !document.getElementById('edMail').classList.contains('hidden') }));
    // 2. the email the list item came from has the ReminderFoxAgain tag (its own tags kept); done, the tag goes
    await sleep(2200);
    let s = await st();
    line('tags: the ReminderFoxAgain tag exists', s.tags.map((x) => `${x.key}/${x.tag}/${x.color}`).join(','), 'reminderfoxagain/ReminderFoxAgain/#E26E26');
    line('tags: the email has it', s.library['car-service.42@dealer.example.com'].tags.join(','), '$label1,reminderfoxagain');
    await main.evaluate((uid) => window.rf.complete(uid, true), saved.uid);
    await sleep(2200);
    s = await st();
    line('tags: done, the tag goes', s.library['car-service.42@dealer.example.com'].tags.join(','), '$label1');
    await main.evaluate((uid) => window.rf.complete(uid, false), saved.uid);
    await main.evaluate(() => window.rf.setSettings({ tbTagEmails: false }));
    await sleep(2200);
    line('tags: turned off in Settings, no tags', (await st()).library['car-service.42@dealer.example.com'].tags.join(','), '$label1');
    line('tags: the setting is in Settings → General', await main.evaluate(() => { const c = document.getElementById('stTbTags'); return !!c && c.checked === false; }), true);
    await main.evaluate(() => window.rf.setSettings({ tbTagEmails: true }));
    await sleep(2200);
    line('tags: turned on again', (await st()).library['car-service.42@dealer.example.com'].tags.join(','), '$label1,reminderfoxagain');

    // 3. an item as an email: a new message with the item as text and as an .ics
    const sendMenu = await main.evaluate(async (uid) => {
      const row = [...document.querySelectorAll('#listView tbody tr')].find((tr) => tr.dataset.uid === uid);
      if (!row) return 'row not shown';
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
      await new Promise((r) => setTimeout(r, 300));
      const b = document.querySelector('.ctx:not(.hidden) button[data-ctx="send"]');
      const inv = !!document.querySelector('.ctx:not(.hidden) button[data-ctx="invite"]');
      if (b) b.click();
      return b ? `send${inv ? ' + invite' : ''}` : 'missing';
    }, saved.uid);
    line('a list item\'s right-click menu has "Send by email…" (no "Invite people…")', sendMenu, 'send');
    await sleep(800);
    s = await st();
    let m = s.composed[s.composed.length - 1] || {};
    line('send by email: the subject', m.subject, 'Car service at the dealer');
    line('send by email: plain text naming it', m.isPlainText === true && /^Car service at the dealer\n/.test(m.plainTextBody || ''), true);
    const a0 = (m.attachments || [])[0] || {};
    line('send by email: the .ics attached', `${a0.name} ${a0.type && a0.type.split(';')[0]} ${/SUMMARY:Car service at the dealer/.test(a0.text || '')}`, 'Car service at the dealer.ics text/calendar true');

    // 6. invitations: from the person's account, to the addresses given, the item records them; replies are read
    await closeAll();
    const ev = await main.evaluate(async () => { const d = await window.rf.save({ kind: 'event', summary: 'Book club', date: '2030-03-05', time: '19:00', allDay: false }); return d && d.uid ? d.uid : (await window.rf.all()).find((x) => x.summary === 'Book club').uid; });
    line('invite: suggestions from the address books', (await main.evaluate(() => window.rf.contacts('ana'))).map((c) => `${c.name} <${c.email}>`).join(','), 'Ana Lima <ana@example.com>');
    await main.evaluate((uid) => window.rf.invite(uid), ev);
    await sleep(400);
    line('invite: the dialog opens', await main.evaluate(() => document.getElementById('tbInvite').open), true);
    await main.evaluate(() => { document.getElementById('tbInvTo').value = 'ana@example.com, Ben@Example.com, ana@example.com'; document.getElementById('tbInvGo').click(); });
    await sleep(1000);
    s = await st();
    m = s.composed[s.composed.length - 1] || {};
    const inv = (m.attachments || [])[0] || {};
    const unfold = (t) => String(t || '').replace(/\r?\n[ \t]/g, '');
    line('invite: the dialog closes', await main.evaluate(() => document.getElementById('tbInvite').open), false);
    line('invite: from the account, to each address once', `${m.identityId} → ${(m.to || []).join(', ')}`, 'id1 → ana@example.com, ben@example.com');
    line('invite: the subject', m.subject, 'Invitation: Book club');
    line('invite: an iCalendar request', `${inv.name} ${/method=REQUEST/i.test(inv.type || '')} ${/METHOD:REQUEST/.test(inv.text || '')}`, 'invite.ics true true');
    line('invite: organizer and attendees in it', /ORGANIZER;CN=Leo Park:mailto:leo@example\.com/i.test(unfold(inv.text)) && (unfold(inv.text).match(/ATTENDEE[^\n]*PARTSTAT=NEEDS-ACTION[^\n]*RSVP=TRUE/g) || []).length === 2, true);
    let dto = await main.evaluate((uid) => window.rf.get(uid), ev);
    line('invite: the reminder records them', dto.attendees.map((p) => `${p.email}:${p.status}`).join(','), 'ana@example.com:needs-action,ben@example.com:needs-action');
    // a reply arrives: Ana accepts
    const uidLine = (/^UID:(.*)$/m.exec(unfold(inv.text)) || [])[1].trim();
    const reply = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Example//Mail//EN', 'METHOD:REPLY', 'BEGIN:VEVENT', `UID:${uidLine}`, 'DTSTAMP:20300101T000000Z',
      'ATTENDEE;PARTSTAT=ACCEPTED;CN=Ana Lima:mailto:ana@example.com', 'ORGANIZER:mailto:leo@example.com', 'SUMMARY:Book club', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const notesBefore = s.notes.length;
    await bg.evaluate(([r]) => { window.__mock.addMessage(77, { contentType: 'multipart/mixed', parts: [{ contentType: 'text/plain', body: 'Accepted: Book club' }, { contentType: 'text/calendar; method=REPLY', body: r }] }); return window.__mock.newMail([77]); }, [reply]);
    await sleep(800);
    dto = await main.evaluate((uid) => window.rf.get(uid), ev);
    line('reply: the answer is recorded', dto.attendees.map((p) => `${p.email}:${p.status}`).join(','), 'ana@example.com:accepted,ben@example.com:needs-action');
    s = await st();
    line('reply: a notification says so', s.notes.length > notesBefore && `${s.notes[s.notes.length - 1].title}`, 'Ana Lima: accepted');
    await main.evaluate((uid) => window.__rf.openEditor({ uid }), ev);
    await sleep(500);
    line('the editor shows who is invited', await main.evaluate(() => { const r = document.getElementById('edAttendeesRow'); return r.offsetParent !== null && document.getElementById('edAttendees').textContent; }), 'Ana Lima (accepted), ben@example.com (no answer yet)');
    await main.evaluate(() => document.getElementById('edCancel').click());
    await sleep(300);

    // 4. birthdays from the address books: on in Settings, one yearly reminder per contact with a birthday
    await main.evaluate(() => window.rf.setSettings({ tbBirthdays: true }));
    await sleep(2800);
    const bdays = async () => (await main.evaluate(() => window.rf.all())).filter((d) => /^contact-/.test(d.uid)).map((d) => `${d.summary} on ${d.date} ${d.repeat && d.repeat.freq} [${d.categories}]`).sort();
    let b = await bdays();
    line('birthdays: one per contact with a birthday', b.length, 2);
    line('birthdays: name, year and date', b.map((x) => x.split(' YEARLY')[0]).join(' | '), "Ana Lima's birthday <1990> on 1990-03-14 | Ben Ortiz's birthday on 2000-07-02");
    line('birthdays: every year', b.every((x) => / YEARLY \[Birthday\]$/.test(x)), true);
    await bg.evaluate(() => window.__mock.contactChanged());
    await sleep(2800);
    line('birthdays: a contact change keeps one each', (await bdays()).length, 2);
    await main.evaluate(() => window.rf.setSettings({ tbBirthdays: false }));

    // 5. text selected in an email → Add reminder…, linked to that email
    const sel = await bg.evaluate(() => window.__mock.state.menus.filter((x) => /^rf-(sel|link)-/.test(x.id)).map((x) => `${x.title} [${x.contexts}]`).join(' | '));
    line('the selection and link menus', sel, 'Add reminder… [selection] | Add list item… [selection] | Import this calendar… [link]');
    await closeAll();
    await bg.evaluate(([w]) => window.__mock.clickMenu('rf-sel-reminder', { selectionText: `Team lunch with Ana\non ${w} at 12:30 pm, Corner Bistro` }, { id: 3, type: 'messageDisplay' }), [aheadWords]);
    await sleep(1200);
    const se = await editor();
    line('selected text opens the editor', se.open, true);
    line('selection: its first line is the description', se.summary, 'Team lunch with Ana');
    line('selection: the date and time in it', `${se.date} ${se.time}${se.allDay ? ' (all day)' : ''}`, `${aheadKey} 12:30`);
    line('selection: linked to the email shown', se.mail, true);
    await main.evaluate(() => document.getElementById('edCancel').click());
    await sleep(300);

    // 5. an .ics link in an email → Import this calendar…: asks for that site, reads it, the import dialog opens with it
    await bg.evaluate(([u]) => window.__mock.clickMenu('rf-link-ics', { linkUrl: u }), [`${origin}/_cal/team.ics`]);
    await sleep(1500);
    line('.ics link: permission asked for that site only', (await st()).permissions.join(','), `${origin}/*`);
    const imp = await main.evaluate(() => { const d = document.getElementById('importDlg'); return d && d.open ? d.querySelector('b').textContent : 'not open'; });
    line('.ics link: the import dialog opens with it', imp, 'team.ics');
    await main.evaluate(() => document.getElementById('imGo').click());
    await sleep(1000);
    line('.ics link: imported', await main.evaluate(async () => (await window.rf.all()).some((d) => d.summary === 'Team offsite at the lake')), true);
    await closeAll();

    // 1. Send++: "Remind me" in the compose window, then send: the editor opens for a reminder linked to the sent email
    s = await st();
    line('Send++: the compose button\'s tooltip', s.composeTitle, 'After sending, add a reminder for this email');
    await bg.evaluate(() => window.__mock.send(9, { subject: 'Not remembered', plainTextBody: 'x' }, { mode: 'sendNow', headerMessageId: 'x@example.com' }));
    await sleep(800);
    line('Send++: without "Remind me", sending does nothing', (await editor()).open, false);
    await bg.evaluate(() => window.__mock.clickCompose(9));
    line('Send++: the button shows it is on', (await st()).compose['9'], '✓');
    await bg.evaluate(([w]) => window.__mock.send(9, { subject: 'Quarterly report draft', plainTextBody: `Hi Ana,\nPlease send your comments by ${w}.\nLeo` }, { mode: 'sendNow', messages: [{ id: 90, headerMessageId: 'report.90@example.com' }] }), [aheadWords]);
    await sleep(1200);
    const sp = await editor();
    line('Send++: after sending, the editor opens', sp.open, true);
    line('Send++: the subject and the date in the email', `${sp.summary} ${sp.date}`, `Quarterly report draft ${aheadKey}`);
    line('Send++: linked to the sent email', sp.mail, true);
    await main.evaluate(() => document.getElementById('edCancel').click());
    await sleep(300);
  }

  const shot = process.env.RF_TB_SCREENSHOT;
  if (shot) await main.screenshot({ path: shot });
  pumping = false;
  await pump;
  for (const e of [...new Set(errors)].slice(0, 10)) console.log(`E2E ERROR page error: ${e}`);
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch((e) => { console.log(`E2E ERROR ${e.stack || e}`); process.exit(1); });
