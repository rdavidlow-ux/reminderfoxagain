'use strict';
// Builds src/ui/locales/<code>.json from tools/i18n/catalog.txt (the English keys) and tools/i18n/<code>.txt (one
// translation per line, in the catalog's order). Checks that every line keeps the key's {placeholders}.
//   node tools/i18n/build.js            all languages that have a .txt
//   node tools/i18n/build.js de fr      just these
//   node tools/i18n/build.js --pseudo de   writes a pseudo-translation (⟦…⟧) as de.json, for finding untranslated text
const fs = require('fs');
const path = require('path');
const I18N = require('../../src/ui/i18n.js');
const DIR = __dirname;
const OUT = path.join(DIR, '..', '..', 'src', 'ui', 'locales');

function catalog() {
  return fs.readFileSync(path.join(DIR, 'catalog.txt'), 'utf8').split('\n').map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.split(' || '));
}
const holders = (s) => (String(s).match(/\{[a-z][a-z0-9]*\}/gi) || []).sort();
const numeric = (h) => /^\{n\d*\}$/.test(h);

function parse(line) {
  if (!/^(zero|one|two|few|many|other)=/.test(line)) return line;
  const v = {};
  for (const part of line.split(' | ')) {
    const m = /^(zero|one|two|few|many|other)=(.*)$/s.exec(part);
    if (!m) throw new Error(`bad plural part "${part}"`);
    v[m[1]] = m[2];
  }
  if (v.other == null) throw new Error('plural forms need other=');
  return v;
}

function build(code, pseudo) {
  const keys = catalog();
  let lines;
  if (pseudo) lines = keys.map(([k]) => `⟦${k}⟧`);
  else lines = fs.readFileSync(path.join(DIR, `${code}.txt`), 'utf8').split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim() && !l.startsWith('#'));
  const problems = [];
  // each line is "<number>| <translation>", numbered as in the catalog, so a missing or extra line can't shift the rest
  lines = lines.map((l, i) => {
    const m = /^(\d+)\| ?(.*)$/s.exec(l);
    if (!m) return l;
    if (Number(m[1]) !== i + 1) problems.push(`line ${i + 1} is numbered ${m[1]}`);
    return m[2];
  });
  if (lines.length !== keys.length) problems.push(`${lines.length} lines for ${keys.length} keys`);
  const dict = { '@language': code, '@note': pseudo ? 'pseudo-translation for testing' : 'Built from tools/i18n — edit the .txt there, not this file.' };
  keys.forEach((aliases, i) => {
    const raw = lines[i];
    if (raw == null) return;
    let v;
    try { v = parse(raw); } catch (e) { problems.push(`line ${i + 1}: ${e.message}`); return; }
    if (v === '' || v === '-') return; // not translated: the English shows
    const want = holders(aliases[aliases.length - 1]).filter((h) => !numeric(h));
    for (const form of typeof v === 'string' ? [v] : Object.values(v)) {
      const got = holders(form);
      if (/\{(?![a-z][a-z0-9]*\})|(^|[^}])\}(?<!\{[a-z][a-z0-9]*\})/i.test(form.replace(/\{[a-z][a-z0-9]*\}/gi, ''))) problems.push(`line ${i + 1} (${aliases[0]}): stray brace in "${form}"`);
      for (const h of want) if (!got.includes(h)) problems.push(`line ${i + 1} (${aliases[0]}): missing ${h} in "${form}"`);
      for (const h of got) if (!holders(aliases[aliases.length - 1]).includes(h) && !(aliases[0] === '{n}th' && h === '{n}')) problems.push(`line ${i + 1} (${aliases[0]}): unknown ${h} in "${form}"`);
    }
    if (v === '' || v === '-') return; // not translated: the English shows
    for (const k of aliases) dict[k] = v;
  });
  return { dict, problems };
}

const args = process.argv.slice(2);
const pseudo = args[0] === '--pseudo';
const codes = pseudo ? args.slice(1) : args.length ? args : fs.readdirSync(DIR).filter((f) => /\.txt$/.test(f) && f !== 'catalog.txt').map((f) => f.slice(0, -4));
let bad = 0;
fs.mkdirSync(OUT, { recursive: true });
for (const code of codes) {
  if (!I18N.CODES.includes(code) || code === 'en') { console.error(`${code}: not one of the app's languages`); bad++; continue; }
  const { dict, problems } = build(code, pseudo);
  for (const p of problems) console.error(`${code}: ${p}`);
  if (problems.length) bad++;
  fs.writeFileSync(path.join(OUT, `${code}.json`), `${JSON.stringify(dict, null, 1)}\n`);
  console.log(`${code}: ${Object.keys(dict).length - 2} entries${problems.length ? `, ${problems.length} problem(s)` : ''}`);
}
process.exit(bad ? 1 : 0);
