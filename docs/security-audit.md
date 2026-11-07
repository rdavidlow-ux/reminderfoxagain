# Security audit — November 2026

This report checks three outside security reviews of ReminderFoxAgain against the 0.9.5 code. The
fixes were made on the `security-audit` branch and released in **0.9.5.1**. None of the reviewers could read the code. One reasoned from the README and file
list. The other two assumed the old ReminderFox add-on (XUL, `chrome/content`, `.jsm` modules, XML storage,
`install.rdf`), which ReminderFoxAgain doesn't share any code with. So each claim below was checked against the real
code, and where possible tested.

Each claim gets one verdict:

- **Fixed** — a real gap, fixed in 0.9.5.1, with a test.
- **Already safe** — the code already does what the reviewer asked for.
- **Not applicable** — the claim is about code or files that ReminderFoxAgain doesn't have.
- **Recommendation** — worth doing, but not done here (the reason is given).

## Summary

| # | Claim | Verdict |
|---|---|---|
| 1 | The Electron bridge leaks `ipcRenderer`; the `window.__rf`/`__rfx` test hooks open a path from XSS to running code | Already safe |
| 2 | ReDoS in the email date and place finder (`maildate.js`) | Already safe (tested); subject length now capped |
| 3 | Unpatched `ical.js` parsing flaws | Already safe (2.2.1 is the latest version, with no advisories) |
| 3a | Dependencies with known flaws | **Fixed**: Electron 44.7.0 → 44.10.2 (a high-severity advisory) |
| 3b | A calendar subscription can send any amount of data | **Fixed**: downloads stop at 10 MB |
| 4 | Path traversal: an imported file overwrites files in the profile | Not applicable (no file name comes from file contents) |
| 4a | The main process opens any path a window sends | **Fixed**: only files picked in the app, or in its data folder |
| 5 | The 0.9.4 `setHTML` sanitizer may not be sound | Already safe for scripts, events and links; **fixed** one gap (SVG animation) |
| 6 | Translations are treated as code by `i18n-dom.js` | Already safe (text nodes and attributes only) |
| 7 | Text from the data reaches the page as HTML | Already safe; a new UI check covers every view and dialog |
| 8 | CSS injection through category or calendar colours and names | Already safe (colours must be `#rrggbb`; names are escaped) |
| 9 | No CSP; `unsafe-eval` / `unsafe-inline` allowed in the add-on | Already safe; the add-on's CSP is now written into the manifest |
| 10 | `eval()`, `new Function`, `innerHTML` | Already safe (none in the code) |
| 11 | XUL overlays, inline XUL handlers, JSM modules, `install.rdf`, `defaults/preferences` | Not applicable |
| 12 | XML parsing: XXE, billion laughs | Not applicable (no XML is parsed; the data is iCalendar text) |
| 13 | Broad add-on permissions | Already safe (each permission is used; web access is asked for one site at a time) |
| 14 | Browser permissions in the desktop windows | **Fixed**: every request is refused |
| 15 | Plaintext storage, no integrity checks, optional encryption | Recommendation (see below) |
| 16 | Global namespace pollution | Already safe enough (each script is wrapped in its own function) |
| 17 | Unsigned extension, code signing | Recommendation |
| 18 | CI security scanning, dependency auditing | Recommendation |
| 19 | Electron fuses (run as Node, inspector, asar integrity) | Recommendation (found in this audit) |

## The checks, claim by claim

### 1. The Electron bridge and the test hooks — already safe

- `src/main.js` `webPrefs()` opens every window (main, alarm and slider) with `contextIsolation: true`,
  `sandbox: true` and `nodeIntegration: false`.
- `secure()` refuses new windows and stops every navigation. Only `http(s):` and `mailto:` addresses go to the
  system browser or mail program.
- `src/preload.js` exposes one object, `window.rf`, through `contextBridge.exposeInMainWorld`:
  - Each function calls one named `ipcRenderer.invoke` channel. `ipcRenderer` itself is never handed out.
  - `rf.on()` takes only the 17 channels in its `CHANNELS` list and passes the payload, not the IPC event.
- `window.__rf` and `window.__rfx` are plain objects in the page, holding the page's own state and functions. They
  give no more access than any script on the page already has, and they never touch `ipcRenderer`. So a script
  injected into the page (which the CSP and the sanitizer stop anyway) couldn't use them to reach Node.

### 2. ReDoS in `maildate.js` — already safe, tested

