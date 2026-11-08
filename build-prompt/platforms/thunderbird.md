# Platform: Thunderbird add-on (the main platform)

ReminderFoxAgain as a Thunderbird MailExtension for Thunderbird 128 and later, on Windows, macOS and Linux. It is the
same app: the pages in `src/ui` and the modules in `src/core` are used unchanged; only the host is new. The reference
source has it complete in `thunderbird/` and `src/host/`; rebuild it from there.

## Stack

Node.js 22 for the build and tests; `ical.js` **2.2.1** bundled into the add-on. No other runtime dependency. Manifest
V2 with a persistent background page (`background.scripts`), so the alarm engine keeps its timers as in the desktop
main process. `browser_specific_settings.gecko`: id `reminderfoxagain@rdavidlow-ux.github.io`, `strict_min_version` `128.0`;
`author` `David Low`.

## Host

| Part | File | Job |
| --- | --- | --- |
| Host core | `src/host/core.js` | The platform-neutral half of the desktop `src/main.js`: data file, `state.json`, daily backups, the alarm engine, quick alarms, suspend, pop-up data, badge and tooltip text, import and export, subscriptions, the Alarms view, and the whole `window.rf` channel table. It takes an adapter (storage, timers, windows, notifications, files, fetch, clock) and imports no Electron or Node module. |
| Adapter | `thunderbird/background.js` | Runs the core in the background page. Files are `storage.local` entries with the desktop names (`reminders.ics`, `state.json`, `backups/<name>`, `subscriptions/<id>.ics`). The main window is a tab (`tabs.create`, focused when it exists); the alarm (500×360, bottom right) and pop-up (360×380, chosen corner) are `windows.create({type:'popup'})`, plus `notifications.create`. The toolbar button (`browserAction`) has the tooltip, the badge and the tray menu (`menus` with `contexts:['browser_action']`). `idle.onStateChanged` re-checks alarms after sleep. |
| Bridge | `thunderbird/bridge.js` | `window.rf` in each page, as `runtime.sendMessage({channel, args})`; events come back as messages. File pickers (`<input type=file>`) and saving (a download link) run in the page, because only a page can show them. |
| Overlay | `thunderbird/tb.js`, `tb.css` | Hides the desktop-only settings (start at login, tray, open folders), adds where the data is kept, Settings → General's "Tag emails…" and "Birthday reminders…", the Invite people dialog, and the welcome page's **Import from your ReminderFox add-on**: an add-on can't search other profile folders, so it says where `reminderfox.ics` is (the profile's `reminderfox` folder; Help → Troubleshooting Information → Profile Folder → Open Folder) and **Choose the file…** opens the picker (picking `prefs.js` too brings the list names). |
| Shortcuts | `thunderbird/shortcuts.json` | `commands`: Alt+Shift+R open, and A, O, Q, K, J, B, I, X, D, S, L, each forwarded to the page as that key. Letters avoid Thunderbird's menu access keys (F E V G M N T H). Tooltips read `commands.getAll()`. |
| Wording | `src/ui/i18n-dom.js` | When `document.documentElement.dataset.host === 'thunderbird'`, three texts read the Thunderbird way and the tooltips show the commands as set. |

`meta().host` is `thunderbird` (`meta().platform` the operating system). The bridge adds `window.rf.openEmail(messageId)`; its presence shows ✉ Open email in the editor and the right-click menu.

## Email features (Thunderbird only)

| Feature | APIs |
| --- | --- |
| Add reminder… / Add list item… on an email or selected text, in a ReminderFoxAgain submenu | `menus` (`message_list`, `selection`), `messages.getFull`; `src/host/maildate.js` finds the first date to come, the time and the place (quoted replies left out; relative words from the sent date) |
| Open email | The Message-ID in `X-REMINDERFOX-MESSAGEID` (as the original add-on), `messages.query({headerMessageId})`, `messageDisplay.open` |
| Remind me after sending (Send++) | `compose_action` toggle, `compose.onAfterSend` |
| Tags | `messages.tags.create` (orange "ReminderFoxAgain"), `messages.update`; removed when the item is done or deleted |
| Send by email…, Invite people… | `compose.beginNew` with the item as text and an `.ics` (`METHOD:REQUEST`, ORGANIZER from `accounts`/`identities`, ATTENDEEs); `messages.onNewMailReceived` reads `METHOD:REPLY` and records PARTSTAT by UID |
| Birthdays | `addressBooks.contacts`, the vCard BDAY → yearly items in the Birthday category, followed on change |
| Import this calendar… (.ics link), subscriptions | `permissions.request({origins:[<that origin>/*]})` (optional_permissions `*://*/*`), then `fetch`; webcal:// as https:// |

Permissions: `storage`, `unlimitedStorage`, `notifications`, `menus`, `tabs`, `idle`, `messagesRead`, `messagesTags`,
`messagesUpdate`, `compose`, `addressBooks`, `accountsRead`. Never send a message without the user: every one opens in
a compose window.

## Build (`build-thunderbird.sh`, `thunderbird/build.js`)

1. Run the unit tests (seven time zones as the desktop build).
2. Bundle the core, the store, `alarmlist.js`, `subscriptions.js`, `maildate.js`, ical.js and the locales into `host.js`.
3. Copy `src/ui` into the add-on with `bridge.js`, `tb.js` and `tb.css` added to each page.
4. Write `manifest.json` (version from `package.json`) and zip `dist/release-thunderbird/ReminderFoxAgain-<ver>-thunderbird.xpi`
   with sorted entries and fixed dates (`SOURCE_DATE_EPOCH=1767225600`), so two builds give the same file.

## Tests

- **Unit:** `test/host-core.test.js` runs the core with an in-memory adapter and a clock the test moves;
  `test/maildate.test.js` the date, time and place finder. Both are in `npm test`.
- **UI:** `thunderbird/test/e2e.sh` serves the built add-on, opens its background page in Chromium with
  `mock-browser.js` (storage, tabs, windows, browserAction, menus, notifications, commands, permissions, messages and
  tags, compose, addressBooks, accounts), clicks the toolbar button, and runs the desktop's `tools/ui/*.js` scripts in
  the tab and the alarm window, plus `tb-smoke.js` and `tb-welcome.js` for what the add-on does its own way. Last line:
  `0 problem(s)` (about 920 checks).
- **Lint:** `web-ext lint -s dist/thunderbird`: 0 errors. Its warnings name only Thunderbird-only APIs and permissions (since 0.9.4 the pages use `RF.setHTML` instead of `innerHTML`).
- **Real Thunderbird:** install the .xpi (Add-ons and Themes → ⚙ → Install Add-on From File…) or load
  `dist/thunderbird/manifest.json` as a temporary add-on, and check the shortcuts, the welcome import, alarms and the
  email features with real mail.

## Deliverables

`ReminderFoxAgain-<ver>-thunderbird.xpi`, `SHA256SUMS`, and a README that says: install from file (Thunderbird asks to
confirm, since it isn't signed by addons.thunderbird.net), update by installing the newer .xpi, remove from Add-ons and
Themes (back up first: the data is in the add-on's storage).
