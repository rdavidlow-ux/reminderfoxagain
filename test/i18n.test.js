'use strict';
// Unit tests for the translations (src/ui/i18n.js and src/ui/locales). Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const I18N = require('../src/ui/i18n.js');
const { setPhrases, describeRecur } = require('../src/core/store');

const LOCALES = path.join(__dirname, '..', 'src', 'ui', 'locales');
const load = (code) => JSON.parse(fs.readFileSync(path.join(LOCALES, `${code}.json`), 'utf8'));
const CATALOG = fs.readFileSync(path.join(__dirname, '..', 'tools', 'i18n', 'catalog.txt'), 'utf8').split('\n')
  .filter((l) => l.trim() && !l.startsWith('#')).flatMap((l) => l.split(' || '));

test('1. the system locale picks the language, with sensible fallbacks', () => {
  assert.equal(I18N.LANGUAGES.length, 34); // English and the add-on's 33 translations
  const cases = [['', 'de-DE', 'de'], ['', 'de-AT', 'de'], ['', 'fr-CA', 'fr'], ['', 'en-US', 'en'], ['', 'pt-BR', 'pt-BR'],
    ['', 'pt-PT', 'pt-PT'], ['', 'pt', 'pt-BR'], ['', 'zh-HK', 'zh-TW'], ['', 'zh-Hant-TW', 'zh-TW'], ['', 'zh-SG', 'zh-CN'],
    ['', 'nn-NO', 'nb-NO'], ['', 'no', 'nb-NO'], ['', 'ja', 'ja-JP'], ['', 'he', 'he-IL'], ['', 'xx-YY', 'en'],
    ['', 'es-MX', 'es-ES'], ['fr', 'de-DE', 'fr'], ['ko-KR', 'en-US', 'ko-KR'], ['', 'ga_IE', 'ga-IE']];
  for (const [choice, sys, want] of cases) assert.equal(I18N.resolve(choice, sys), want, `${choice || 'system'} ${sys}`);
});

test('2. every language has a complete locale file whose placeholders match', () => {
  for (const [code] of I18N.LANGUAGES.filter(([c]) => c !== 'en')) {
    const d = load(code);
    assert.equal(d['@language'], code);
    const missing = CATALOG.filter((k) => !(k in d) && !/^[-+]?\{n\}|^Alt\+|^Ctrl\+|^https|Maps$|^OpenStreetMap$|^ReminderFox/.test(k));
    assert.ok(missing.length < 12, `${code}: ${missing.length} untranslated: ${missing.slice(0, 5).join(' | ')}`);
    for (const [k, v] of Object.entries(d)) {
      if (k.startsWith('@')) continue;
      const want = (k.match(/\{[a-z][a-z0-9]*\}/gi) || []).filter((h) => !/^\{n\d*\}$/.test(h));
      for (const form of typeof v === 'string' ? [v] : Object.values(v)) for (const h of want) assert.ok(form.includes(h), `${code} "${k}" keeps ${h}`);
    }
  }
});

test('3. exact strings, patterns, plural forms and ordinals', () => {
  const de = I18N.create('de', load('de'));
  assert.equal(de.translate('Snooze'), 'Später erinnern');
  assert.equal(de.translate('Copied to “Groceries”'), 'Nach „Groceries“ kopiert');
  assert.equal(de.t('{n} item', { n: 1 }), '1 Eintrag');
  assert.equal(de.t('{n} items', { n: 5 }), '5 Einträge');
  assert.equal(de.ordinal(3), '3.');
  const ru = I18N.create('ru-RU', load('ru-RU'));
  assert.deepEqual([1, 2, 5, 21, 22, 25].map((n) => ru.t('{n} items', { n })), ['1 элемент', '2 элемента', '5 элементов', '21 элемент', '22 элемента', '25 элементов']);
  const ar = I18N.create('ar', load('ar'));
  assert.equal(ar.dir, 'rtl');
  assert.deepEqual([0, 1, 2, 3, 11, 100].map((n) => ar.t('{n} lists', { n })), ['لا قوائم', 'قائمة واحدة', 'قائمتان', '3 قوائم', '11 قائمة', '100 قائمة']);
  const fr = I18N.create('fr', load('fr'));
  assert.deepEqual([1, 2].map(fr.ordinal), ['1er', '2e']);
  assert.equal(I18N.create('en', {}).ordinal(22), '22nd');
  assert.equal(I18N.create('en', {}).translate('Snooze'), null); // English shows the text as written
});

test('4. text the app puts together: lines, " · " parts, a symbol in front, a count behind', () => {
  const de = I18N.create('de', load('de'));
  assert.equal(de.translate('Not done yet\nAll day Cake\nTo-do Milk'), 'Noch nicht erledigt\nGanztägig Cake\nAufgabe Milk');
  assert.equal(de.translate('Today · 3 reminders'), 'Heute · 3 Erinnerungen');
  assert.equal(de.translate('⏰ Quick alarm'), '⏰ Schnellalarm');
  assert.equal(de.translate('List: All lists (7)'), 'Liste: Alle Listen (7)');
  assert.equal(de.translate("To-Do's (3)"), 'Aufgaben (3)');
  assert.equal(de.translate('Groceries (3)'), null); // a list name stays as the user wrote it
  assert.equal(de.translate('Dentist — Dr. Patel'), null);
});

test('5. the repeat descriptions the data layer makes follow the language', () => {
  const d = load('de'); const L = I18N.create('de', d);
  const wd = { SU: 'So', MO: 'Mo', TU: 'Di', WE: 'Mi', TH: 'Do', FR: 'Fr', SA: 'Sa' };
  setPhrases({ t: L.t, ordinal: L.ordinal, weekday: (c) => wd[c], month: () => 'Okt', monthDay: (m, day) => `${day}. Okt.`, date: (k) => k });
  try {
    assert.equal(describeRecur({ freq: 'WEEKLY', interval: 1, byday: ['TU', 'TH'] }, '2026-10-20'), 'Wöchentlich am Di, Do');
    assert.equal(describeRecur({ freq: 'DAILY', interval: 3 }, '2026-10-20'), 'Alle 3 Tage');
    assert.equal(describeRecur({ freq: 'WEEKLY', interval: 1, byday: ['MO', 'TU', 'WE', 'TH', 'FR'], end: 'count', count: 4 }, '2026-10-20'), 'Jeden Werktag, 4-mal');
  } finally { setPhrases(null); }
  assert.equal(describeRecur({ freq: 'DAILY', interval: 3 }, '2026-10-20'), 'Every 3 days');
});
