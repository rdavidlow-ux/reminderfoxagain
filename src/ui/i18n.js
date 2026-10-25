'use strict';
// ReminderFoxAgain translations. The English text is the key, as in gettext: a locale file maps each English string
// (or pattern) to its translation. Used by every window (it translates what the page shows, as it appears) and by the
// main process (tray, dialogs, repeat descriptions).
//
// Keys:   "Snooze"                       an exact string
//         "Moved to “{list}”"            a pattern: {list} matches any text and is carried over
//         "{n} open · {n2} done"         {n}, {n1}, {n2}… match a number
// Values: a string, or plural forms chosen with Intl.PluralRules on {n}: {"one": "…", "few": "…", "other": "…"}
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.RF = root.RF || {}; root.RF.i18nCore = api; }
}(typeof self !== 'undefined' ? self : this, () => {
  // The languages of the original ReminderFox add-on, with their own names. 'en' is the source language.
  const LANGUAGES = [
    ['en', 'English'], ['ar', 'العربية'], ['be-BY', 'Беларуская'], ['ca-AD', 'Català'], ['cs-CZ', 'Čeština'], ['da', 'Dansk'],
    ['de', 'Deutsch'], ['es-ES', 'Español'], ['et-EE', 'Eesti'], ['fi', 'Suomi'], ['fr', 'Français'], ['fy-NL', 'Frysk'],
    ['ga-IE', 'Gaeilge'], ['gl-ES', 'Galego'], ['he-IL', 'עברית'], ['hu-HU', 'Magyar'], ['it', 'Italiano'], ['ja-JP', '日本語'],
    ['ko-KR', '한국어'], ['mn-MN', 'Монгол'], ['nb-NO', 'Norsk bokmål'], ['nl', 'Nederlands'], ['pl', 'Polski'],
    ['pt-BR', 'Português (Brasil)'], ['pt-PT', 'Português (Portugal)'], ['ro-RO', 'Română'], ['ru-RU', 'Русский'],
    ['sk-SK', 'Slovenčina'], ['sv-SE', 'Svenska'], ['tr', 'Türkçe'], ['uk-UA', 'Українська'], ['vi', 'Tiếng Việt'],
    ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'],
  ];
  const RTL = new Set(['ar', 'he-IL']);
  const CODES = LANGUAGES.map(([c]) => c);

  // The app language for a system locale such as "fr-CA", "pt-BR", "zh-HK" or "nn": exact match, then the same base
  // language (with sensible defaults for Portuguese, Chinese and Norwegian), else English.
  function resolve(choice, systemLocale) {
    const want = String(choice || systemLocale || 'en').replace('_', '-');
    const exact = CODES.find((c) => c.toLowerCase() === want.toLowerCase());
    if (exact) return exact;
    const [base, region] = want.toLowerCase().split('-');
    if (base === 'pt') return region === 'pt' ? 'pt-PT' : 'pt-BR';
    if (base === 'zh') return /^(tw|hk|mo|hant)$/.test(region || '') || /hant/i.test(want) ? 'zh-TW' : 'zh-CN';
    if (base === 'no' || base === 'nn' || base === 'nb') return 'nb-NO';
    return CODES.find((c) => c.split('-')[0].toLowerCase() === base) || 'en';
  }

  const isNumName = (name) => /^n\d*$/.test(name);
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function create(lang, dict) {
    lang = lang || 'en';
    dict = dict || {};
    const exact = new Map();
    const patterns = [];
    for (const [key, value] of Object.entries(dict)) {
      if (key.startsWith('@')) continue; // metadata (@language, @notes…)
      if (!/\{[a-z][a-z0-9]*\}/i.test(key)) { exact.set(key, value); continue; }
      const names = [];
      const src = key.split(/(\{[a-z][a-z0-9]*\})/i).map((part) => {
        const m = /^\{([a-z][a-z0-9]*)\}$/i.exec(part);
        if (!m) return reEsc(part);
        names.push(m[1]);
        return isNumName(m[1]) ? '(-?\\d[\\d,.\\u00a0\\u202f]*)' : '(.+?)';
      }).join('');
      patterns.push({ key, value, names, re: new RegExp(`^${src}$`, 's'), weight: key.replace(/\{[^}]+\}/g, '').length });
    }
    patterns.sort((a, b) => b.weight - a.weight); // the most specific pattern wins
    let rules = null; let ordRules = null;
    try { rules = new Intl.PluralRules(lang === 'en' ? 'en' : lang); ordRules = new Intl.PluralRules(lang === 'en' ? 'en' : lang, { type: 'ordinal' }); } catch (e) { /* plain forms */ }
    const pick = (value, vars, ordinal) => {
      if (value == null || typeof value === 'string') return value;
      const nName = Object.keys(vars || {}).find(isNumName);
      const n = nName != null ? Number(String(vars[nName]).replace(/[^\d.-]/g, '')) : NaN;
      const r = ordinal ? ordRules : rules;
      const form = r && Number.isFinite(n) ? r.select(n) : 'other';
      return value[form] != null ? value[form] : value.other != null ? value.other : Object.values(value)[0];
    };
    const fill = (s, vars) => String(s).replace(/\{([a-z][a-z0-9]*)\}/gi, (m, k) => (vars && vars[k] != null ? vars[k] : m));

    // t('Every {n} days', {n: 3}) for code that knows its key; English (or a missing entry) gives the key filled in.
    function t(key, vars) {
      const v = pick(dict[key], vars);
      return fill(v == null || v === '' ? key : v, vars);
    }
    // Ordinals: dict["{n}th"] holds the forms by Intl ordinal category ("one", "two", "few", "other").
    function ordinal(n) {
      const v = dict['{n}th'];
      if (v == null) { const m100 = n % 100; const m10 = n % 10; return `${n}${m100 >= 11 && m100 <= 13 ? 'th' : m10 === 1 ? 'st' : m10 === 2 ? 'nd' : m10 === 3 ? 'rd' : 'th'}`; }
      return fill(pick(v, { n }, true), { n });
    }
    // The translation of a whole text as shown (an exact entry or a pattern), or null when there is none.
    function translate(text) {
      if (lang === 'en' || !text) return null;
      if (exact.has(text)) { const v = exact.get(text); return typeof v === 'string' ? v : pick(v, {}); }
      for (const p of patterns) {
        const m = p.re.exec(text);
        if (!m) continue;
        const vars = {};
        p.names.forEach((nm, i) => { vars[nm] = m[i + 1]; });
        // a carried-over part may itself be translatable ("List: {s}" around "All lists (7)")
        for (const nm of p.names) if (!isNumName(nm)) { const inner = translate(vars[nm]); if (inner != null) vars[nm] = inner; }
        const v = pick(p.value, vars);
        if (v == null || v === '') continue;
        return fill(v, vars);
      }
      return structural(text);
    }
    // Text the app puts together from translatable parts: several lines, parts joined by " · ", a symbol in front
    // ("★ ", "↻ ", "⏰ "…) or a count behind ("Errands (5)"). Null when no part has a translation.
    function parts(list, sep) {
      let any = false;
      const out = list.map((p) => {
        const s = p.trim();
        const tr = s ? translate(s) : null;
        if (tr == null) return p;
        any = true;
        return p.replace(s, tr);
      });
      return any ? out.join(sep) : null;
    }
    function structural(text) {
      if (text.includes('\n')) return parts(text.split('\n'), '\n');
      if (text.includes(' · ')) return parts(text.split(' · '), ' · ');
      if (text.includes('; ')) return parts(text.split('; '), '; ');
      let m = /^([^\p{L}\p{N}\s]+\s+)(\S.*)$/su.exec(text);
      if (m) { const tr = translate(m[2]); return tr == null ? null : m[1] + tr; }
      m = /^(.*\S)( \(\d[\d,.]*\))$/s.exec(text);
      if (m) { const tr = translate(m[1]); return tr == null ? null : tr + m[2]; }
      return null;
    }
    return { lang, dir: RTL.has(lang) ? 'rtl' : 'ltr', t, ordinal, translate, size: exact.size + patterns.length };
  }

  return { LANGUAGES, CODES, RTL, resolve, create };
}));
