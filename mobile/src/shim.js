'use strict';
// ReminderFoxAgain for Android: the pages use the add-on's bridge (thunderbird/bridge.js), which talks to a host by
// runtime messages. Here the host core runs in the main page itself (android-host.js), so this gives the bridge a
// `browser.runtime` that reaches it directly; the alarm and pop-up pages run in frames of the main page and reach it
// through their parent. Loaded before bridge.js in every page.
(function () {
  let top = window;
  try { if (window.parent !== window && window.parent.RFHOST) top = window.parent; } catch (e) { /* not ours */ }
  window.browser = {
    runtime: {
      sendMessage: (msg) => top.RFHOST.message(msg, window),
      onMessage: { addListener: (fn) => top.RFHOST.listen(fn, window) },
    },
  };
  document.documentElement.dataset.host = 'android';
}());
