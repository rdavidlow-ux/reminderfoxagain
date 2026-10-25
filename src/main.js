'use strict';
// ReminderFoxAgain — Electron main process: data file, windows, tray, alarms and IPC.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, BrowserWindow, ipcMain, Tray, Menu, shell, dialog, nativeImage, screen, powerMonitor, nativeTheme } = require('electron');
const { Store, dayKey, timeKey, setPhrases } = require('./core/store');
const I18N = require('./ui/i18n.js');

const VERSION = require('../package.json').version;
const APP_NAME = 'ReminderFoxAgain';
const APP_ID = 'org.reminderfoxagain.desktop';
const ROOT = path.join(__dirname, '..');
const ICON = path.join(ROOT, 'assets', 'icon.png');
const TRAY_ICON = path.join(ROOT, 'assets', 'tray.png');
const HOUR = 3600000;
const DAY = 24 * HOUR;

app.setAppUserModelId(APP_ID);
app.setName(APP_NAME);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// ---------------------------------------------------------------- data folder
const DATA_DIR = process.env.RF_DATA_DIR ? path.resolve(process.env.RF_DATA_DIR) : path.join(app.getPath('appData'), APP_NAME);
if (!process.env.RF_DATA_DIR) app.setPath('userData', DATA_DIR);
const DATA_FILE = path.join(DATA_DIR, 'reminders.ics');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
// Chromium's own locale files (date pickers, the text box menu) for the app languages; languages Chromium has no
// file for (be, fy, ga, gl, mn) use its English one. build.sh keeps exactly these files.
const CHROMIUM_LOCALES = ['ar', 'ca', 'cs', 'da', 'de', 'es', 'et', 'fi', 'fr', 'he', 'hu', 'it', 'ja', 'ko', 'nb', 'nl', 'pl',
  'pt-BR', 'pt-PT', 'ro', 'ru', 'sk', 'sv', 'tr', 'uk', 'vi', 'zh-CN', 'zh-TW'];
function chromiumLang(code) {
  if (CHROMIUM_LOCALES.includes(code)) return code;
  const base = String(code).split('-')[0];
  return CHROMIUM_LOCALES.includes(base) ? base : 'en-US';
}
// A chosen language also sets Chromium's own locale (date and time pickers), which can only be set before start-up.
try {
  const chosen = process.env.RF_LANG || (JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).settings || {}).language;
  if (chosen) app.commandLine.appendSwitch('lang', chromiumLang(I18N.resolve(chosen, 'en')));
} catch (e) { /* the system language */ }
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const ARCHIVE_FILE = path.join(DATA_DIR, 'archive.ics'); // archived items: kept for reference, never listed or alarmed

const DEFAULT_SETTINGS = {
  startWithWindows: true, closeToTray: true, weekStart: 0, defaultAlarm: null,
  snoozeAmount: 10, snoozeUnit: 'minutes', alarmSound: true, theme: '',
  // alarms (0.3.0)
  // alarmTone: a built-in sound (chime, bell, marimba, beeps, clock) or 'file' for soundFile (0.8.0);
  // resoundMinutes -1 = continuously until the alarm is dealt with (0.8.0)
  soundFile: null, soundName: '', resoundMinutes: 0, alarmTone: 'chime',
  sliderEnabled: false, sliderShow: 'both', sliderEvery: 60, sliderKeep: 15, sliderCorner: 'br', sliderSound: false,
  upcomingDays: 15, badge: 'today',
  // display
  textSize: 100, dateFormat: '', timeFormat: '', sidePanel: true, miniMonths: 1, mapService: 'google',
  // columns hidden in the Reminders tab and in the lists (0.8.0): chk imp date day time repeat cat alarm
  remColumnsHidden: [], todoColumnsHidden: [],
  todayLabel: '[time]  [reminderDesc]', upcomingLabel: '[shortMonth] [date]  [reminderDesc]', tooltipUpcoming: true,
  // lists
  language: '', listTabs: true, lists: [], categories: [], views: [], repeatAhead: 'm12', pastRepeatDays: 'all', hideRepeating: false, hideCompleted: false, todoSort: 'date',
  // your own themes (0.8.1): [{id, name, bg, surface, ink, accent, star}]; theme 'custom:<id>' uses one
  customThemes: [],
};
const SOUND_DIR = path.join(DATA_DIR, 'sounds');

let store = new Store('');
let archive = new Store('');
let state = { settings: { ...DEFAULT_SETTINGS }, bounds: null, dismissed: {}, snoozed: {}, quickAlarms: [], suspend: null };
let sliderWin = null;
let sliderTimer = null;
let resumeTimer = null;
let loadError = null;
let mainWin = null;
let alarmWin = null;
let tray = null;
let quitting = false;
let currentAlarms = [];
let shownKeys = new Set();
let snoozeTimer = null;
let checkTimer = null;

