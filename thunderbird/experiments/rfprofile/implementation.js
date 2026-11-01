/* global ExtensionAPI, ChromeUtils, Components, Services, IOUtils, PathUtils */
'use strict';
// ReminderFoxAgain for Thunderbird: the one thing a plain add-on can't do — find the reminderfox.ics the original
// ReminderFox add-on kept in a profile folder (<profile>/reminderfox/reminderfox.ics), as the desktop app does
// (src/main.js findOldFiles). It only looks for that file and reads it with the profile's prefs.js (the add-on's list
// names are kept there); it reads nothing else and writes nothing.
const MAX = 50 * 1024 * 1024;
// an error the add-on sees with its message (a plain Error reaches it as "An unexpected error occurred")
function failure(message) {
  try {
    const { ExtensionUtils } = ChromeUtils.importESModule('resource://gre/modules/ExtensionUtils.sys.mjs');
    return new ExtensionUtils.ExtensionError(message);
  } catch (e) { return new Error(message); }
}
async function isFile(p) { try { const st = await IOUtils.stat(p); return st.type === 'regular' ? st : null; } catch (e) { return null; } }
async function children(dir) { try { return await IOUtils.getChildren(dir); } catch (e) { return []; } }
function dir(key) { try { return Services.dirsvc.get(key, Components.interfaces.nsIFile).path; } catch (e) { return null; } }
function roots() {
  const os = Services.appinfo.OS;
  const home = dir('Home');
  const out = [PathUtils.parent(PathUtils.profileDir)]; // this Thunderbird's own profiles
  const j = (...p) => { try { return PathUtils.join(...p); } catch (e) { return null; } };
  if (os === 'WINNT') {
    const appData = dir('AppData');
    if (appData) out.push(j(appData, 'Mozilla', 'Firefox', 'Profiles'), j(appData, 'Thunderbird', 'Profiles'), j(appData, 'Mozilla', 'SeaMonkey', 'Profiles'), j(appData, 'Waterfox', 'Profiles'), j(appData, 'Moonchild Productions', 'Pale Moon', 'Profiles'));
  } else if (os === 'Darwin') {
    if (home) out.push(j(home, 'Library', 'Application Support', 'Firefox', 'Profiles'), j(home, 'Library', 'Thunderbird', 'Profiles'), j(home, 'Library', 'Application Support', 'SeaMonkey', 'Profiles'), j(home, 'Library', 'Application Support', 'Waterfox', 'Profiles'));
  } else if (home) {
    out.push(j(home, '.mozilla', 'firefox'), j(home, '.thunderbird'), j(home, 'snap', 'firefox', 'common', '.mozilla', 'firefox'), j(home, 'snap', 'thunderbird', 'common', '.thunderbird'),
      j(home, '.var', 'app', 'org.mozilla.firefox', '.mozilla', 'firefox'), j(home, '.var', 'app', 'org.mozilla.Thunderbird', '.thunderbird'), j(home, '.mozilla', 'seamonkey'), j(home, '.waterfox'));
  }
  return [...new Set(out.filter(Boolean))];
}
async function find() {
  const seen = new Set(); const out = [];
  const add = async (f, current) => {
    if (seen.has(f)) return;
    seen.add(f);
    const st = await isFile(f);
    if (st) out.push({ path: f, modified: st.lastModified || 0, size: st.size || 0, current: !!current });
  };
  await add(PathUtils.join(PathUtils.profileDir, 'reminderfox', 'reminderfox.ics'), true);
  for (const r of roots()) for (const p of await children(r)) await add(PathUtils.join(p, 'reminderfox', 'reminderfox.ics'), false);
  return out.sort((a, b) => (b.current - a.current) || (b.modified - a.modified));
}
this.rfprofile = class extends ExtensionAPI {
  getAPI() {
    return {
      rfprofile: {
        find,
        async read(path) {
          // only a file find() reports
          if (!(await find()).some((f) => f.path === path)) throw failure('That file is not a reminderfox.ics in a profile.');
          const st = await isFile(path);
          if (!st || st.size > MAX) throw failure('That file could not be read.');
          const text = await IOUtils.readUTF8(path);
          let prefs = '';
          try { prefs = await IOUtils.readUTF8(PathUtils.join(PathUtils.parent(PathUtils.parent(path)), 'prefs.js')); } catch (e) { prefs = ''; }
          const m = /user_pref\(\s*"extensions\.reminderFox\.todoLists"[^\n]*\);/i.exec(prefs); // only the line that matters
          return { name: 'reminderfox.ics', text, prefs: m ? m[0] : '' };
        },
      },
    };
  }
};
