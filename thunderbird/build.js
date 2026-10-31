'use strict';
// Builds the experimental Thunderbird add-on:
//   dist/thunderbird/                                   the unpacked add-on (load it from about:debugging)
//   dist/release-thunderbird/ReminderFoxAgain-<ver>-thunderbird.xpi
// node thunderbird/build.js   (run by build-thunderbird.sh, which also zips it deterministically)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'thunderbird');
const VER = require('../package.json').version;
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
function write(rel, data) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
}
const copy = (from, to) => write(to || from, fs.readFileSync(path.join(ROOT, from)));

fs.rmSync(OUT, { recursive: true, force: true });

// ------------------------------------------------------------ host.js: the core, the store, ical.js and i18n in one file
// A small CommonJS loader: each module gets module/exports/require; require maps the few names the modules use.
const MODULES = {
  core: { file: 'src/host/core.js', req: { '../core/store': 'store', '../ui/i18n.js': 'i18n' } },
  store: { file: 'src/core/store.js', req: { crypto: 'crypto', 'ical.js': 'ical' } },
  i18n: { file: 'src/ui/i18n.js', req: {} },
  ical: { file: 'node_modules/ical.js/dist/ical.es5.cjs', req: {} },
};
let bundle = `// ReminderFoxAgain ${VER} for Thunderbird — the host core, the data layer (src/core/store.js), translations
// (src/ui/i18n.js) and ical.js ${require('../node_modules/ical.js/package.json').version} (MPL-2.0), bundled by thunderbird/build.js.
(function () {
'use strict';
const defs = {};
const cache = { crypto: { exports: { randomUUID: () => self.crypto.randomUUID() } } };
function load(id) {
  if (cache[id]) return cache[id].exports;
  const module = { exports: {} };
  cache[id] = module;
  defs[id].fn.call(self, module, module.exports, (name) => {
    const to = defs[id].req[name];
    if (!to) throw new Error('Cannot find module ' + name);
    return load(to);
  });
  return module.exports;
}
`;
for (const [id, m] of Object.entries(MODULES)) {
  bundle += `defs[${JSON.stringify(id)}] = { req: ${JSON.stringify(m.req)}, fn: function (module, exports, require) {\n${rd(m.file)}\n} };\n`;
}
bundle += `self.RF_VERSION = ${JSON.stringify(VER)};\nself.RFHost = load('core');\n}());\n`;
write('host.js', bundle);

// ------------------------------------------------------------ the background page, the bridge, the overlay
for (const f of ['background.js', 'bridge.js', 'tb.js', 'tb.css']) write(`tb/${f}`, rd(`thunderbird/${f}`));

// ------------------------------------------------------------ the pages: src/ui as it is, with the bridge loaded first
const UI = 'src/ui';
for (const f of fs.readdirSync(path.join(ROOT, UI))) {
  const rel = `${UI}/${f}`;
  if (fs.statSync(path.join(ROOT, rel)).isDirectory()) continue;
  if (!f.endsWith('.html')) { copy(rel); continue; }
  let html = rd(rel);
  const first = '<script src="i18n.js"></script>';
  if (!html.includes(first)) throw new Error(`${rel}: no ${first}`);
  html = html.replace(first, `<script src="../../tb/bridge.js"></script>\n${first}`);
  if (f === 'index.html') {
    html = html.replace('<link rel="stylesheet" href="themes.css">', '<link rel="stylesheet" href="themes.css">\n<link rel="stylesheet" href="../../tb/tb.css">');
    html = html.replace('<script src="features.js"></script>', '<script src="features.js"></script>\n<script src="../../tb/tb.js"></script>');
    if (!html.includes('tb/tb.css') || !html.includes('tb/tb.js')) throw new Error('index.html: overlay not added');
  }
  write(rel, html);
}
for (const f of fs.readdirSync(path.join(ROOT, UI, 'locales')).sort()) copy(`${UI}/locales/${f}`);

// ------------------------------------------------------------ icons, licence
copy('assets/icon.png');
const SIZES = [16, 32, 48, 64, 128];
for (const s of SIZES) copy(`build-prompt/reference/assets/png/icon-${s}.png`, `assets/tb/icon-${s}.png`);
copy('LICENSE', 'LICENSE.txt');

// ------------------------------------------------------------ manifest
const icons = Object.fromEntries(SIZES.map((s) => [String(s), `assets/tb/icon-${s}.png`]));
const manifest = {
  manifest_version: 2,
  name: 'ReminderFoxAgain',
  version: VER,
  description: 'Reminders, to-dos and pop-up alarms in Thunderbird — a tribute to the ReminderFox add-on. It reads and writes ReminderFox\'s own iCalendar file.',
  author: 'David',
  homepage_url: 'https://github.com/rdavidlow-ux/reminderfoxagain',
  // it collects nothing: everything stays in the Thunderbird profile
  browser_specific_settings: { gecko: { id: 'reminderfoxagain@rdavidlow-ux.github.io', strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } } },
  icons,
  browser_action: { default_title: 'ReminderFoxAgain', default_icon: { 16: icons[16], 32: icons[32] } },
  background: { scripts: ['host.js', 'tb/background.js'] },
  permissions: ['storage', 'unlimitedStorage', 'notifications', 'menus', 'tabs', 'idle'],
};
write('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`dist/thunderbird: ReminderFoxAgain ${VER} for Thunderbird`);