const exists = (p) => { try { fs.accessSync(p); return true; } catch (e) { return false; } };
const today = () => dayKey(new Date());

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// ---------------------------------------------------------------- state + data
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = { ...state, ...s };
  } catch (e) { /* defaults */ }
  const set = { ...(state.settings || {}) };
  if (set.snoozeMinutes != null && set.snoozeAmount == null) {
    const m = Number(set.snoozeMinutes);
    if (m > 0 && m % 60 === 0) { set.snoozeAmount = m / 60; set.snoozeUnit = 'hours'; }
    else if (m > 0) { set.snoozeAmount = Math.round(m); set.snoozeUnit = 'minutes'; }
  }
  delete set.snoozeMinutes;
  // before 0.2.4 the themes were '', 'light' (= today's Fox look) and 'dark'
  if (!set.themeVersion) { if (set.theme === 'light') set.theme = 'fox'; set.themeVersion = 2; }
  delete set.monthShowDone; // 0.8.0 only: the Month view's Show completed is ticked at every start since 0.8.1
  // before 0.8.0 a chosen sound file was always used
  if (!set.alarmTone) set.alarmTone = set.soundFile ? 'file' : 'chime';
  state.settings = { ...DEFAULT_SETTINGS, ...set };
  state.dismissed = state.dismissed || {};
  state.snoozed = state.snoozed || {};
  state.quickAlarms = Array.isArray(state.quickAlarms) ? state.quickAlarms : [];
  state.suspend = state.suspend && typeof state.suspend === 'object' ? state.suspend : null;
  for (const k of ['lists', 'categories', 'views', 'remColumnsHidden', 'todoColumnsHidden', 'customThemes']) if (!Array.isArray(state.settings[k])) state.settings[k] = [];
}
let stateTimer = null;
function saveState(now) {
  clearTimeout(stateTimer);
  const write = () => { try { writeAtomic(STATE_FILE, JSON.stringify(state, null, 2)); } catch (e) { console.error('state', e.message); } };
  if (now) write(); else stateTimer = setTimeout(write, 300);
}
function loadData() {
  if (!exists(DATA_FILE)) { store = new Store(''); return; }
  const text = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    store = new Store(text);
  } catch (e) {
    let keep = `${DATA_FILE}.unreadable`;
    for (let n = 2; exists(keep) && fs.readFileSync(keep, 'utf8') !== text; n++) keep = `${DATA_FILE}.unreadable-${n}`;
    if (!exists(keep)) fs.copyFileSync(DATA_FILE, keep);
    loadError = `Your reminders file could not be read (${e.message}). It was kept as ${path.basename(keep)}.`;
    store = new Store('');
  }
}
function backupIfNeeded(file = DATA_FILE, prefix = 'reminders') {
  if (!exists(file)) return;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const name = path.join(BACKUP_DIR, `${prefix}-${today()}.ics`);
  if (!exists(name)) fs.copyFileSync(file, name);
  const re = new RegExp(`^${prefix}-\\d{4}-\\d{2}-\\d{2}\\.ics$`);
  const daily = fs.readdirSync(BACKUP_DIR).filter((f) => re.test(f)).sort();
  for (const f of daily.slice(0, Math.max(0, daily.length - 30))) { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (e) { /* ignore */ } }
}
function saveData() {
  backupIfNeeded();
  writeAtomic(DATA_FILE, store.toString());
}
function saveArchive() {
  if (archiveBroken) throw new Error('The archive file could not be read, so it is not changed. It was kept as archive.ics.unreadable.');
  backupIfNeeded(ARCHIVE_FILE, 'archive');
  writeAtomic(ARCHIVE_FILE, archive.toString());
}
let archiveBroken = false;
function loadArchive() {
  if (!exists(ARCHIVE_FILE)) { archive = new Store(''); return; }
  const text = fs.readFileSync(ARCHIVE_FILE, 'utf8');
  try { archive = new Store(text); } catch (e) {
    const keep = `${ARCHIVE_FILE}.unreadable`;
    if (!exists(keep)) fs.copyFileSync(ARCHIVE_FILE, keep);
    archive = new Store('');
    archiveBroken = true;
    loadError = (loadError ? `${loadError} ` : '') + `Your archive file could not be read (${e.message}). It was kept as archive.ics.unreadable.`;
  }
}
// 0.6.0 has no Archive tab: archived items live in the "Terminated or Suspended" list. Anything still in archive.ics
// (from an earlier version, or brought back by restoring an old backup) is moved there: a copy of archive.ics is kept
// in backups first, the item loses its archive marks, and a reminder becomes a to-do on the list (as Move to list does).
// The lists are written before the archive, so an item is never lost; one whose UID is already in the lists stays as
// it is there and is only dropped from the archive.
const ARCHIVE_LIST = 'Terminated or Suspended';
let archiveMoved = 0;
function archiveToList() {
  if (archiveBroken || !archive.count()) return 0;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(path.join(BACKUP_DIR, `archive-before-list-${stamp()}.ics`), archive.toString());
  let n = 0;
  for (const uid of archive.list().map((d) => d.uid)) {
    const d = archive.extract(uid);
    if (!d || store.get(uid)) continue;
    store.insert(d, { archived: false });
    store.moveToList(uid, ARCHIVE_LIST);
    n++;
  }
  if (n) addLists([ARCHIVE_LIST]);
  saveData();
  writeAtomic(ARCHIVE_FILE, archive.toString());
  saveState(true);
  return n;
}
function changed() {
  saveData();
  broadcast('data:changed');
  updateTray();
  checkAlarms();
}
function broadcast(ch, payload) {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(ch, payload);
}
function orderedLists() {
  const fromData = store.todoLists().slice(1);
  const mine = state.settings.lists.filter((l) => l && l !== "To-Do's");
  return ["To-Do's", ...mine, ...fromData.filter((l) => !mine.includes(l)).sort((a, b) => a.localeCompare(b))];
}
function allCategories() {
  return [...new Set([...store.categories(), ...state.settings.categories])].sort((a, b) => a.localeCompare(b));
}
function meta() {
  return {
    categories: allCategories(), todoLists: orderedLists(), settings: state.settings, suspend: suspendedUntil(),
    listCounts: store.listCounts(), categoryCounts: store.categoryCounts(),
    dataFile: DATA_FILE, count: store.count(), archiveCount: archive.count(), archiveFile: ARCHIVE_FILE,
    loadError, version: VERSION, archiveMoved,
  };
}