Every pattern was run on crafted 20,000-character bodies (the body is cut to 20,000 characters before scanning).
The inputs were long runs of spaces, commas, digits and time-like text, unfinished street names, location labels,
month and day names, `On … wrote:` headers and CJK dates. Each was tried as the body, as the subject and as many
short lines. The slowest took 53 ms, and that was a first-run warm-up; repeated runs took 0–6 ms. Inputs up to
320,000 characters grow in linear time.

None of the patterns has a nested quantifier. `.{6,120}` is bounded, and the `[\s,]*…$` patterns are tried on
single lines.

As a margin of safety, the subject is now cut to 2,000 characters too (`reminderFromEmail`).

### 3. Dependencies — `ical.js` already safe; Electron fixed

- `ical.js` 2.2.1 is the latest release, and `npm audit` reports nothing for it. Imports and subscriptions are fully
  parsed before anything changes: a file that isn't a calendar is refused, and the data is left alone.
- `npm audit` found a **high** advisory in Electron 44.7.0: GHSA-jr5w-w6x2-84p9, the compromised eMudhra
  intermediate certificates. Electron is the runtime that ships in the desktop app, so it was updated to **44.10.2**
  (a patch release, same major version).
- Five moderate advisories remain, all in `@electron/packager`'s build-time helpers (`glob`, `minimatch`,
  `@electron/asar`, `@electron/universal`). None of them ships in the app. Their only fix is a downgrade to packager
  18, which would break the macOS universal build, so they were left as they are.
- `npm audit --omit=dev` (what ships): **0 vulnerabilities**.

### 3b. Subscription size — fixed

Before, the 10 MB limit was checked only after the whole calendar had been downloaded. A hostile or broken site
could send gigabytes and fill the memory first.

Now both the desktop app (`readCapped` in `src/main.js`) and the add-on (`fetchText` in `thunderbird/background.js`)
work like this:

- They refuse a response whose stated length is over 10 MB.
- They read the rest in parts and stop as soon as it passes 10 MB, with the existing message "That calendar is too
  big (more than 10 MB)."
- The 30-second timeout still applies.

**Test:** `tools/ui/subscriptions.js` subscribes to an 11 MB calendar, sent in parts with no stated length, in both
suites.

### 4. Path traversal through an import — not applicable; the main process now opens only chosen files

**The claim as stated doesn't apply.** No file name or path is ever built from an imported file's contents:

- Backups are named by the clock (`manual-<time>.ics`, `before-import-<time>.ics`).
- Subscription copies are named by a random id.
- List names and categories are only saved in the settings.

**What the check found instead:** the desktop main process opened any path a window sent through four calls:
`ics:importPath`/`importPaths`, `ics:preview`, `backup:describe` and `backup:restore`. They only read the file, and
only as a calendar. But a window that went wrong could have read another calendar file on the computer, or restored
the reminders from one.

**Fixed:** these calls now accept only:

- files the person picked in one of the app's file dialogs;
- the old ReminderFox files the app found itself;
- files inside the app's data folder (the backups).

Anything else is refused with "That file was not picked in ReminderFoxAgain, so it was not opened." This message is
translated into all 33 languages. The add-on already worked this way: its windows hand over `upload:` tokens, never
paths.

**Test:** `tools/ui/injection.js`, in both suites. Exports and "Save a backup copy" write only to a path chosen in
the system save dialog.

### 5. The `setHTML` sanitizer — already safe; one gap fixed

`RF.setHTML`/`RF.addHTML` (in `src/ui/common.js`) work in three steps:

1. They parse the HTML into a separate, inert document with `DOMParser`, where no scripts run.
2. They remove dangerous elements and attributes:
   - elements: `script`, `iframe`, `object`, `embed`, `style`, `meta`, `base`, `template` and the like;
   - every `on…` attribute, plus `srcdoc` and `is`;
   - URL attributes that aren't `http(s):`, `mailto:`, a data image, a relative path or an anchor. Control
     characters and spaces are removed first, so `java\tscript:` is caught too.
3. They move the clean nodes into the page.

The sanitizer was tried in Chromium with 31 known bypasses, including:

- entity-encoded, mixed-case, tab-split and space-led `javascript:` links;
- `xlink:href`, `formaction` and `srcset`;
- `<svg><script>` and `foreignObject`;
- `noscript`/`math`/`style` mutation tricks;
- `details ontoggle`, `meta refresh`, `base href` and `data:text/html`.

