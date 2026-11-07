'use strict';
// Runs the Android app's web part (mobile/www, built by mobile/build-web.js) in Chromium and runs UI check scripts in
// it: the desktop's tools/ui/*.js and the Android checks in this folder. The Capacitor plugins use their web versions
// here (files in IndexedDB; notifications are recorded, not shown), so this checks the pages, the host and the phone
// layout; the native parts are checked on a device (mobile/README.md).
//   node mobile/test/run.js [--size 390x844] [--lang de] [--sample basic|bills|empty] [--alarm alarm-script.js] script.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const WWW = path.join(ROOT, 'mobile', 'www');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const SIZE = opt('size', '1180x760').split('x').map(Number);
const LANG = opt('lang', '');
const SAMPLE = opt('sample', 'basic');
const ALARM = opt('alarm', '');
const SCRIPT = args[0] || 'none.js';
const SHOT = process.env.RF_ANDROID_SCREENSHOT || '';
const sleep = (t) => new Promise((r) => setTimeout(r, t));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
function serve() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/_cal/huge.ics') { res.setHeader('access-control-allow-origin', '*'); require(path.join(ROOT, 'tools', 'sample-calendar.js')).sendHuge(res); return; }
    if (u.pathname === '/_cal/holidays.ics') { res.writeHead(200, { 'content-type': 'text/calendar', 'access-control-allow-origin': '*' }); res.end(require(path.join(ROOT, 'tools', 'sample-calendar.js')).text()); return; }
    const p = path.join(WWW, decodeURIComponent(u.pathname));
    if (!p.startsWith(WWW) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(fs.readFileSync(p));
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

(async () => {
  if (!fs.existsSync(path.join(WWW, 'src', 'ui', 'index.html'))) throw new Error('Build it first: node mobile/build-web.js');
  // the same made-up sample data as the desktop checks
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-android-'));
  if (SAMPLE !== 'empty') execFileSync('node', [path.join(ROOT, 'tools', 'sample-data.js'), tmp, SAMPLE], { stdio: 'ignore' });
  const seed = {};
  for (const f of ['reminders.ics', 'state.json']) if (fs.existsSync(path.join(tmp, f))) seed[f] = fs.readFileSync(path.join(tmp, f), 'utf8');
  if (LANG) { const s = seed['state.json'] ? JSON.parse(seed['state.json']) : {}; s.settings = { ...(s.settings || {}), language: LANG }; seed['state.json'] = JSON.stringify(s); }

  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const touch = SIZE[0] < 1000;
  const ctx = await browser.newContext({ viewport: { width: SIZE[0], height: SIZE[1] }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1, locale: 'en-CA' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('E2E')) console.log(t); else if (m.type() === 'error' && !/favicon|Failed to load resource|Not implemented on web|not implemented/i.test(t)) errors.push(t); });
  page.on('pageerror', (e) => errors.push(e.message));

  // put the sample data where the app keeps its files (the web Filesystem), then start it again with it
  await page.goto(`${origin}/src/ui/index.html`);
  await page.waitForFunction(() => window.RFHOST && window.__rf, null, { timeout: 15000 });
  await page.evaluate(async () => window.RFHOST.started());
  await page.evaluate(async (files) => {
    const C = window.RFCap;
    const idx = {};
    for (const [name, text] of Object.entries(files)) {
      await C.Filesystem.writeFile({ path: `rfa/${name}`, data: text, directory: C.Directory.Data, encoding: C.Encoding.UTF8, recursive: true });
      idx[name] = { size: text.length, mtime: Date.now() };
    }
    for (const name of ['archive.ics']) { try { await C.Filesystem.deleteFile({ path: `rfa/${name}`, directory: C.Directory.Data }); } catch (e) { /* none */ } }
    await C.Filesystem.writeFile({ path: 'rfa/files.json', data: JSON.stringify(idx), directory: C.Directory.Data, encoding: C.Encoding.UTF8, recursive: true });
    if (!Object.keys(files).length) { // a brand-new installation
      const all = await C.Filesystem.readdir({ path: 'rfa', directory: C.Directory.Data }).catch(() => ({ files: [] }));
      for (const f of all.files) if (f.type === 'file') await C.Filesystem.deleteFile({ path: `rfa/${f.name}`, directory: C.Directory.Data }).catch(() => {});
    }
    try { localStorage.removeItem('rf.i18n'); } catch (e) { /* none */ }
  }, seed);
  await page.reload();
  await page.waitForFunction(() => window.RFHOST && window.__rf && document.querySelector('.tabs'), null, { timeout: 15000 });
  await page.evaluate(async () => window.RFHOST.started());
  if (LANG) { // the host found the language: the page loads once more in it
    await sleep(1500);
    await page.waitForFunction(() => window.RFHOST && window.__rf && document.querySelector('.tabs'), null, { timeout: 15000 });
    await page.evaluate(async () => window.RFHOST.started());
  }
  await sleep(2000);

  // the import scripts name files on disk: here they are the fixtures, handed over as the file picker would
  const fixture = (f) => fs.readFileSync(path.join(ROOT, 'test', f), 'utf8');
  await page.evaluate(async (fx) => {
    const up = async (files) => (await browser.runtime.sendMessage({ rf: 'call', ch: 'upload', args: [files] })).value;
    const map = [
      [/addon-profile\/reminderfox\/reminderfox\.ics$/, await up([{ name: 'reminderfox.ics', text: fx.full }, { name: 'prefs.js', text: fx.prefs }])],
      [/addon-sample\.ics$/, await up([{ name: 'addon-sample.ics', text: fx.sample }])],
    ];
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

  const code = fs.readFileSync(path.isAbsolute(SCRIPT) ? SCRIPT : fs.existsSync(path.join(__dirname, SCRIPT)) ? path.join(__dirname, SCRIPT) : path.join(ROOT, 'tools', 'ui', SCRIPT), 'utf8');
  try { await page.evaluate(`(async () => {\n${code}\n})()`); } catch (e) { console.log(`E2E ERROR ${SCRIPT}: ${e.message.split('\n')[0]}`); }
  await sleep(1200);
  if (ALARM) {
    let frame = null;
    for (let t = 0; t < 8000 && !frame; t += 100) { frame = page.frames().find((f) => /alarm\.html/.test(f.url())); if (!frame) await sleep(100); }
    console.log(`E2E ANDROID the alarm sheet opened: ${!!frame} (expected true)${frame ? '' : '  WRONG'}`);
    if (frame) {
      await sleep(1500);
      try { await frame.evaluate(`(async () => {\n${fs.readFileSync(path.join(ROOT, 'tools', 'ui', ALARM), 'utf8')}\n})()`); } catch (e) { console.log(`E2E ERROR ${ALARM}: ${e.message.split('\n')[0]}`); }
      await sleep(1500);
    }
  }
  if (SHOT) await page.screenshot({ path: SHOT });
  for (const e of errors.slice(0, 5)) console.log(`E2E ERROR page: ${e}`);
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch((e) => { console.log(`E2E ERROR run: ${e.message}`); process.exit(1); });