// ---------------------------------------------------------------- windows
function onScreen(b) {
  try {
    return screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return b.x < a.x + a.width - 40 && b.x + b.width > a.x + 40 && b.y >= a.y - 10 && b.y < a.y + a.height - 40;
    });
  } catch (e) { return false; }
}
function secure(win) {
  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  wc.on('will-navigate', (e, url) => { e.preventDefault(); if (/^(https?|mailto):/i.test(url)) openExternal(url); });
}
function openExternal(u) {
  if (typeof u === 'string' && /^(https?:\/\/|mailto:)/i.test(u)) { shell.openExternal(u); return true; }
  return false;
}
const THEME_BG = { fox: '#fbf8f4', light: '#f6f7f9', dark: '#1d1712', ocean: '#f4f8f8', contrast: '#000000' };
const DARK_THEMES = ['dark', 'contrast'];
// a custom theme ('custom:<id>'), or null
const customTheme = () => { const t = String(state.settings.theme || ''); return t.startsWith('custom:') ? (state.settings.customThemes || []).find((c) => `custom:${c.id}` === t) || null : null; };
const isHex = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''));
const darkHex = (c) => { const n = parseInt(c.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 < 0.45; };
const bgColor = () => { const c = customTheme(); if (c && isHex(c.bg)) return c.bg; return THEME_BG[state.settings.theme] || (nativeTheme.shouldUseDarkColors ? '#1d1712' : '#fbf8f4'); };
function applyNativeTheme() {
  const t = state.settings.theme;
  const c = customTheme();
  nativeTheme.themeSource = c && isHex(c.bg) ? (darkHex(c.bg) ? 'dark' : 'light') : !t || !THEME_BG[t] ? 'system' : DARK_THEMES.includes(t) ? 'dark' : 'light';
  for (const w of [mainWin, alarmWin]) if (w && !w.isDestroyed()) w.setBackgroundColor(bgColor());
}
function webPrefs() {
  return { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false };
}

function createMain(showIt) {
  const opts = {
    width: 1180, height: 760, minWidth: 820, minHeight: 540, backgroundColor: bgColor(),
    title: APP_NAME, icon: ICON, show: false, webPreferences: webPrefs(),
  };
  const b = state.bounds;
  const forced = /^(\d+)x(\d+)$/.exec(process.env.RF_WINDOW_SIZE || ''); // test hook: fixed window size
  if (forced) Object.assign(opts, { width: Number(forced[1]), height: Number(forced[2]) });
  else if (b && b.width >= 820 && b.height >= 540 && onScreen(b)) Object.assign(opts, { x: b.x, y: b.y, width: b.width, height: b.height });
  mainWin = new BrowserWindow(opts);
  mainWin.removeMenu();
  secure(mainWin);
  mainWin.loadFile(path.join(__dirname, 'ui', 'index.html'));
  mainWin.webContents.on('did-finish-load', () => applyZoom(mainWin));
  mainWin.once('ready-to-show', () => { if (showIt) mainWin.show(); });
  let bt = null;
  const remember = () => {
    clearTimeout(bt);
    bt = setTimeout(() => {
      if (!mainWin || mainWin.isDestroyed() || mainWin.isMaximized() || mainWin.isMinimized() || mainWin.isFullScreen()) return;
      state.bounds = mainWin.getBounds();
      saveState();
    }, 400);
  };
  mainWin.on('resize', remember);
  mainWin.on('move', remember);
  mainWin.on('close', (e) => {
    if (quitting) return;
    if (state.settings.closeToTray && tray) {
      e.preventDefault();
      mainWin.hide();
      if (!state.settings.trayHintShown) {
        state.settings.trayHintShown = true;
        saveState();
        try {
          if (process.platform === 'win32') tray.displayBalloon({ title: tr('{app} is still running', { app: APP_NAME }), content: tr('Alarms will keep popping up. Right-click the fox in the system tray to quit.'), iconType: 'info' });
        } catch (err) { /* no balloon support */ }
      }
    } else {
      quitting = true;
      app.quit();
    }
  });
  mainWin.on('closed', () => { mainWin = null; });
}
function showMain() {
  if (!mainWin || mainWin.isDestroyed()) createMain(true);
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
}

function createAlarmWin() {
  const wa = screen.getPrimaryDisplay().workArea;
  const w = 500; const h = 360;
  alarmWin = new BrowserWindow({
    width: w, height: h, minWidth: 360, minHeight: 220, x: wa.x + wa.width - w - 16, y: wa.y + wa.height - h - 16,
    frame: false, alwaysOnTop: true, resizable: true, skipTaskbar: false, show: false, focusable: true,
    backgroundColor: bgColor(), title: tr('{app} alarm', { app: APP_NAME }), icon: ICON, webPreferences: webPrefs(),
  });
  alarmWin.removeMenu();
  secure(alarmWin);
  alarmWin.loadFile(path.join(__dirname, 'ui', 'alarm.html'));
  alarmWin.webContents.on('did-finish-load', () => applyZoom(alarmWin));
  alarmWin.once('ready-to-show', () => { if (alarmWin && !alarmWin.isDestroyed()) { alarmWin.showInactive(); alarmWin.flashFrame(true); } });
  alarmWin.on('page-title-updated', (e) => e.preventDefault());
  alarmWin.on('closed', () => { alarmWin = null; shownKeys = new Set(); });
}

// ---------------------------------------------------------------- language
// Settings → Display → Language ('' = the system language). The same locale files translate every window (sent to
// each page by the preload), the tray and dialogs here (tr), and the store's repeat descriptions and ages.
let uiLang = 'en';
let uiDict = {};
let L = I18N.create('en', {});
// the system locale as a BCP 47 tag Intl accepts ("en-US@posix" or "fr_FR.UTF-8" from a Linux shell become en-US, fr-FR)
function systemLocale() {
  let s = 'en';
  try { s = (app.getSystemLocale && app.getSystemLocale()) || app.getLocale() || 'en'; } catch (e) { /* default */ }
  s = String(s).replace(/[.@].*$/, '').replace(/_/g, '-');
  try { return Intl.getCanonicalLocales(s)[0] || 'en'; } catch (e) { return 'en'; }
}
// dates in the app language, in the system's regional form when it is the same language (en-CA, fr-BE…)
function dateLocale() {
  const sys = systemLocale();
  return sys.split('-')[0].toLowerCase() === uiLang.split('-')[0].toLowerCase() ? sys : uiLang;
}
function loadLanguage() {
  uiLang = I18N.resolve(process.env.RF_LANG || state.settings.language || '', systemLocale()); // RF_LANG: tests and screenshots
  uiDict = {};
  if (uiLang !== 'en') { try { uiDict = JSON.parse(fs.readFileSync(path.join(__dirname, 'ui', 'locales', `${uiLang}.json`), 'utf8')); } catch (e) { console.error('language', uiLang, e.message); } }
  L = I18N.create(uiLang, uiDict);
  const loc = dateLocale();
  const WDI = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  setPhrases(uiLang === 'en' ? null : {
    t: L.t, ordinal: L.ordinal,
    weekday: (code) => new Date(2024, 0, 7 + WDI[code]).toLocaleDateString(loc, { weekday: 'short' }),
    month: (m) => new Date(2024, (m || 1) - 1, 1).toLocaleDateString(loc, { month: 'short' }),
    monthDay: (m, d) => new Date(2024, (m || 1) - 1, d).toLocaleDateString(loc, { month: 'short', day: 'numeric' }),
    date: (key) => { const [y, mo, d] = String(key).split('-').map(Number); return new Date(y, mo - 1, d).toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' }); },
  });
}
const tr = (s, vars) => L.t(s, vars);
const I18N_COLLECT = process.env.RF_I18N_COLLECT || '';
ipcMain.on('i18n:get', (e) => {
  e.returnValue = { lang: uiLang, dict: uiDict, dateLocale: dateLocale(), collect: !!I18N_COLLECT, systemLang: I18N.resolve('', systemLocale()) };
});
ipcMain.on('i18n:missing', (e, text) => { if (I18N_COLLECT) try { fs.appendFileSync(I18N_COLLECT, `${JSON.stringify(String(text))}\n`); } catch (err) { /* ignore */ } });
function applyLanguage() {
  loadLanguage();
  if (tray) { tray.setContextMenu(trayMenu()); lastTip = ''; updateTray(); }
  for (const w of [mainWin, alarmWin, sliderWin]) if (w && !w.isDestroyed()) w.webContents.reload();
}

// ---------------------------------------------------------------- tray
// The add-on's label variables: [reminderDesc] [time] [timeUntil] [daysUntil] [longDay] [shortDay] [longMonth]
// [shortMonth] [numMonth] [date] [longYear] [shortYear]
const LOCALE = () => dateLocale();
function fmtTime(ms) {
  const tf = state.settings.timeFormat;
  return new Date(ms).toLocaleTimeString(LOCALE(), { hour: 'numeric', minute: '2-digit', ...(tf === '24' ? { hourCycle: 'h23' } : tf === '12' ? { hour12: true } : {}) });
}
function label(template, r, now = Date.now()) {
  const d = new Date(r.start);
  const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - t0) / DAY);
  const mins = Math.max(0, Math.round((r.start - now) / 60000));
  const until = r.allDay ? (days === 0 ? tr('today') : tr(days === 1 ? '{n} day' : '{n} days', { n: days }))
    : mins < 60 ? tr('{n} min', { n: mins }) : mins < 1440 ? tr('{n} h {n2} min', { n: Math.floor(mins / 60), n2: mins % 60 }) : tr(Math.floor(mins / 1440) === 1 ? '{n} day' : '{n} days', { n: Math.floor(mins / 1440) });
  const loc = LOCALE();
  const v = {
    reminderDesc: r.summary, time: r.allDay ? '' : fmtTime(r.start), timeUntil: until, daysUntil: String(days),
    longDay: d.toLocaleDateString(loc, { weekday: 'long' }), shortDay: d.toLocaleDateString(loc, { weekday: 'short' }),
    longMonth: d.toLocaleDateString(loc, { month: 'long' }), shortMonth: d.toLocaleDateString(loc, { month: 'short' }),
    numMonth: String(d.getMonth() + 1), date: String(d.getDate()), longYear: String(d.getFullYear()), shortYear: String(d.getFullYear()).slice(2),
  };
  return String(template || '[reminderDesc]').replace(/\[(\w+)\]/g, (m, k) => (k in v ? v[k] : m)).replace(/\(\s*\)/g, '').replace(/\s{3,}/g, '  ').trim();
}
function todayAndUpcoming(now = Date.now()) {
  const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
  const t1 = new Date(t0); t1.setDate(t1.getDate() + 1);
  const tN = new Date(t0); tN.setDate(tN.getDate() + 1 + Math.max(0, Number(state.settings.upcomingDays) || 0));
  let todayRows = []; let upcoming = [];
  try {
    const rows = store.occurrences(t0, tN, { includeTodos: true, now }).filter((r) => !r.completed && (r.kind === 'event' || r.date));
    todayRows = rows.filter((r) => r.date === dayKey(t0));
    upcoming = rows.filter((r) => r.date > dayKey(t0) && r.start >= t1.getTime());
  } catch (e) { /* ignore */ }
  return { today: todayRows, upcoming };
}
function trayTooltip() {
  const now = Date.now();
  const { today: rows, upcoming } = todayAndUpcoming(now);
  let todos = [];
  try { todos = store.tooltipTodos(); } catch (e) { /* ignore */ }
  const reminders = rows.filter((r) => r.kind === 'event');
  const lines = reminders.slice(0, 8).map((r) => label(state.settings.todayLabel, r, now));
  if (state.settings.tooltipUpcoming) for (const r of upcoming.filter((x) => x.kind === 'event').slice(0, Math.max(0, 6 - lines.length))) lines.push(label(state.settings.upcomingLabel, r, now));
  // to-dos flagged "show in tooltip" (from the add-on, or set in the editor)
  for (const d of todos.slice(0, Math.max(0, 8 - lines.length))) lines.push(`${tr('To-do')}  ${d.display}`);
  const sus = suspendedUntil();
  const head = sus ? (sus.until ? tr('{app} — alarms off until {time}', { app: APP_NAME, time: fmtTime(sus.until) }) : tr('{app} — alarms off', { app: APP_NAME })) : APP_NAME;
  if (!lines.length) return sus ? head : tr('{app} — nothing today', { app: APP_NAME });
  const s = `${head} — ${reminders.length ? tr('today') : tr('coming up')}:\n${lines.join('\n')}`;
  return s.length > 127 ? s.slice(0, 126) + '…' : s;
}
function trayMenu() {
  const sus = suspendedUntil();
  return Menu.buildFromTemplate([
    { label: tr('Open {app}', { app: APP_NAME }), click: showMain },
    { label: tr('Add reminder…'), click: () => { showMain(); send(mainWin, 'ui:new', { kind: 'event' }); } },
    { label: tr('Add list item…'), click: () => { showMain(); send(mainWin, 'ui:new', { kind: 'todo' }); } },
    { label: tr('Quick alarm…'), click: () => { showMain(); send(mainWin, 'ui:quick'); } },
    { type: 'separator' },
    sus ? { label: tr('Resume alarms'), click: () => setSuspend(0) } : { label: tr('Suspend alarms…'), click: () => { showMain(); send(mainWin, 'ui:suspend'); } },
    { label: tr("Show today's reminders"), click: () => showSlider(true) },
    { type: 'separator' },
    { label: tr('Quit {app}', { app: APP_NAME }), click: () => { quitting = true; app.quit(); } },
  ]);
}
function createTray() {
  try {
    tray = new Tray(nativeImage.createFromPath(TRAY_ICON));
  } catch (e) { tray = null; return; }
  tray.setContextMenu(trayMenu());
  tray.on('click', showMain);
  tray.on('double-click', showMain);
  updateTray();
}
let lastTip = '';
function updateTray() {
  if (!tray) return;
  const tip = trayTooltip();
  if (tip !== lastTip) { lastTip = tip; try { tray.setToolTip(tip); } catch (e) { /* ignore */ } }
}
function send(win, ch, payload) {
  if (!win || win.isDestroyed()) return;
  const go = () => win.webContents.send(ch, payload);
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', go); else go();
}