All were made harmless except one: **SVG `<animate>`/`<set>`** could still set a link's `href` to `javascript:` after
the clean-up. The page's CSP (`script-src 'self'`) would block such a link from running, and the desktop app blocks
navigation, so this wasn't exploitable. Still, the animation elements (`animate`, `set`, `animateMotion`,
`animateTransform` and `discard`) are now removed too.

**Test:** `tools/ui/safe-html.js`.

### 6. Translations as code — already safe

`src/ui/i18n-dom.js` translates the page by setting `node.nodeValue` (text nodes) and `setAttribute` (title,
placeholder and aria-label). It never parses a translation as HTML. Where a page builds HTML with a translated
string, the string goes through `esc()` as all other text does. The translations are also files shipped inside the
app (`src/ui/locales/*.json`), not something that arrives from outside.

### 7. Text from the data reaching the page as HTML — already safe; new UI check

**New test:** `tools/ui/injection.js`, run in both the desktop and the add-on suites. It names an item, its place,
notes and category, a list, and a saved filter with markup (`<img id=pwn… onerror=…>"'><b id=pwnb…>`). It then opens:

- the Reminders, Lists and Month views (Month, Week and Day) and the side panel;
- the editor, the saved filter, and the Views, Lists, Categories, Alarms, Quick alarm, Subscriptions, Go to date and
  Settings dialogs.

No element from the markup may appear, and the markup must show as text.

To prove the check works, one `esc()` in the Day/Week view was removed by hand. The test then failed in 13 places. It
also showed that the CSP stopped the injected `onerror` from running.

### 8. CSS injection — already safe

Colours that go into `style` attributes are checked first:

- Subscription colours must match `^#[0-9a-f]{6}$`, both when added and when changed (`subscriptions.js`).
- Theme colours go through `hex()` (`common.js`).
- Item colours are checked the same way (`features.js`).

Categories have no colours, and their names are escaped like other text.

### 9. CSP — already safe; written into the add-on manifest

