'use strict';
// Builds mobile/www/, the web part of the Android app (Capacitor's webDir):
//   www/index.html          opens src/ui/index.html
//   www/src/ui/             the shared pages (src/ui), with the Android scripts and styles added
//   www/m/cap.js            the Capacitor plugins (esbuild)
//   www/m/host.js           the host core, the data layer, translations and ical.js (esbuild)
//   www/m/*.js, android.css the Android host, the shim, the add-on's bridge, the page overlay
//   www/assets/icon.png
// node mobile/build-web.js   (the same files every time)
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'www');
const VER = require('../package.json').version;
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
function write(rel, data) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
}
const copy = (from, to) => write(to || from, fs.readFileSync(path.join(ROOT, from)));

fs.rmSync(OUT, { recursive: true, force: true });

// ------------------------------------------------------------ the bundles
const common = { bundle: true, format: 'iife', platform: 'browser', target: 'es2020', minify: false, legalComments: 'inline', write: false, logLevel: 'error', absWorkingDir: ROOT };
const cap = esbuild.buildSync({ ...common, entryPoints: ['mobile/src/plugins.js'], nodePaths: [path.join(__dirname, 'node_modules')] });
write('m/cap.js', `// ReminderFoxAgain ${VER} for Android — Capacitor and its plugins (MIT), bundled by mobile/build-web.js\n${cap.outputFiles[0].text}`);
const host = esbuild.buildSync({
  ...common,
  entryPoints: ['src/host/core.js'],
  globalName: 'RFHost',
  alias: { crypto: './mobile/src/crypto-shim.js' },
  banner: { js: `// ReminderFoxAgain ${VER} for Android — the host core (src/host/core.js), the data layer, translations and\n// ical.js ${require('../node_modules/ical.js/package.json').version} (MPL-2.0), bundled by mobile/build-web.js\nself.RF_VERSION = ${JSON.stringify(VER)};` },
});
write('m/host.js', host.outputFiles[0].text);

// ------------------------------------------------------------ the Android scripts and the add-on's bridge
for (const f of ['shim.js', 'android-host.js', 'android-page.js', 'android.js', 'android.css']) write(`m/${f}`, rd(`mobile/src/${f}`));
write('m/bridge.js', rd('thunderbird/bridge.js'));

// ------------------------------------------------------------ the pages
const UI = 'src/ui';
for (const f of fs.readdirSync(path.join(ROOT, UI)).sort()) {
  const rel = `${UI}/${f}`;
  if (fs.statSync(path.join(ROOT, rel)).isDirectory()) continue;
  if (!f.endsWith('.html')) { copy(rel); continue; }
  let html = rd(rel);
  const first = '<script src="i18n.js"></script>';
  if (!html.includes(first)) throw new Error(`${rel}: no ${first}`);
  // every page: the shim and the bridge first; the main page also runs the host, before them
  const before = f === 'index.html'
    ? '<script src="../../m/cap.js"></script>\n<script src="../../m/host.js"></script>\n<script src="../../m/android-host.js"></script>\n'
    : '';
  html = html.replace(first, `${before}<script src="../../m/shim.js"></script>\n<script src="../../m/bridge.js"></script>\n<script src="../../m/android-page.js"></script>\n${first}`);
  // the calendars a person subscribes to are fetched from their web sites
  html = html.replace("default-src 'self';", "default-src 'self'; connect-src 'self' https: http:;");
  html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
  if (f === 'index.html') {
    html = html.replace('<link rel="stylesheet" href="themes.css">', '<link rel="stylesheet" href="themes.css">\n<link rel="stylesheet" href="../../m/android.css">');
    html = html.replace('<script src="features.js"></script>', '<script src="features.js"></script>\n<script src="../../m/android.js"></script>');
    if (!html.includes('m/android.css') || !html.includes('m/android.js')) throw new Error('index.html: overlay not added');
  }
  write(rel, html);
}
for (const f of fs.readdirSync(path.join(ROOT, UI, 'locales')).sort()) copy(`${UI}/locales/${f}`);
copy('assets/icon.png');
write('index.html', '<!doctype html>\n<meta charset="utf-8">\n<meta http-equiv="refresh" content="0; url=src/ui/index.html">\n<title>ReminderFoxAgain</title>\n');
console.log(`www/ for ReminderFoxAgain ${VER}`);