// ---------------------------------------------------------------- start with Windows
function applyLoginItem() {
  if (!app.isPackaged || process.platform !== 'win32') return;
  try {
    app.setLoginItemSettings({ openAtLogin: !!state.settings.startWithWindows, args: ['--hidden'], name: APP_ID });
  } catch (e) { console.error('login item', e.message); }
}

// ---------------------------------------------------------------- alarms
function checkAlarms() {
  const now = Date.now();
  // keep the add-on's "remind until completed" flag in step (1 = waiting, 2 = a missed occurrence is carried to today)
  try { if (store.syncUntilDone(now)) { saveData(); broadcast('data:changed'); } } catch (e) { console.error('until-done', e.message); }
  let fired = [];
  try { fired = store.alarms(now - 48 * HOUR, now + 1); } catch (e) { console.error('alarms', e.message); }
  // quick alarms (kept in state.json, like the add-on kept them in its preferences)
  for (const q of state.quickAlarms) if (q.at <= now) fired.push(quickRow(q));
  // prune
  for (const [k, t] of Object.entries(state.dismissed)) if (now - t > 7 * DAY) delete state.dismissed[k];
  for (const k of Object.keys(state.snoozed)) if (!itemExists(k)) delete state.snoozed[k];
  const due = [];
  const seen = new Set();
  for (const a of fired) {
    if (state.dismissed[a.key]) continue;
    const sn = state.snoozed[a.key];
    if (sn && sn.until > now) continue;
    seen.add(a.key);
    due.push(a);
  }
  for (const [k, sn] of Object.entries(state.snoozed)) {
    if (sn.until > now || seen.has(k) || state.dismissed[k]) continue;
    const a = sn.alarm;
    if (!a || !itemExists(k)) continue;
    if (fired.some((f) => f.key === k)) continue;
    seen.add(k);
    due.push(a);
  }
  due.sort((x, y) => x.at - y.at);
  currentAlarms = due;
  const sus = suspendedUntil(now);
  const fresh = due.filter((a) => !shownKeys.has(a.key));
  if (sus) {
    // suspended: nothing pops up; what is due shows once alarms resume
    if (alarmWin && !alarmWin.isDestroyed()) alarmWin.close();
    shownKeys = new Set();
    armResume(now);
  } else if (!due.length) {
    if (alarmWin && !alarmWin.isDestroyed()) alarmWin.close();
    shownKeys = new Set();
  } else if (fresh.length) {
    if (!alarmWin || alarmWin.isDestroyed()) createAlarmWin();
    else {
      if (!alarmWin.isVisible()) alarmWin.showInactive();
      alarmWin.moveTop();
      alarmWin.flashFrame(true);
      send(alarmWin, 'alarms:ring');
    }
    for (const a of fresh) shownKeys.add(a.key);
  }
  for (const k of [...shownKeys]) if (!seen.has(k)) shownKeys.delete(k);
  send(alarmWin, 'alarms:update', { alarms: due, settings: state.settings });
  armSnoozeTimer(now);
  armQuickTimer(now);
  updateTray();
  saveState();
}
function itemExists(key) {
  const [uid, id] = String(key).split('|');
  if (uid === 'quick') return state.quickAlarms.some((q) => q.id === id);
  return !!store.get(uid);
}
function quickRow(q) {
  return { key: `quick|${q.id}|${q.at}`, uid: `quick|${q.id}`, quick: true, kind: 'event', summary: q.text || 'Quick alarm', notes: q.notes || '',
    location: '', start: q.at, end: q.at, at: q.at, date: dayKey(q.at), time: timeKey(q.at), allDay: false, important: false, categories: [] };
}
let quickTimer = null;
function armQuickTimer(now) {
  clearTimeout(quickTimer);
  const ahead = state.quickAlarms.map((q) => q.at).filter((t) => t > now);
  if (ahead.length) quickTimer = setTimeout(checkAlarms, Math.min(Math.min(...ahead) - now + 50, 6 * HOUR));
}
function removeQuick(key) {
  const [kind, id] = String(key).split('|');
  if (kind !== 'quick') return false;
  state.quickAlarms = state.quickAlarms.filter((q) => q.id !== id);
  for (const k of Object.keys(state.snoozed)) if (k.startsWith(`quick|${id}|`)) delete state.snoozed[k];
  return true;
}
// ---------------------------------------------------------------- suspend alarms
function suspendedUntil(now = Date.now()) {
  const s = state.suspend;
  if (!s) return null;
  if (s.until && s.until <= now) { state.suspend = null; saveState(); return null; }
  return { since: s.since, until: s.until || null };
}
function armResume(now) {
  clearTimeout(resumeTimer);
  const s = state.suspend;
  if (s && s.until) resumeTimer = setTimeout(() => { checkAlarms(); refreshTrayMenu(); broadcast('settings:changed', state.settings); }, Math.min(s.until - now + 50, 6 * HOUR));
}
// until: a time in ms, null = until resumed, 0 = resume now
function setSuspend(until) {
  if (until === 0) state.suspend = null;
  else state.suspend = { since: Date.now(), until: until || null };
  saveState(true);
  checkAlarms();
  refreshTrayMenu();
  broadcast('settings:changed', state.settings);
  return suspendedUntil();
}
function refreshTrayMenu() { if (tray) { try { tray.setContextMenu(trayMenu()); } catch (e) { /* ignore */ } } updateTray(); }

