'use strict';
/* global RFCap */
// ReminderFoxAgain for Android: what window.rf does differently from the add-on (loaded right after bridge.js).
// - No email, address books or invitations: those calls are removed, so the pages show none of their buttons.
// - Saving a file (export, a backup copy, the data file) shares it: the file is written to the app's cache folder and
//   Android's share sheet lets the person save it to Files or Drive, or send it.
(function () {
  const rf = window.rf;
  document.documentElement.dataset.host = 'android';
  rf.i18n.host = 'android';
  rf.i18n.platform = 'linux'; // the desktop wording that fits a phone best ("your system", not "Windows")
  for (const k of ['openEmail', 'sendByEmail', 'invite', 'inviteSend', 'contacts']) delete rf[k];

  let C = null;
  try { C = window.RFCap || (window.parent && window.parent.RFCap) || null; } catch (e) { C = null; }
  if (!C || !C.Capacitor.isNativePlatform()) return; // a desktop browser (the UI checks): the bridge's downloads

  async function share(name, text) {
    const safe = String(name || 'ReminderFoxAgain.ics').replace(/[\\/:*?"<>|]+/g, '-');
    const w = await C.Filesystem.writeFile({ path: safe, data: text, directory: C.Directory.Cache, encoding: C.Encoding.UTF8 });
    try { await C.Share.share({ title: safe, files: [w.uri] }); } catch (e) { /* the person closed the share sheet */ }
    return safe;
  }
  const call = async (ch, ...args) => {
    const r = await window.browser.runtime.sendMessage({ rf: 'call', ch, args });
    if (!r || !r.ok) throw new Error((r && r.error) || 'Unknown error');
    return r.value;
  };
  rf.exportIcs = async (opts) => { const d = await call('ics:exportText', opts); return share(d.name, d.text); };
  rf.openDataFolder = async () => { const d = await call('data:text'); await share(d.name, d.text); return true; };
  rf.backupNow = async (choose) => {
    const file = await call('backup:now');
    if (!choose) return file;
    const b = await call('backup:text', file);
    return share(b.name, b.text);
  };
}());
