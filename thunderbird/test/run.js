'use strict';
// Runs the built Thunderbird add-on (dist/thunderbird) in Chromium with a mock of Thunderbird's WebExtension API
// (mock-browser.js), and runs UI check scripts from tools/ui/ in its pages, as tools/e2e.sh does for the desktop app.
//   node thunderbird/test/run.js [--size 1180x760] [--lang de] [--sample basic|bills] [--alarm alarm-script.js] main-script.js
// Prints the scripts' "E2E …" lines plus the add-on's own checks ("E2E TB …"). Not a real Thunderbird: see
// docs/thunderbird-addon.md for what is still to be tried there.
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
  [/^E2E Settings → Data has import, ReminderFox, export: false/, 'the add-on hides "Import from ReminderFox…" (it cannot search other profiles)'],
];
function expected(t) {
  for (const [re, why] of DIFFERENT) if (re.test(t) && t.endsWith('  WRONG')) return `${t.slice(0, -7)}  (different on purpose: ${why})`;
  return t;
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain' };
function serve() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
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
  execFileSync('node', [path.join(ROOT, 'tools', 'sample-data.js'), tmp, SAMPLE], { stdio: 'ignore' });
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
  await ctx.addInitScript({ content: `window.__seed = ${JSON.stringify({ storage, os: 'linux', uiLanguage: 'en-CA' })};\n${fs.readFileSync(path.join(__dirname, 'mock-browser.js'), 'utf8')}` });
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
  const menu = await bg.evaluate(() => window.__mock.state.menus.filter((m) => m.type !== 'separator').map((m) => m.title).join(' | '));
  if (!LANG) line('toolbar menu', menu, "Open ReminderFoxAgain | Add reminder… | Add list item… | Quick alarm… | Suspend alarms… | Show today's reminders");
  await bg.evaluate(() => window.__mock.clickButton());
  const main = await waitFor('index');
  line('the toolbar button opens the main tab', !!main, true);
  if (!main) throw new Error('no main tab');
  await main.waitForFunction(() => window.__rf && document.querySelector('.tabs'), null, { timeout: 15000 });
  await sleep(2500);
  if (SCRIPT === 'tb-smoke.js') {
    line('desktop settings hidden', await main.evaluate(() => ['stStart', 'stTray', 'stFolder', 'stBackups', 'stOldRf', 'stPath'].map((id) => document.getElementById(id)).filter((el) => el && el.offsetParent !== null).length), 0);
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
  const shot = process.env.RF_TB_SCREENSHOT;
  if (shot) await main.screenshot({ path: shot });
  pumping = false;
  await pump;
  for (const e of [...new Set(errors)].slice(0, 10)) console.log(`E2E ERROR page error: ${e}`);
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch((e) => { console.log(`E2E ERROR ${e.stack || e}`); process.exit(1); });