// ---------------------------------------------------------------- alert slider (today's and upcoming reminders)
function sliderData(now = Date.now()) {
  const { today: t, upcoming } = todayAndUpcoming(now);
  const show = state.settings.sliderShow;
  return {
    today: show === 'upcoming' ? [] : t.slice(0, 30),
    upcoming: show === 'today' ? [] : upcoming.slice(0, 30),
    settings: state.settings,
  };
}
function showSlider(force) {
  if (!force && (!state.settings.sliderEnabled || suspendedUntil())) return;
  const data = sliderData();
  if (!force && !data.today.length && !data.upcoming.length) return;
  const wa = screen.getPrimaryDisplay().workArea;
  const w = 360; const h = 380;
  const c = state.settings.sliderCorner || 'br';
  const x = c.endsWith('l') ? wa.x + 16 : wa.x + wa.width - w - 16;
  const y = c.startsWith('t') ? wa.y + 16 : wa.y + wa.height - h - 16;
  if (!sliderWin || sliderWin.isDestroyed()) {
    sliderWin = new BrowserWindow({ width: w, height: h, x, y, frame: false, alwaysOnTop: true, resizable: false, skipTaskbar: true, show: false,
      focusable: true, backgroundColor: bgColor(), title: tr('{app} — today', { app: APP_NAME }), icon: ICON, webPreferences: webPrefs() });
    sliderWin.removeMenu();
    secure(sliderWin);
    sliderWin.loadFile(path.join(__dirname, 'ui', 'slider.html'));
    sliderWin.once('ready-to-show', () => { if (sliderWin && !sliderWin.isDestroyed()) { applyZoom(sliderWin); sliderWin.showInactive(); } });
    sliderWin.on('closed', () => { sliderWin = null; });
  } else { sliderWin.setPosition(x, y); sliderWin.showInactive(); }
  send(sliderWin, 'slider:update', data);
}
function armSlider() {
  clearInterval(sliderTimer);
  const every = Number(state.settings.sliderEvery) || 0;
  if (state.settings.sliderEnabled && every > 0) sliderTimer = setInterval(() => showSlider(false), every * 60000);
}

// ---------------------------------------------------------------- text size
function applyZoom(win) {
  if (!win || win.isDestroyed()) return;
  const f = Math.min(2, Math.max(0.7, (Number(state.settings.textSize) || 100) / 100));
  try { win.webContents.setZoomFactor(f); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------- sound file
const SOUND_TYPES = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', webm: 'audio/webm' };
let soundCache = null;
function soundData() {
  const f = state.settings.soundFile;
  if (!f || state.settings.alarmTone !== 'file') return null;
  const p = path.join(SOUND_DIR, path.basename(f));
  if (soundCache && soundCache.p === p) return soundCache.url;
  try {
    const ext = path.extname(p).slice(1).toLowerCase();
    const url = `data:${SOUND_TYPES[ext] || 'audio/mpeg'};base64,${fs.readFileSync(p).toString('base64')}`;
    soundCache = { p, url };
    return url;
  } catch (e) { return null; }
}

// ---------------------------------------------------------------- backups
function stamp() { const d = new Date(); return `${today()}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`; }
// one file with everything: reminders and to-dos, plus archived items (they keep their archive marks)
function combinedText() {
  const combo = new Store(store.toString());
  if (archive.count()) combo.import(archive.toString());
  return combo.toString();
}
function backupNow() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `manual-${stamp()}.ics`);
  writeAtomic(file, combinedText());
  return file;
}
function describeBackup(file) {
  const name = path.basename(file);
  const st = fs.statSync(file);
  let items = 0; let archived = 0; let error = null;
  try {
    const s = new Store(fs.readFileSync(file, 'utf8'));
    for (const d of s.list()) { if (d.archivedAt) archived++; else items++; }
  } catch (e) { error = e.message; }
  const kind = /^manual-/.test(name) ? 'Backup made by you' : /^before-restore-/.test(name) ? 'Saved before a restore'
    : /^before-import-/.test(name) ? 'Saved before an import replaced everything' : /^archive-before-list-/.test(name) ? 'The archive, before it became a list' : /^archive-/.test(name) ? 'Daily backup of the archive (earlier version)'
      : /^reminders-/.test(name) ? 'Daily backup' : 'Backup';
  return { name, path: file, modified: st.mtimeMs, size: st.size, items, archived, kind, error };
}
function listBackups() {
  let names = [];
  try { names = fs.readdirSync(BACKUP_DIR).filter((f) => /\.ics$/i.test(f)); } catch (e) { return []; }
  return names.map((n) => describeBackup(path.join(BACKUP_DIR, n))).sort((a, b) => b.modified - a.modified);
}
// Replaces the reminders (and the archive, when the backup has archived items or is an archive backup) with a backup.
// The current data is saved first as backups/before-restore-<time>.ics, so a restore can itself be undone.
function restoreBackup(file) {
  const text = fs.readFileSync(file, 'utf8');
  const incoming = new Store(text); // throws a clear error for a file that isn't a calendar
  const name = path.basename(file);
  const all = incoming.list();
  const live = all.filter((d) => !d.archivedAt).map((d) => d.uid);
  const arch = all.filter((d) => d.archivedAt).map((d) => d.uid);
  const isArchiveFile = /^archive-/.test(name);
  const replaceMain = !isArchiveFile;
  const replaceArchive = isArchiveFile || arch.length > 0 || /^(manual|before-restore)-/.test(name);
  if (replaceArchive && archiveBroken) throw new Error('The archive file could not be read, so it cannot be replaced.');
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const safety = path.join(BACKUP_DIR, `before-restore-${stamp()}.ics`);
  writeAtomic(safety, combinedText());
  if (replaceMain) {
    const next = new Store('');
    for (const uid of live) next.insert(incoming.extract(uid), null);
    store = next;
    loadError = null;
    writeAtomic(DATA_FILE, store.toString());
  }
  if (replaceArchive) {
    const next = new Store('');
    for (const uid of (isArchiveFile ? [...arch, ...live] : arch)) next.insert(incoming.extract(uid), null);
    archive = next;
    writeAtomic(ARCHIVE_FILE, archive.toString());
  }
  const moved = archiveToList();
  if (moved) broadcast('settings:changed', state.settings);
  broadcast('data:changed');
  updateTray();
  checkAlarms();
  return { items: store.count(), moved, list: ARCHIVE_LIST, safety: path.basename(safety) };
}
function armSnoozeTimer(now) {
  clearTimeout(snoozeTimer);
  const ahead = Object.values(state.snoozed).map((s) => s.until).filter((u) => u > now);
  if (!ahead.length) return;
  const wait = Math.min(Math.min(...ahead) - now + 50, 6 * HOUR);
  snoozeTimer = setTimeout(checkAlarms, wait);
}
function findAlarm(key) { return currentAlarms.find((a) => a.key === key) || (state.snoozed[key] && state.snoozed[key].alarm) || null; }
function snooze(key, seconds) {
  if (typeof seconds !== 'number' || !Number.isInteger(seconds) || seconds < 1 || seconds > 999 * 3600) return false;
  if (typeof key !== 'string' || !key) return false;
  const alarm = findAlarm(key) || { key, uid: key.split('|')[0], start: Number(key.split('|')[1]), at: Number(key.split('|')[2]), summary: '' };
  state.snoozed[key] = { until: Date.now() + seconds * 1000, alarm };
  delete state.dismissed[key];
  shownKeys.delete(key);
  saveState(true);
  checkAlarms();
  return true;
}
function dismiss(key) {
  if (removeQuick(key)) { saveState(true); checkAlarms(); return true; }
  state.dismissed[key] = Date.now();
  delete state.snoozed[key];
  saveState(true);
  checkAlarms();
  return true;
}

