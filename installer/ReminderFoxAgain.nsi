; ReminderFoxAgain — Windows installer (NSIS 3, 64-bit, per user, no administrator rights).
; build.sh compiles it on Linux:  makensis -DVERSION=<x.y.z> -DAPPDIR=<packaged app folder> -DLANGFILE=<lang.nsh>
;   -DOUTFILE=<setup.exe> installer/ReminderFoxAgain.nsi
; The same Setup file installs, updates (over 0.9.1 and earlier too) and repairs. Your reminders
; (%APPDATA%\ReminderFoxAgain) are never touched by an install or an update; the uninstaller asks before deleting them.

Unicode true
Target amd64-unicode
!ifdef QUICK
  SetCompressor zlib   ; for a quick test build only
!else
  SetCompressor /SOLID lzma
  SetCompressorDictSize 32
!endif
ManifestDPIAware true
RequestExecutionLevel user

!ifndef VERSION
  !error "VERSION is not set"
!endif
!define APP "ReminderFoxAgain"
!define EXE "ReminderFoxAgain.exe"
!define APP_ID "org.reminderfoxagain.desktop"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ReminderFoxAgain"
!define UNINSTALLER "Uninstall ReminderFoxAgain.exe"

Name "${APP}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP}"
BrandingText "${APP} ${VERSION}"
ShowInstDetails nevershow
ShowUninstDetails nevershow

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=0 "ProductName" "${APP}"
VIAddVersionKey /LANG=0 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "FileDescription" "${APP} Setup"
VIAddVersionKey /LANG=0 "CompanyName" "${APP}"
VIAddVersionKey /LANG=0 "LegalCopyright" "GPL-3.0-or-later"

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEFINISHPAGE_BITMAP "${WIZARD}"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${WIZARD}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_NOREBOOTSUPPORT

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!include "${LANGFILE}"

; close a running copy (it would hold its files open)
!macro CloseApp
  nsExec::Exec '"$SYSDIR\taskkill.exe" /IM "${EXE}" /T /F'
  Pop $0
  Sleep 500
!macroend

Section "Install"
  SetShellVarContext current
  !insertmacro CloseApp

  ; 1. the new copy goes into a folder of its own, so a failed install leaves the old one as it was
  RMDir /r "$INSTDIR.new"
  ClearErrors
  SetOutPath "$INSTDIR.new"
  File /r "${APPDIR}\*.*"
  WriteUninstaller "$INSTDIR.new\${UNINSTALLER}"
  IfErrors 0 +3
    RMDir /r "$INSTDIR.new"
    Abort "The files could not be written. Nothing was changed."

  ; 2. swap the folders, with rollback
  SetOutPath "$TEMP"
  RMDir /r "$INSTDIR.old"
  ${If} ${FileExists} "$INSTDIR\*.*"
    Rename "$INSTDIR" "$INSTDIR.old"
    ${If} ${FileExists} "$INSTDIR\*.*"
      RMDir /r "$INSTDIR.new"
      Abort "${APP} is still in use. Close it and run Setup again. Nothing was changed."
    ${EndIf}
  ${EndIf}
  Rename "$INSTDIR.new" "$INSTDIR"
  ${IfNot} ${FileExists} "$INSTDIR\${EXE}"
    Rename "$INSTDIR.old" "$INSTDIR"
    Abort "The new version could not be put in place. The earlier one was kept."
  ${EndIf}
  RMDir /r "$INSTDIR.old"
  SetOutPath "$INSTDIR"

  ; 3. shortcuts (the same names the earlier setup used, so they are replaced, not doubled)
  CreateShortcut "$SMPROGRAMS\${APP}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0 SW_SHOWNORMAL "" "$(RF_DESCRIPTION)"
  CreateShortcut "$DESKTOP\${APP}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0 SW_SHOWNORMAL "" "$(RF_DESCRIPTION)"

  ; 4. Settings → Apps
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${APP}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${EXE},0"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "URLInfoAbout" "https://github.com/rdavidlow-ux/reminderfoxagain"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\${UNINSTALLER}"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\${UNINSTALLER}" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" $0
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  !insertmacro CloseApp
  Delete "$SMPROGRAMS\${APP}.lnk"
  Delete "$DESKTOP\${APP}.lnk"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_ID}"
  DeleteRegKey HKCU "${UNINST_KEY}"
  SetOutPath "$TEMP"
  RMDir /r "$INSTDIR"
  ; your reminders: kept unless you say so (always kept in a silent uninstall)
  ${If} ${FileExists} "$APPDATA\${APP}\*.*"
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "$(RF_DELETE_DATA)" /SD IDNO IDNO keep
      RMDir /r "$APPDATA\${APP}"
    keep:
  ${EndIf}
SectionEnd
