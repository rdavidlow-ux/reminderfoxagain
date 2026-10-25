'use strict';
/* global RF */
// Translates every window as it renders: text nodes and the title / placeholder / aria-label / label / alt attributes,
// once on load and again whenever the page changes (a MutationObserver), using the language the host chose.
// User content is never translated: item titles, chips, notes and anything inside [translate="no"].
(function () {
  const core = RF.i18nCore;
  const data = (window.rf && window.rf.i18n) || { lang: 'en', dict: {}, dateLocale: '', collect: false };
  const I = core.create(data.lang, data.dict);
  RF.i18n = { ...I, dateLocale: data.dateLocale || navigator.language || 'en', languages: core.LANGUAGES, systemLang: data.systemLang || 'en' };
  document.documentElement.lang = I.lang === 'en' ? 'en' : I.lang;
  document.documentElement.dir = I.dir;
  // The desktop (0.9.0): the markup is written for Windows; on macOS and Linux a few texts read differently (before
  // they are translated), and on macOS the shortcuts show ⌘ (Quick alarm is ⇧⌘A, since ⌘Q quits).
  const PLATFORM = data.platform || 'windows';
  RF.platform = PLATFORM;
  document.documentElement.dataset.platform = PLATFORM;
  const WELCOME = 'Your reminders, to-dos and alarms as a Windows app — a tribute to the original ReminderFox add-on.';
  const NOTE = 'Default is Fox, light or dark to match Windows. Starred items have their own colour in every theme. High contrast uses black, white, yellow and cyan with larger text and heavier lines.';
  const COMMON = {
    'Start ReminderFoxAgain when Windows starts': 'Start ReminderFoxAgain when you log in',
    [NOTE]: 'Default is Fox, light or dark to match your system. Starred items have their own colour in every theme. High contrast uses black, white, yellow and cyan with larger text and heavier lines.',
    'As in Windows': 'As in your system',
    'Default (follows Windows)': 'Default (follows the system)',
  };
  const PT = PLATFORM === 'macos' ? { ...COMMON,
    'Keep running in the system tray when the window is closed': 'Keep running in the menu bar when the window is closed',
    [WELCOME]: 'Your reminders, to-dos and alarms as a Mac app — a tribute to the original ReminderFox add-on.',
    'Show a number on the tray and taskbar icons': 'Show a number on the Dock icon',
    'Show the reminders file in File Explorer': 'Show the reminders file in Finder',
  } : PLATFORM === 'linux' ? { ...COMMON,
    [WELCOME]: 'Your reminders, to-dos and alarms as a Linux app — a tribute to the original ReminderFox add-on.',
    'Show a number on the tray and taskbar icons': 'Show a number on the tray icon',
    'Show the reminders file in File Explorer': 'Show the reminders file in your file manager',
  } : {};
  const keys = PLATFORM === 'macos' ? (t) => t.replace(/(Ctrl|Strg)\+Q\b/g, '⇧⌘A').replace(/(Ctrl|Strg)\+/g, '⌘') : (t) => t;
  RF.platformText = (s) => PT[s] || s;
  RF.platformKeys = keys;
  if (I.lang === 'en' && !data.collect && PLATFORM === 'windows') return;

  const SKIP = '[translate="no"], .t, .tx b, .chip, span.sub, .mini-row b, textarea, script, style, .notes';
  const ATTRS = ['title', 'placeholder', 'aria-label', 'label', 'alt'];
  const done = new WeakMap(); // node → the text we wrote, so our own writes aren't translated again
  const seen = new Set();
  const report = (s) => { if (data.collect && !seen.has(s)) { seen.add(s); try { window.rf.i18nMissing(s); } catch (e) { /* ignore */ } } };
  const worth = (s) => /[A-Za-z]{2}/.test(s);
  const skipped = (el) => !!(el && el.closest && el.closest(SKIP));
  // the platform's wording, translated; null = leave the text as it is
  function tx(s) {
    const src = PT[s] || s;
    let out = I.lang === 'en' ? src : I.translate(src);
    if (out == null) { report(src); out = src; }
    out = keys(out);
    return out === s ? null : out;
  }

  function textNode(node) {
    const raw = node.nodeValue;
    if (!raw || done.get(node) === raw) return;
    const s = raw.trim().replace(/\s+/g, ' ');
    if (!s || !worth(s) || skipped(node.parentElement)) return;
    const tr = tx(s);
    if (tr == null || tr === s) return;
    const out = raw.replace(raw.trim(), tr);
    done.set(node, out);
    node.nodeValue = out;
  }
  function attrs(el) {
    if (skipped(el) && !(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ) return;
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (!v || !worth(v)) continue;
      const key = `${a}\u0000${v}`;
      if (done.get(el) && done.get(el)[a] === v) continue;
      const tr = tx(v.trim());
      if (tr == null || tr === v) continue;
      const mark = done.get(el) || {}; mark[a] = tr; done.set(el, mark);
      el.setAttribute(a, tr);
      void key;
    }
  }
  function walk(rootNode) {
    if (!rootNode) return;
    if (rootNode.nodeType === 3) { textNode(rootNode); return; }
    if (rootNode.nodeType !== 1 && rootNode.nodeType !== 11) return;
    if (rootNode.nodeType === 1) attrs(rootNode);
    const w = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) textNode(n); else attrs(n); }
  }
  RF.i18n.apply = walk;
  const start = () => {
    walk(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') textNode(m.target);
        else if (m.type === 'attributes') attrs(m.target);
        else for (const n of m.addedNodes) walk(n);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
}());