// ---------------------------------------------------------------- import helpers
// opts.mode 'replace': everything you have is saved as backups/before-import-<time>.ics, then replaced by the files'
// items. opts.duplicates 'skip' | 'import' and opts.category are passed to Store.import.
function importFiles(files, opts = {}) {
  const total = { added: 0, updated: 0, skipped: 0, duplicates: 0, lists: [], replaced: null };
  const texts = files.map((f) => fs.readFileSync(f, 'utf8'));
  for (const x of texts) new Store(x); // every file must be a calendar before anything changes
  if (opts.mode === 'replace') {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const safety = path.join(BACKUP_DIR, `before-import-${stamp()}.ics`);
    writeAtomic(safety, combinedText());
    total.replaced = { count: store.count(), safety: path.basename(safety) };
    store = new Store('');
    loadError = null;
  }
  for (const [i, f] of files.entries()) {
    const r = store.import(texts[i], { duplicates: opts.mode === 'replace' ? 'import' : opts.duplicates, category: opts.category });
    total.added += r.added; total.updated += r.updated; total.skipped += r.skipped; total.duplicates += r.duplicates || 0;
    total.lists.push(...addLists(addonLists(f)));
  }
  if (total.lists.length) { saveState(true); broadcast('settings:changed', state.settings); }
  if (opts.category && !state.settings.categories.includes(String(opts.category).trim())) { state.settings.categories.push(String(opts.category).trim()); saveState(true); }
  if (total.added || total.updated || total.lists.length || total.replaced) changed(); else broadcast('data:changed');
  return total;
}
function previewFiles(files) {
  const out = { files: files.map((f) => path.basename(f)), events: 0, todos: 0, existing: 0, duplicates: 0, current: store.count() };
  for (const f of files) {
    const p = store.previewImport(fs.readFileSync(f, 'utf8'));
    out.events += p.events; out.todos += p.todos; out.existing += p.existing; out.duplicates += p.duplicates;
  }
  return out;
}
// The add-on kept the names and order of its custom to-do lists in the profile's prefs.js
// (user_pref("extensions.reminderFox.todoLists", "Errands,Movies")), next to the reminderfox folder. Lists with no
// items are only known from there, so an import of <profile>/reminderfox/reminderfox.ics reads them too.
function addonLists(icsFile) {
  const prefs = path.join(path.dirname(path.dirname(path.resolve(icsFile))), 'prefs.js');
  let text = '';
  try { text = fs.readFileSync(prefs, 'utf8'); } catch (e) { return []; }
  const m = /user_pref\(\s*"extensions\.reminderFox\.todoLists"\s*,\s*("(?:[^"\\]|\\.)*")\s*\)/i.exec(text);
  if (!m) return [];
  let v = '';
  try { v = JSON.parse(m[1]); } catch (e) { return []; }
  return v.split(',').map((s) => s.trim()).filter((s) => s && !/[:]/.test(s) && s !== "To-Do's");
}
// Adds list names that aren't known yet (any letter case), keeping their order. Returns the ones added.
function addLists(names) {
  const known = new Set(orderedLists().map((l) => l.toLowerCase()));
  const mine = state.settings.lists.slice();
  const added = [];
  for (const n of names) {
    if (known.has(n.toLowerCase())) { if (!mine.some((l) => l.toLowerCase() === n.toLowerCase())) mine.push(n); continue; }
    known.add(n.toLowerCase()); mine.push(n); added.push(n);
  }
  state.settings.lists = mine;
  return added;
}
function findOldFiles() {
  const appData = app.getPath('appData');
  const home = os.homedir();
  const roots = [
    path.join(appData, 'Mozilla', 'Firefox', 'Profiles'),
    path.join(appData, 'Thunderbird', 'Profiles'),
    path.join(appData, 'Mozilla', 'SeaMonkey', 'Profiles'),
    path.join(appData, 'Waterfox', 'Profiles'),
    path.join(appData, 'Moonchild Productions', 'Pale Moon', 'Profiles'),
    path.join(home, '.mozilla', 'firefox'),
    path.join(home, '.thunderbird'),
  ];
  const out = [];
  for (const r of roots) {
    let profiles = [];
    try { profiles = fs.readdirSync(r); } catch (e) { continue; }
    for (const p of profiles) {
      const f = path.join(r, p, 'reminderfox', 'reminderfox.ics');
      try { const st = fs.statSync(f); if (st.isFile()) out.push({ path: f, modified: st.mtimeMs, size: st.size }); } catch (e) { /* none */ }
    }
  }
  return out.sort((a, b) => b.modified - a.modified);
}
const ICS_FILTERS_EN = [{ name: 'iCalendar files', extensions: ['ics', 'ical', 'ifb', 'icalendar'] }, { name: 'All files', extensions: ['*'] }];
const icsFilters = () => ICS_FILTERS_EN.map((f) => ({ ...f, name: tr(f.name) }));

