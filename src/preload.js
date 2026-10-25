'use strict';
// The only bridge between the sandboxed pages and the main process.
const { contextBridge, ipcRenderer } = require('electron');

async function call(ch, ...args) {
  const r = await ipcRenderer.invoke(ch, ...args);
  if (!r || !r.ok) throw new Error((r && r.error) || 'Unknown error');
  return r.value;
}
const CHANNELS = ['data:changed', 'settings:changed', 'alarms:update', 'alarms:ring', 'ui:new', 'ui:edit', 'ui:quick', 'ui:suspend', 'slider:update'];

// the language data, fetched once and synchronously, so a page is translated before it is first shown
let i18n = { lang: 'en', dict: {}, dateLocale: '', collect: false };
try { i18n = ipcRenderer.sendSync('i18n:get') || i18n; } catch (e) { /* English */ }

contextBridge.exposeInMainWorld('rf', {
  i18n,
  i18nMissing: (text) => ipcRenderer.send('i18n:missing', String(text)),
  range: (from, to, opts) => call('data:range', from, to, opts),
  next: (from, opts) => call('data:next', from, opts),
  history: (before, opts) => call('data:history', before, opts),
  all: () => call('data:all'),
  get: (uid) => call('data:get', uid),
  save: (dto) => call('data:save', dto),
  remove: (uid, occ) => call('data:delete', uid, occ),
  complete: (uid, done, occ) => call('data:complete', uid, done, occ),
  moveToList: (uid, list) => call('data:moveToList', uid, list),
  duplicate: (uid, opts) => call('data:duplicate', uid, opts),
  setOrder: (uids) => call('data:order', uids),
  renameList: (from, to) => call('lists:rename', from, to),
  removeList: (name, opts) => call('lists:remove', name, opts),
  renameCategory: (from, to) => call('categories:rename', from, to),
  quickList: () => call('quick:list'),
  quickAdd: (q) => call('quick:add', q),
  quickRemove: (id) => call('quick:remove', id),
  suspend: (until) => call('suspend:set', until),
  suspended: () => call('suspend:get'),
  chooseSound: () => call('sound:choose'),
  soundData: () => call('sound:data'),
  sliderState: () => call('slider:state'),
  showSlider: () => call('slider:show'),
  closeSlider: () => call('slider:close'),
  openFromSlider: (uid, start) => call('slider:open', uid, start),
  setBadge: (trayUrl, overlayUrl, text, count) => call('badge:set', trayUrl, overlayUrl, text, count),
  backupNow: (choose) => call('backup:now', choose),
  backupList: () => call('backup:list'),
  backupDescribe: (file) => call('backup:describe', file),
  backupChoose: () => call('backup:choose'),
  backupRestore: (file) => call('backup:restore', file),
  openBackups: () => call('backup:openFolder'),
  meta: () => call('data:meta'),
  openDataFolder: () => call('data:openFolder'),
  openUrl: (u) => call('open:url', u),
  setSettings: (patch) => call('settings:set', patch),
  importIcs: () => call('ics:import'),
  importPath: (p) => call('ics:importPath', p),
  pickIcs: (kind) => call('ics:pick', kind),
  previewImport: (files) => call('ics:preview', files),
  importPaths: (files, opts) => call('ics:importPaths', files, opts),
  exportIcs: (opts) => call('ics:export', opts),
  findOld: () => call('rf:findOld'),
  pickOld: () => call('rf:pickFile'),
  snooze: (key, seconds) => call('alarm:snooze', key, seconds),
  dismiss: (key) => call('alarm:dismiss', key),
  dismissAll: () => call('alarm:dismissAll'),
  completeAlarm: (key) => call('alarm:complete', key),
  openAlarm: (key) => call('alarm:open', key),
  hideAlarm: () => call('alarm:hide'),
  alarmState: () => call('alarm:state'),
  on: (channel, fn) => {
    if (!CHANNELS.includes(channel)) throw new Error(`Unknown channel ${channel}`);
    const h = (e, payload) => fn(payload);
    ipcRenderer.on(channel, h);
    return () => ipcRenderer.removeListener(channel, h);
  },
});
