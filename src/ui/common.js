'use strict';
// Helpers shared by the main window (app.js) and the alarm window (alarm.js).
(function () {
  // dates follow the app language (its regional form when the system uses the same language)
  let LOCALE = (window.RF && window.RF.i18n && window.RF.i18n.dateLocale) || navigator.language || 'en-CA';
  try { new Intl.DateTimeFormat(LOCALE); } catch (e) { LOCALE = 'en'; }
  const pad = (n) => String(n).padStart(2, '0');
  // T('Every {n} days', {n: 3}): the app-language text of a phrase whose English is the key (see i18n.js)
  const T = (s, v) => (window.RF && window.RF.i18n && window.RF.i18n.t ? window.RF.i18n.t(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m)));
  const dayKey = (d) => { d = d instanceof Date ? d : new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const parseKey = (k) => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d); };
  const startOfDay = (d) => { const x = d instanceof Date ? new Date(d) : new Date(d == null ? Date.now() : d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const asDate = (d) => (d instanceof Date ? d : typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? parseKey(d) : new Date(d));

  const fTime = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
  const fShort = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric' });
  const fShortY = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
  const fWd = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
  const fWdLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
  const fMonth = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
  const fMonthName = new Intl.DateTimeFormat(LOCALE, { month: 'long' });
  const fLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const fNarrow = new Intl.DateTimeFormat(LOCALE, { weekday: 'narrow' });
  const fRel = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric' });

  // user-chosen formats (Settings → Display); '' follows Windows
  const F = { date: '', time: '' };
  const MON = (d) => new Intl.DateTimeFormat(LOCALE, { month: 'short' }).format(d).replace(/\.$/, '');
  const fmt = {
    time: (d) => asDate(d).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit', ...(F.time === '24' ? { hourCycle: 'h23' } : F.time === '12' ? { hour12: true } : {}) }),
    date: (d) => {
      d = asDate(d);
      const thisYear = d.getFullYear() === new Date().getFullYear();
      const y = d.getFullYear(); const m = pad(d.getMonth() + 1); const dd = pad(d.getDate());
      switch (F.date) {
        case 'dmy-text': return `${d.getDate()} ${MON(d)}${thisYear ? '' : ` ${y}`}`;
        case 'iso': return `${y}-${m}-${dd}`;
        case 'mdy': return `${m}/${dd}/${y}`;
        case 'dmy': return `${dd}/${m}/${y}`;
        case 'dmy-dot': return `${dd}.${m}.${y}`;
        default: return (thisYear ? fShort : fShortY).format(d);
      }
    },
    weekday: (d) => fWd.format(asDate(d)),
    weekdayLong: (d) => fWdLong.format(asDate(d)),
    narrow: (d) => fNarrow.format(asDate(d)),
    month: (d) => fMonth.format(asDate(d)),
    monthName: (d) => fMonthName.format(asDate(d)),
    long: (d) => fLong.format(asDate(d)),
    dateTime: (d) => `${fmt.date(d)}, ${fmt.time(d)}`,
    relDay(d) {
      const k = dayKey(asDate(d));
      const t = startOfDay(new Date());
      if (k === dayKey(t)) return T('Today');
      if (k === dayKey(addDays(t, 1))) return T('Tomorrow');
      if (k === dayKey(addDays(t, -1))) return T('Yesterday');
      const x = asDate(d);
      if (F.date) return `${fWd.format(x)}, ${fmt.date(x)}`;
      return x.getFullYear() === t.getFullYear() ? fRel.format(x) : `${fRel.format(x)}, ${x.getFullYear()}`;
    },
    rel(ms, now = Date.now()) {
      const diff = ms - now;
      const a = Math.abs(diff);
      if (a < 60000) return T('now');
      let n; let unit;
      if (a < 3600000) { n = Math.floor(a / 60000); unit = 'min'; }
      else if (a < 86400000) { n = Math.floor(a / 3600000); unit = n === 1 ? 'hour' : 'hours'; }
      else { n = Math.floor(a / 86400000); unit = n === 1 ? 'day' : 'days'; }
      return T(diff > 0 ? `in {n} ${unit}` : `{n} ${unit} ago`, { n });
    },
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // The built-in alarm sounds, drawn with Web Audio so they need no files. Each draws into any AudioContext (also an
  // OfflineAudioContext, which tools/sounds.js uses to write them out as .wav files) from time t0, and says how long
  // it lasts in seconds. id is stored in settings.alarmTone ('file' = the user's own sound file).
  function note(c, out, t, f, { type = 'sine', peak = 0.35, attack = 0.02, decay = 1, partials = [[1, 1]] } = {}) {
    for (const [mul, amp] of partials) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = f * mul;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak * amp, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + decay + 0.02);
    }
  }
  const TONES = [
    { id: 'chime', label: 'Chime', dur: 2.2, draw(c, out, t0) {
      for (const [f, at] of [[880, 0], [659.25, 0.28], [880, 0.9], [659.25, 1.18]]) note(c, out, t0 + at, f);
    } },
    // a struck bell: a few inharmonic partials that fade slowly, twice
    { id: 'bell', label: 'Bell', dur: 3.2, draw(c, out, t0) {
      for (const at of [0, 1.3]) note(c, out, t0 + at, 523.25, { peak: 0.3, attack: 0.005, decay: 1.9, partials: [[1, 1], [2, 0.5], [2.76, 0.35], [5.4, 0.18]] });
    } },
    // a rising four-note marimba run, twice
    { id: 'marimba', label: 'Marimba', dur: 2, draw(c, out, t0) {
      [0, 0.95].forEach((base) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(c, out, t0 + base + i * 0.14, f, { peak: 0.32, attack: 0.004, decay: 0.45, partials: [[1, 1], [4, 0.12]] })));
    } },
    // a digital watch: two groups of four short beeps
    { id: 'beeps', label: 'Digital beeps', dur: 1.7, draw(c, out, t0) {
      [0, 0.9].forEach((base) => [0, 0.15, 0.3, 0.45].forEach((at) => note(c, out, t0 + base + at, 2093, { type: 'square', peak: 0.16, attack: 0.003, decay: 0.09 })));
    } },
    // an old alarm clock: fast rings for about two seconds
    { id: 'clock', label: 'Alarm clock', dur: 2.1, draw(c, out, t0) {
      for (let i = 0; i < 26; i++) note(c, out, t0 + i * 0.075 + (i >= 13 ? 0.15 : 0), 1318.5, { type: 'triangle', peak: 0.22, attack: 0.003, decay: 0.065, partials: [[1, 1], [1.5, 0.4]] });
    } },
  ];
  const toneOf = (id) => TONES.find((x) => x.id === id) || TONES[0];
  let ctx = null;
  let tonePlaying = null; // {gain, timer, resolve} of the built-in sound playing now
  // plays a built-in sound; resolves when it has finished (or was stopped)
  function playTone(id) {
    return new Promise((resolve) => {
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        stopSound();
        const tone = toneOf(id);
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        tone.draw(ctx, gain, ctx.currentTime + 0.05);
        const p = { gain, resolve };
        p.timer = setTimeout(() => { if (tonePlaying === p) tonePlaying = null; resolve(); }, (tone.dur + 0.1) * 1000);
        tonePlaying = p;
      } catch (e) { resolve(); /* no audio device */ }
    });
  }
  const chime = () => playTone('chime');

  void fTime;
  function setFormats(st) { F.date = (st && st.dateFormat) || ''; F.time = (st && st.timeFormat) || ''; }
  const SAMPLE = new Date(2026, 9, 17);
  const DATE_FORMATS = [['', T('As in Windows ({s})', { s: fShort.format(SAMPLE) })], ['dmy-text', `17 ${MON(SAMPLE)}`], ['iso', '2026-10-17'], ['mdy', '10/17/2026'], ['dmy', '17/10/2026'], ['dmy-dot', '17.10.2026']];

  const UNITS = { seconds: 1, minutes: 60, hours: 3600 };
  const snooze = {
    UNITS, MAX: 999,
    seconds(amount, unit) {
      const s = String(amount == null ? '' : amount).trim();
      if (!/^\d{1,3}$/.test(s) || !Object.prototype.hasOwnProperty.call(UNITS, unit)) return null;
      const n = Number(s);
      if (n < 1 || n > 999) return null;
      return n * UNITS[unit];
    },
    // "Snooze until" a clock time: "15:30", "3:30", "3:30 pm", "3pm", "1530". Earlier than now means tomorrow.
    untilSeconds(text, now = Date.now()) {
      const m = /^\s*(\d{1,2})(?:[:.h]?(\d{2}))?\s*([ap])?\.?\s*m?\.?\s*$/i.exec(String(text || ''));
      if (!m) return null;
      let h = Number(m[1]); const mi = m[2] == null ? 0 : Number(m[2]);
      if (mi > 59) return null;
      if (m[3]) { if (h < 1 || h > 12) return null; h = (h % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0); } else if (h > 23) return null;
      const t = new Date(now); t.setHours(h, mi, 0, 0);
      if (t.getTime() <= now) t.setDate(t.getDate() + 1);
      const sec = Math.round((t.getTime() - now) / 1000);
      return sec >= 1 ? sec : null;
    },
    label(amount, unit) {
      const n = Number(amount);
      const name = { seconds: 'second', minutes: 'minute', hours: 'hour' }[unit] || 'minute';
      return `${n} ${name}${n === 1 ? '' : 's'}`;
    },
    fromSettings(st) {
      st = st || {};
      if (snooze.seconds(st.snoozeAmount, st.snoozeUnit) != null) return { amount: Number(st.snoozeAmount), unit: st.snoozeUnit };
      const m = Number(st.snoozeMinutes);
      if (Number.isFinite(m) && m >= 1) {
        if (m % 60 === 0 && m / 60 <= 999) return { amount: m / 60, unit: 'hours' };
        if (m <= 999) return { amount: Math.round(m), unit: 'minutes' };
      }
      return { amount: 10, unit: 'minutes' };
    },
  };

  // Themes: id is stored in settings.theme ('' = Default). Swatches: background, accent, starred, text.
  const THEMES = [
    { id: '', label: 'Default (follows Windows)', sw: ['#fbf8f4', '#e26e26', '#8b3fc9', '#2a1c11'] },
    { id: 'fox', label: 'Fox', sw: ['#fbf8f4', '#e26e26', '#8b3fc9', '#2a1c11'] },
    { id: 'light', label: 'Light', sw: ['#f6f7f9', '#2563eb', '#c026d3', '#161b22'] },
    { id: 'dark', label: 'Dark', sw: ['#1d1712', '#f07d33', '#c39bff', '#f4ebe1'] },
    { id: 'ocean', label: 'Ocean', sw: ['#f4f8f8', '#0f7c8c', '#b35400', '#0f2a2e'] },
    { id: 'contrast', label: 'High contrast', sw: ['#000000', '#ffd400', '#00e5ff', '#ffffff'] },
  ];
  // Your own themes (0.8.1): {id, name, bg, surface, ink, accent, star} — five colours, from which every colour the
  // app uses is worked out. settings.theme 'custom:<id>' picks one; data-theme="custom" plus the colours set inline.
  // The colours each built-in theme starts a new one from:
  const THEME_COLORS = {
    fox: { bg: '#fbf8f4', surface: '#ffffff', ink: '#2a1c11', accent: '#e26e26', star: '#8b3fc9' },
    light: { bg: '#f6f7f9', surface: '#ffffff', ink: '#161b22', accent: '#2563eb', star: '#c026d3' },
    dark: { bg: '#1d1712', surface: '#261e18', ink: '#f4ebe1', accent: '#f07d33', star: '#c39bff' },
    ocean: { bg: '#f4f8f8', surface: '#ffffff', ink: '#0f2a2e', accent: '#0f7c8c', star: '#b35400' },
    contrast: { bg: '#000000', surface: '#000000', ink: '#ffffff', accent: '#ffd400', star: '#00e5ff' },
  };
  const hex = (c, d) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).toLowerCase() : d);
  const rgb = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = (a) => `#${a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
  const mix = (a, b, t) => { const x = rgb(a); const y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const lum = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  // WCAG contrast ratio of two colours (1 to 21)
  const contrast = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const isDark = (c) => lum(c) < 0.18;
  function themeVars(t) {
    const bg = hex(t.bg, '#fbf8f4'); const surface = hex(t.surface, '#ffffff'); const ink = hex(t.ink, '#2a1c11');
    const accent = hex(t.accent, '#e26e26'); const star = hex(t.star, '#8b3fc9');
    const dark = isDark(bg);
    const [ar, ag, ab] = rgb(accent);
    const onAccent = contrast(accent, '#ffffff') >= contrast(accent, '#000000') ? '#ffffff' : '#000000';
    return {
      '--bg': bg, '--surface': surface, '--surface-2': mix(surface, ink, 0.05), '--surface-3': mix(surface, ink, 0.09),
      '--line': mix(surface, ink, 0.11), '--line-strong': mix(surface, ink, 0.22),
      '--ink': ink, '--ink-2': mix(ink, bg, 0.28), '--ink-3': mix(ink, bg, 0.46),
      '--fox': accent, '--fox-hover': mix(accent, dark ? '#ffffff' : '#000000', 0.12),
      '--fox-ink': contrast(accent, surface) >= 4.5 ? accent : mix(accent, ink, 0.4),
      '--fox-soft': mix(bg, accent, dark ? 0.28 : 0.15), '--fox-softer': mix(bg, accent, dark ? 0.14 : 0.07), '--sel': mix(bg, accent, dark ? 0.36 : 0.22),
      '--danger': dark ? '#ff6b5b' : '#c0392b', '--done': mix(ink, bg, 0.55),
      '--focus': `0 0 0 3px rgba(${ar}, ${ag}, ${ab}, .32)`,
      '--shadow': dark ? '0 10px 30px rgba(0, 0, 0, .45), 0 2px 6px rgba(0, 0, 0, .3)' : '0 10px 30px rgba(20, 20, 20, .16), 0 2px 6px rgba(20, 20, 20, .08)',
      '--imp': star, '--imp-ink': contrast(star, surface) >= 4.5 ? star : mix(star, ink, 0.35), '--imp-soft': mix(bg, star, dark ? 0.24 : 0.12),
      '--on-accent': onAccent, 'color-scheme': dark ? 'dark' : 'light',
    };
  }
  const VAR_NAMES = Object.keys(themeVars({}));
  // every theme to offer: the built-in ones, then yours (with swatches: background, accent, starred, text)
  function themeList(customs) {
    return [...THEMES, ...(customs || []).map((c) => ({ id: `custom:${c.id}`, label: c.name, custom: c, sw: [hex(c.bg, '#fbf8f4'), hex(c.accent, '#e26e26'), hex(c.star, '#8b3fc9'), hex(c.ink, '#2a1c11')] }))];
  }
  // id: '' | a built-in id | 'custom:<id>'; customs: settings.customThemes; preview: a custom theme object to show now
  function applyTheme(id, customs, preview) {
    const root = document.documentElement;
    const c = preview || (String(id || '').startsWith('custom:') ? (customs || []).find((x) => `custom:${x.id}` === id) : null);
    for (const v of VAR_NAMES) root.style.removeProperty(v);
    if (c) {
      root.dataset.theme = 'custom';
      for (const [k, v] of Object.entries(themeVars(c))) root.style.setProperty(k, v);
      return id;
    }
    const t = THEMES.some((x) => x.id === id) ? id : '';
    if (t) root.dataset.theme = t; else delete root.dataset.theme;
    return t;
  }

  // The add-on's title variables: "<1960>" → "66th", "<1960#>" → "66" (same rule as store.js)
  function expandAges(summary, year) {
    if (!summary || String(summary).indexOf('<') < 0) return summary;
    return String(summary).replace(/<(\d{4})(#?)>/g, (m, y, plain) => {
      const n = Math.abs(year - Number(y));
      if (plain) return String(n);
      if (window.RF && window.RF.i18n) return window.RF.i18n.ordinal(n);
      const m100 = n % 100; const m10 = n % 10;
      return `${n}${m100 >= 11 && m100 <= 13 ? 'th' : m10 === 1 ? 'st' : m10 === 2 ? 'nd' : m10 === 3 ? 'rd' : 'th'}`;
    });
  }

  // Plays the user's sound file (a data: URL) or, without one, the built-in sound `tone`. Resolves when it has finished
  // playing or was stopped, so a caller can play it again straight after (the alarm window's "continuously").
  let audio = null;
  function playSound(url, tone) {
    if (!url) return playTone(tone);
    return new Promise((resolve) => {
      try {
        stopSound();
        const a = new Audio(url);
        audio = a;
        const end = () => { if (audio === a) audio = null; resolve(); };
        a.addEventListener('ended', end);
        a.addEventListener('pause', end);
        a.addEventListener('error', () => { if (audio === a) audio = null; playTone(tone).then(resolve); });
        a.play().catch(() => { if (audio === a) audio = null; playTone(tone).then(resolve); });
      } catch (e) { playTone(tone).then(resolve); }
    });
  }
  // stops whatever alarm sound is playing
  function stopSound() {
    if (audio) { const a = audio; audio = null; try { a.pause(); } catch (e) { /* gone */ } }
    if (tonePlaying) {
      const p = tonePlaying; tonePlaying = null;
      clearTimeout(p.timer);
      try { p.gain.gain.cancelScheduledValues(0); p.gain.gain.setValueAtTime(0, ctx.currentTime); setTimeout(() => p.gain.disconnect(), 50); } catch (e) { /* gone */ }
      p.resolve();
    }
  }

  window.RF = { ...(window.RF || {}), pad, dayKey, parseKey, startOfDay, addDays, fmt, T, esc, chime, playSound, playTone, stopSound, TONES, snooze, LOCALE, THEMES, THEME_COLORS, themeList, themeVars, contrast, applyTheme, expandAges, setFormats, DATE_FORMATS };
})();