- **Desktop app:** every page has
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:`.
  That means no `unsafe-eval` and no inline scripts. Inline *styles* are allowed, because the views place items with
  `style="top:…"`. Styles can't run code in Chromium.
- **Add-on (Manifest V2):**
  - Thunderbird's default policy (`script-src 'self'; object-src 'self'`) already barred `eval` and inline scripts.
  - The pages carry the same meta CSP as the desktop app.
  - The manifest now states its policy outright, and stricter: `script-src 'self'; object-src 'none'`.
  - Mozilla's `addons-linter` (version 7) accepts that policy and reports no unsafe code (`innerHTML`, `eval` and the
    like). Its other messages are about Thunderbird-only APIs, which a Firefox linter doesn't know.

### 10. `eval`, `new Function`, `innerHTML` — already safe

A search of `src/` and `thunderbird/` finds:

- no `eval(`, `new Function`, `document.write`, `insertAdjacentHTML` or `outerHTML`;
- one `innerHTML` read (`app.js` saves the filter menu's built-in options), and no `innerHTML` writes.

### 11–12. XUL, JSM, `install.rdf`, preferences files, XML — not applicable

None of these exist in the repository:

- no `chrome/` folder, `.xul`, `.jsm`, `install.rdf` or `defaults/preferences`;
- no XML parsing: the reminders are iCalendar text files parsed by `ical.js`. The one `XMLHttpRequest` loads the
  add-on's own translation file.

The add-on is a modern MailExtension (`manifest.json`, `background.js`), with no privileged code. When the desktop
app imports from an old ReminderFox profile, it reads that profile's `prefs.js` for list names with a single regular
expression and `JSON.parse`. It never runs it.

### 13. Add-on permissions — already safe

Each permission in `thunderbird/build.js` is used, and the manifest says why:

- `messagesRead`: "Add reminder…" reads an email's subject and text.
- `messagesTags` and `messagesUpdate`: the ReminderFoxAgain tag.
- `compose`: "Send by email…" and invitations. A message is never sent without the person.
- `addressBooks`: birthdays and address suggestions.
- `accountsRead`: the sender of an invitation.
- `storage`, `notifications`, `menus`, `tabs` and `idle`: the add-on's own working.

Web access (`*://*/*`) is optional and asked for one site at a time, when the person subscribes or imports a linked
calendar.

### 14. Browser permissions in the desktop windows — fixed

Electron grants a page's permission requests (camera, microphone, location, notifications…) unless the app says
otherwise. The pages need none of them: alarms use the main process's notifications, and sounds use Web Audio. So the
app now refuses every request, with `setPermissionRequestHandler` and `setPermissionCheckHandler`.

### 15. Plaintext storage, integrity checks, encryption — recommendation

The reminders are plain iCalendar files in the person's own profile folder (`%APPDATA%\ReminderFoxAgain`, or
Thunderbird's add-on storage). Only that user account can read them, as with Thunderbird's own mail and calendar.
Plain `.ics` is deliberate: the files can be read, backed up and imported by other calendar programs.

- **A SHA-256 hash beside the file** wouldn't stop a program running as the same user, since it could rewrite the
  hash too. Against accidental damage, the app already checks every file before it uses it: a file that can't be
  read is never overwritten, and the daily backups remain.
- **Encryption** would need a password or the system keychain on three platforms, and the files would then no longer
  open in other programs. If wanted, it should be an opt-in feature with its own design.
- **"Migrate storage to JSON"** doesn't apply: the data isn't XML.

### 16. Global namespace — already safe enough

Each page script is wrapped in its own function (`(function () { … })()`). Only a few named objects are shared
between scripts (`RF`, `RFHost`, and the test hooks above). Because all scripts are the app's own (`script-src 'self'`),
no outside script could override them.

### 17. Signing — recommendation

- The add-on `.xpi` is installed by hand today, so Thunderbird doesn't check a signature. Publishing on
  addons.thunderbird.net (already planned in the README) would sign it and give automatic updates.
- The macOS app is signed ad hoc and not notarized.
- The Windows installer isn't signed.

Signing the Windows and macOS builds needs paid certificates (an Authenticode certificate and an Apple Developer ID),
so that is the owner's decision. Until then, the SHA-256 sums published with each release let people check their
download.

### 18. CI scanning and dependency auditing — recommendation

The repository has no CI on `main` (the Android branch has a build workflow). A small workflow is suggested:

- runs `npm audit --omit=dev --audit-level=high` and `npm test` on each push;
- uses Dependabot for npm;
- optionally adds GitHub's CodeQL JavaScript scan.

It wasn't added here, because the Actions API can't be reached from this environment to check that it runs.

### 19. Electron fuses — recommendation (found in this audit)

The desktop app's executable keeps Electron's default fuses. This means:

- `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect` still work;
- the asar archive isn't checked for integrity.

A program already running as the user could use the executable as a signed-looking Node.js. Turning these off with
`@electron/fuses` at build time would close that:

- `RunAsNode`, `EnableNodeOptionsEnvironmentVariable` and `EnableNodeCliInspectArguments` off;
- `EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` on.

It wasn't done here, because the Windows installer ships the runtime and the app archive as separate parts. The
change needs a Windows install test.

## Tests

- `npm test`: 65 unit tests pass.
- `tools/e2e.sh` (desktop): 852 UI checks, 0 problems.
- `thunderbird/test/e2e.sh` (add-on): 891 UI checks, 0 problems.

## Changes in 0.9.5.1

| File | Change |
|---|---|
| `package.json`, `package-lock.json` | Electron 44.7.0 → 44.10.2 |
| `src/main.js` | only chosen files are opened (`offer`/`chosen`); subscription downloads capped at 10 MB while reading (`readCapped`); browser permission requests refused |
| `thunderbird/background.js` | subscription downloads capped at 10 MB while reading |
| `thunderbird/build.js` | the manifest's `content_security_policy`: `script-src 'self'; object-src 'none'` |
| `src/ui/common.js` | the sanitizer removes SVG animation elements |
| `src/host/maildate.js` | the subject is cut to 2,000 characters before scanning |
| `tools/i18n/add-security-audit.py`, `tools/i18n/*.txt`, `src/ui/locales/*.json` | the new message in all 33 languages |
| `tools/ui/injection.js` (new), `tools/e2e.sh`, `thunderbird/test/e2e.sh` | markup in the data stays text everywhere; files not picked are refused |
| `tools/ui/safe-html.js` | SVG animation check |
| `tools/ui/subscriptions.js`, `tools/sample-calendar.js`, `thunderbird/test/run.js` | an 11 MB calendar is refused |
| `src/ui/app.js`, `tools/ui/keep-place.js` (new) | found while testing the build: after a change the Reminders list goes back to the same row, not the same pixel offset (it could jump to the first date or a year ahead in Thunderbird) |
| `tools/ui/month-scroll.js`, `tools/ui/day-week.js` | the date-dependent test fixes from the Android branch (they failed on some days of the month) |