// ---------------------------------------------------------------- IPC
function handle(ch, fn) {
  ipcMain.handle(ch, async (e, ...args) => {
    try { return { ok: true, value: await fn(e, ...args) }; } catch (err) { return { ok: false, error: (err && err.message) || String(err) }; }
  });
}
function parentOf(e) { return BrowserWindow.fromWebContents(e.sender) || mainWin; }
function setupIpc() {
  handle('data:range', (e, from, to, opts) => store.occurrences(from, to, opts || {}));
  handle('data:next', (e, from, opts) => store.nextOccurrences(from, opts || {}));
  // past occurrences of repeating reminders, ticked or not, as far back as Settings → View says
  handle('data:history', (e, before, opts) => {
    if (opts && opts.tickedOnly) return store.completedHistory(before); // views without dates: as before 0.3.1
    const days = state.settings.pastRepeatDays;
    const since = days === 'all' || days == null ? null : Number(before) - Math.max(1, Number(days) || 365) * DAY;
    return store.completedHistory(before, { since });
  });
  handle('data:all', () => store.list());
  handle('data:get', (e, uid) => store.get(uid));
  handle('data:save', (e, dto) => { const uid = store.upsert(dto); changed(); return uid; });
  handle('data:delete', (e, uid, occ) => { const r = store.remove(uid, occ); changed(); return r; });
  handle('data:complete', (e, uid, done, occ) => { const r = store.setCompleted(uid, done, occ); changed(); return r; });
  handle('data:meta', () => meta());
  handle('data:openFolder', () => { if (exists(DATA_FILE)) shell.showItemInFolder(DATA_FILE); else shell.openPath(DATA_DIR); return true; });
  handle('open:url', (e, u) => openExternal(u));
  handle('settings:set', (e, patch) => {
    state.settings = { ...state.settings, ...(patch || {}) };
    delete state.settings.snoozeMinutes;
    saveState(true);
    if (patch && 'startWithWindows' in patch) applyLoginItem();
    if (patch && ('theme' in patch || 'customThemes' in patch)) applyNativeTheme();
    if (patch && 'textSize' in patch) for (const w of [mainWin, alarmWin, sliderWin]) applyZoom(w);
    if (patch && Object.keys(patch).some((k) => k.startsWith('slider'))) armSlider();
    if (patch && Object.keys(patch).some((k) => /Label$|tooltipUpcoming|upcomingDays|timeFormat/.test(k))) updateTray();
    if (patch && 'soundFile' in patch && !patch.soundFile) soundCache = null;
    if (patch && 'language' in patch) setTimeout(applyLanguage, 50);
    broadcast('settings:changed', state.settings);
    send(alarmWin, 'alarms:update', { alarms: currentAlarms, settings: state.settings });
    return state.settings;
  });
  handle('ics:import', async (e) => {
    const r = await dialog.showOpenDialog(parentOf(e), { title: tr('Import iCalendar file'), filters: icsFilters(), properties: ['openFile', 'multiSelections'] });
    if (r.canceled || !r.filePaths.length) return null;
    return importFiles(r.filePaths);
  });
  handle('ics:importPath', (e, p) => importFiles([p]));
  handle('ics:export', async (e, opts) => {
    const kind = opts && opts.kind;
    const prefix = kind === 'event' ? 'reminders' : kind === 'todo' ? 'todos' : 'reminderfoxagain';
    const r = await dialog.showSaveDialog(parentOf(e), {
      title: tr('Export to iCalendar file'), defaultPath: path.join(app.getPath('documents'), `${prefix}-${today()}.ics`),
      filters: [{ name: tr('iCalendar files'), extensions: ['ics'] }],
    });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, store.export(kind === 'event' || kind === 'todo' ? { kinds: [kind] } : {}));
    return r.filePath;
  });
  handle('rf:findOld', () => findOldFiles());
  // the import dialog: pick files, see what they hold, then import with the chosen options
  handle('ics:pick', async (e, kind) => {
    const r = await dialog.showOpenDialog(parentOf(e), { title: tr(kind === 'old' ? 'Choose your reminderfox.ics' : 'Import an iCalendar file'), filters: icsFilters(), properties: kind === 'old' ? ['openFile'] : ['openFile', 'multiSelections'] });
    return r.canceled || !r.filePaths.length ? null : r.filePaths;
  });
  handle('ics:preview', (e, files) => previewFiles([].concat(files)));
  handle('ics:importPaths', (e, files, opts) => importFiles([].concat(files), opts || {}));
  handle('rf:pickFile', async (e) => {
    const r = await dialog.showOpenDialog(parentOf(e), { title: tr('Choose your reminderfox.ics'), filters: icsFilters(), properties: ['openFile'] });
    if (r.canceled || !r.filePaths.length) return null;
    return importFiles(r.filePaths);
  });
  handle('alarm:snooze', (e, key, seconds) => snooze(key, seconds));
  handle('alarm:dismiss', (e, key) => dismiss(key));
  handle('alarm:dismissAll', () => {
    const now = Date.now();
    for (const a of currentAlarms) { if (!removeQuick(a.key)) { state.dismissed[a.key] = now; delete state.snoozed[a.key]; } }
    saveState(true);
    checkAlarms();
    return true;
  });
  handle('alarm:complete', (e, key) => {
    const [uid, start] = String(key).split('|');
    if (uid === 'quick') return dismiss(key);
    if (store.get(uid)) { store.setCompleted(uid, true, Number(start)); state.dismissed[key] = Date.now(); delete state.snoozed[key]; changed(); }
    else dismiss(key);
    return true;
  });
  handle('alarm:open', (e, key) => {
    const [uid, start] = String(key).split('|');
    showMain();
    if (uid === 'quick') { send(mainWin, 'ui:quick'); return true; }
    send(mainWin, 'ui:edit', { uid, start: Number(start) });
    return true;
  });
  handle('alarm:hide', () => { if (alarmWin && !alarmWin.isDestroyed()) alarmWin.hide(); return true; });
  handle('alarm:state', () => ({ alarms: suspendedUntil() ? [] : currentAlarms, settings: state.settings }));
  // quick alarms
  handle('quick:list', () => state.quickAlarms.slice().sort((a, b) => a.at - b.at));
  handle('quick:add', (e, q) => {
    const at = Number(q && q.at);
    if (!Number.isFinite(at) || at <= Date.now() - 60000) throw new Error('Please choose a time in the future.');
    const item = { id: require('crypto').randomUUID().slice(0, 8), text: String((q && q.text) || '').trim() || 'Quick alarm', notes: String((q && q.notes) || ''), at };
    state.quickAlarms.push(item);
    saveState(true);
    checkAlarms();
    return item;
  });
  handle('quick:remove', (e, id) => { removeQuick(`quick|${id}`); saveState(true); checkAlarms(); return true; });
  // suspend
  handle('suspend:set', (e, until) => setSuspend(until));
  handle('suspend:get', () => suspendedUntil());
  // sound
  handle('sound:choose', async (e) => {
    const r = await dialog.showOpenDialog(parentOf(e), { title: tr('Choose an alarm sound'), properties: ['openFile'],
      filters: [{ name: tr('Sound files'), extensions: Object.keys(SOUND_TYPES) }, { name: tr('All files'), extensions: ['*'] }] });
    if (r.canceled || !r.filePaths.length) return null;
    const src = r.filePaths[0];
    const ext = path.extname(src).slice(1).toLowerCase();
    if (!SOUND_TYPES[ext]) throw new Error('Please choose a sound file (.mp3, .wav, .ogg, .m4a, .aac, .flac or .webm).');
    if (fs.statSync(src).size > 10 * 1024 * 1024) throw new Error('That sound file is larger than 10 MB. Please choose a shorter one.');
    fs.mkdirSync(SOUND_DIR, { recursive: true });
    for (const f of fs.readdirSync(SOUND_DIR)) if (/^alarm-sound\./.test(f)) fs.unlinkSync(path.join(SOUND_DIR, f));
    const name = `alarm-sound.${ext}`;
    fs.copyFileSync(src, path.join(SOUND_DIR, name));
    soundCache = null;
    state.settings = { ...state.settings, soundFile: name, soundName: path.basename(src), alarmTone: 'file' };
    saveState(true);
    broadcast('settings:changed', state.settings);
    return state.settings;
  });
  handle('sound:data', () => soundData());
  // alert slider
  handle('slider:state', () => sliderData());
  handle('slider:show', () => { showSlider(true); return true; });
  handle('slider:close', () => { if (sliderWin && !sliderWin.isDestroyed()) sliderWin.close(); return true; });
  handle('slider:open', (e, uid, start) => { showMain(); send(mainWin, 'ui:edit', { uid, start }); if (sliderWin && !sliderWin.isDestroyed()) sliderWin.close(); return true; });
  // badge (images drawn by the main window)
  handle('badge:set', (e, trayUrl, overlayUrl, text, count) => {
    try {
      if (tray) tray.setImage(trayUrl ? nativeImage.createFromDataURL(trayUrl) : nativeImage.createFromPath(TRAY_ICON));
      if (mainWin && !mainWin.isDestroyed() && typeof mainWin.setOverlayIcon === 'function') mainWin.setOverlayIcon(overlayUrl ? nativeImage.createFromDataURL(overlayUrl) : null, text || '');
      if (process.platform !== 'win32') app.setBadgeCount(Number(count) || 0);
    } catch (err) { /* badges are optional */ }
    return true;
  });
  // lists, categories, order
  handle('data:moveToList', (e, uid, list) => { const r = store.moveToList(uid, list); changed(); return r; });
  // an exact copy, in the same place (opts.suffix for the title) or on another list (opts.list)
  handle('data:duplicate', (e, uid, opts) => {
    const o = opts || {};
    if (o.list != null && /[,:]/.test(String(o.list))) throw new Error('A list name can\'t contain a comma or a colon.');
    const r = store.duplicate(uid, o);
    if (o.list != null) addLists([String(o.list).trim()].filter((l) => l && l !== "To-Do's"));
    changed();
    return r;
  });
  handle('data:order', (e, uids) => { store.setOrder(uids || []); changed(); return true; });
  handle('lists:rename', (e, from, to) => {
    to = String(to || '').trim();
    if (!to || /[,:]/.test(to)) throw new Error('A list name can\'t be empty or contain a comma or a colon.');
    const n = store.renameList(from, to) + archive.renameList(from, to);
    state.settings.lists = state.settings.lists.map((l) => (l === from ? to : l)).filter((l, i, a) => l !== "To-Do's" && a.indexOf(l) === i);
    saveState(true);
    try { saveArchive(); } catch (err) { /* archive unchanged */ }
    changed();
    broadcast('settings:changed', state.settings);
    return n;
  });
  // opts.deleteItems: delete the list's to-dos instead of moving them to "To-Do's" (archived ones always move)
  handle('lists:remove', (e, name, opts) => {
    const n = (opts && opts.deleteItems ? store.removeListItems(name) : store.renameList(name, "To-Do's")) + archive.renameList(name, "To-Do's");
    state.settings.lists = state.settings.lists.filter((l) => l !== name);
    saveState(true);
    try { saveArchive(); } catch (err) { /* archive unchanged */ }
    changed();
    broadcast('settings:changed', state.settings);
    return n;
  });
  handle('categories:rename', (e, from, to) => {
    to = String(to || '').trim();
    const n = store.renameCategory(from, to) + archive.renameCategory(from, to);
    state.settings.categories = [...new Set(state.settings.categories.map((c) => (c === from ? to : c)).filter(Boolean))];
    saveState(true);
    try { saveArchive(); } catch (err) { /* archive unchanged */ }
    changed();
    broadcast('settings:changed', state.settings);
    return n;
  });
  // backups
  handle('backup:now', async (e, choose) => {
    const file = backupNow();
    if (!choose) return file;
    const r = await dialog.showSaveDialog(parentOf(e), { title: tr('Save a backup copy'), defaultPath: path.join(app.getPath('documents'), `ReminderFoxAgain-backup-${today()}.ics`),
      filters: [{ name: 'iCalendar files', extensions: ['ics'] }] });
    if (r.canceled || !r.filePath) return file;
    fs.copyFileSync(file, r.filePath);
    return r.filePath;
  });
  handle('backup:list', () => listBackups());
  handle('backup:describe', (e, file) => describeBackup(file));
  handle('backup:choose', async (e) => {
    const r = await dialog.showOpenDialog(parentOf(e), { title: tr('Choose a backup to restore'), defaultPath: BACKUP_DIR, filters: icsFilters(), properties: ['openFile'] });
    if (r.canceled || !r.filePaths.length) return null;
    return describeBackup(r.filePaths[0]);
  });
  handle('backup:restore', (e, file) => restoreBackup(file));
  handle('backup:openFolder', () => { fs.mkdirSync(BACKUP_DIR, { recursive: true }); shell.openPath(BACKUP_DIR); return true; });
}

