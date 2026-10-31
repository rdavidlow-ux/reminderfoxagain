#!/usr/bin/env node
// Writes the NSIS language list and the installer's own strings (from src/ui/locales/) for installer/ReminderFoxAgain.nsi.
//   node tools/installer-lang.js <out.nsh>
'use strict';
const fs = require('fs');
const path = require('path');
const out = process.argv[2];
if (!out) { console.error('usage: node tools/installer-lang.js <out.nsh>'); process.exit(1); }
// the app's languages → NSIS language files (Frisian has none; Windows in Frisian gets the English installer)
const NSIS = {
  en: 'English', ar: 'Arabic', 'be-BY': 'Belarusian', 'ca-AD': 'Catalan', 'cs-CZ': 'Czech', da: 'Danish', de: 'German',
  'es-ES': 'Spanish', 'et-EE': 'Estonian', fi: 'Finnish', fr: 'French', 'ga-IE': 'Irish', 'gl-ES': 'Galician', 'he-IL': 'Hebrew',
  'hu-HU': 'Hungarian', it: 'Italian', 'ja-JP': 'Japanese', 'ko-KR': 'Korean', 'mn-MN': 'Mongolian', 'nb-NO': 'Norwegian', nl: 'Dutch',
  pl: 'Polish', 'pt-BR': 'PortugueseBR', 'pt-PT': 'Portuguese', 'ro-RO': 'Romanian', 'ru-RU': 'Russian', 'sk-SK': 'Slovak',
  'sv-SE': 'Swedish', tr: 'Turkish', 'uk-UA': 'Ukrainian', vi: 'Vietnamese', 'zh-CN': 'SimpChinese', 'zh-TW': 'TradChinese',
};
const STRINGS = {
  RF_DELETE_DATA: ['Also delete your reminders and settings in {path}? Choose No to keep them.', { path: '$APPDATA\\ReminderFoxAgain' }],
  RF_DESCRIPTION: ['Reminders, to-dos and alarms', {}],
};
const nsis = (s) => s.replace(/\$(?![A-Z{\\])/g, '$$$$').replace(/"/g, '$\\"').replace(/\r?\n/g, '$\\n');
const lines = ['; written by tools/installer-lang.js — do not edit', ''];
for (const [code, name] of Object.entries(NSIS)) lines.push(`!insertmacro MUI_LANGUAGE "${name}"`);
lines.push('');
for (const [code, name] of Object.entries(NSIS)) {
  const dict = code === 'en' ? {} : JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'locales', `${code}.json`), 'utf8'));
  for (const [id, [en, vars]] of Object.entries(STRINGS)) {
    let s = dict[en] || en;
    if (typeof s !== 'string') throw new Error(`${code}: ${en} is not a plain string`);
    s = nsis(s);
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
    lines.push(`LangString ${id} \${LANG_${name.toUpperCase()}} "${s}"`);
  }
}
fs.writeFileSync(out, '﻿' + lines.join('\r\n') + '\r\n', 'utf8');
