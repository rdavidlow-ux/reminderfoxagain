# ReminderFoxAgain 0.8.1 — build prompt pack (Windows, Linux, macOS, Android, iOS)

> **In this repository** the pack is unpacked to save space: `reference/source/` is the repository itself (its root
> folder), and `reference/screenshots/` is `docs/screenshots/`. The complete, self-contained pack (with both folders
> filled in) is `ReminderFoxAgain-0.8.1-build-prompt.zip` on the Releases page.

This pack lets an AI coding agent rebuild ReminderFoxAgain 0.8.1 from scratch, with the same features and the same
look, for the platform you choose.

## Choose the platform

Open `PROMPT.md` and change the word on the first line, `**TARGET PLATFORM:** windows`, to one of:

| Target | What you get | Built and tested on |
| --- | --- | --- |
| `windows` | The Electron app with the per-user PowerShell installer: `.bat` + `.ps1` + `.asar` + runtime parts. The same release format as the 0.8.1 you have. | Linux; installer tested with PowerShell 7 |
| `linux` | The Electron app as a `.tar.gz` with a per-user `install.sh`, plus a `.deb` (with the sandbox and AppArmor set up) | Linux, fully: installed and run for real |
| `macos` | A universal (Apple silicon + Intel) `.app` as a zip (and a `.dmg` on a Mac), ad-hoc signed, or Developer-ID signed and notarized if you provide credentials | Mostly Linux; a Mac for the dmg, notarization and real-device checks |
| `android` | A Capacitor app: debug and release APK/AAB, with notifications as alarms and a phone layout | Linux (needs the Android SDK download); an emulator or phone for the last checks |
| `ios` | A Capacitor app: the Xcode project, a simulator build and an `.ipa` if you have an Apple developer team | Web parts on Linux; a Mac with Xcode for building and running |

To build for several platforms, run one session per platform. Windows, Linux and macOS share almost all their code,
and so do Android and iOS.

## What's here

| Path | What it is |
| --- | --- |
| `PROMPT.md` | The platform-neutral spec: data format and add-on compatibility, the host's job (files, backups, alarm engine, pop-up, badge), the `window.rf` bridge contract, every screen, the 34 languages, the shared tests and the acceptance criteria. |
| `platforms/<target>.md` | How to host, package, install and test on each platform, and what differs there (data folders, tray/menu bar, login items, notifications, signing, mobile layout). `mobile-common.md` is shared by Android and iOS. |
| `reference/source/` | The complete ReminderFoxAgain 0.8.1 source (Windows build): store, main process, preload, UI, 35 unit tests (Store and translations), UI checks, screenshot tools, the installer tests, installer, `build.sh`, and the README with every release note. It is the working oracle and the code to share. |
| `reference/screenshots/` | 70 screenshots of every screen, dialog, theme, the alarm window and the pop-up (1180×760). |
| `reference/assets/` | The icons for every platform, made from one vector master (`svg/`): Windows `.ico`, Linux hicolor PNGs, the macOS `.icns` and menu-bar template, the iOS 1024 icon, Android adaptive and notification icons. Also the five built-in alarm sounds as `sounds/<id>.wav` / `.caf` (chime, bell, marimba, beeps, clock). |
| `reference/fixtures/` | Two files in the original ReminderFox add-on's format, `reminderfox-addon-sample.ics` and the fuller `reminderfox-addon-full.ics`, plus `reminderfox-addon-prefs.js` (an add-on profile's list names) and `archive-sample.ics` (an old archive), used by the unit tests and the compatibility benchmark. |

## How to use it

1. Start a new session with a coding agent that has a shell and can run Node.js 22 (for example Claude Code). It needs
   npm access. Desktop targets also need Xvfb for the UI checks; Windows also needs PowerShell 7 (`pwsh`) for the
   installer checks. Mobile targets need Chromium/Playwright for the browser checks, and the Android SDK or a Mac with
   Xcode for the native build.
2. Put this folder in the agent's working directory, or attach it.
3. Set the target in `PROMPT.md` and paste the whole file as the first message. The agent then reads
   `platforms/<target>.md` itself.

The agent should finish with:
- the 35 unit tests passing in seven time zones;
- the compatibility benchmark identical to the reference;
- the UI checks with no WRONG or ERROR lines;
- the platform's own checks passing;
- screenshots matching `reference/screenshots/` (desktop) or the mobile layout rules (phones);
- the release files listed in the platform file.

Anything that can only be verified on real hardware (a Mac, an iPhone, an Android phone) is reported as a checklist
instead of claimed.

A Windows rebuild works and looks the same as the 0.8.1 you have. Its release files will only be byte-identical if
the agent builds the reference source unchanged.