// ---------------------------------------------------------------- test hooks
const sleep = (t) => new Promise((r) => setTimeout(r, t));
async function runScript(win, file) {
  const code = fs.readFileSync(path.resolve(file), 'utf8');
  return win.webContents.executeJavaScript(`(async () => {\n${code}\n})()`, true);
}
async function screenshotMode(out) {
  await new Promise((r) => (mainWin.webContents.isLoading() ? mainWin.webContents.once('did-finish-load', r) : r()));
  await sleep(2500);
  try {
    if (process.env.RF_SCRIPT) await runScript(mainWin, process.env.RF_SCRIPT);
  } catch (e) { console.error('RF_SCRIPT failed:', e.message); }
  await sleep(1200);
  const img = await mainWin.webContents.capturePage();
  fs.writeFileSync(out, img.toPNG());
  if (sliderWin && !sliderWin.isDestroyed()) {
    const sl = await sliderWin.webContents.capturePage();
    fs.writeFileSync(out.replace(/\.png$/i, '') + '-popup.png', sl.toPNG());
  }
  if (alarmWin && !alarmWin.isDestroyed()) {
    alarmWin.show();
    await sleep(800);
    const a = await alarmWin.webContents.capturePage();
    fs.writeFileSync(out.replace(/\.png$/i, '') + '-alarm.png', a.toPNG());
    try { if (process.env.RF_ALARM_SCRIPT) await runScript(alarmWin, process.env.RF_ALARM_SCRIPT); } catch (e) { console.error('RF_ALARM_SCRIPT failed:', e.message); }
    await sleep(1500);
  }
  quitting = true;
  app.quit();
}

// ---------------------------------------------------------------- start
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMain());
  app.on('before-quit', () => { quitting = true; saveState(true); });
  app.on('window-all-closed', () => { if (quitting || !tray) app.quit(); });
  app.whenReady().then(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    loadState();
    loadLanguage();
    loadData();
    loadArchive();
    try { archiveMoved = archiveToList(); } catch (e) { console.error('archive to list', e.message); }
    applyNativeTheme();
    setupIpc();
    applyLoginItem();
    createTray();
    const hidden = process.argv.includes('--hidden') && !process.env.RF_SCREENSHOT;
    createMain(!hidden);
    checkAlarms();
    checkTimer = setInterval(checkAlarms, 15000);
    armSlider();
    if (!process.env.RF_SCREENSHOT) setTimeout(() => showSlider(false), 8000);
    powerMonitor.on('resume', () => setTimeout(checkAlarms, 3000));
    powerMonitor.on('unlock-screen', () => setTimeout(checkAlarms, 1000));
    if (process.env.RF_SCREENSHOT) screenshotMode(path.resolve(process.env.RF_SCREENSHOT)).catch((e) => { console.error(e); app.exit(1); });
  });
}
