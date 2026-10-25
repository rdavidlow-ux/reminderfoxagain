# ReminderFoxAgain __VERSION__ setup - per user, no administrator rights needed.
# This file is a template: build.sh fills in the version, the hashes and the number of runtime parts.
# Windows PowerShell 5.1 syntax; also runs in PowerShell 7 on Linux for the installer tests.

$ErrorActionPreference = 'Stop'
$Version = '__VERSION__'
$RuntimeVersion = '__RUNTIME_VERSION__'
$AppHash = '__APP_HASH__'
$RuntimeHash = '__RUNTIME_HASH__'
$PartCount = [int]'__PART_COUNT__'

$OnWindows = ($null -eq $IsWindows) -or $IsWindows
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Programs = Join-Path $env:LOCALAPPDATA 'Programs'
$InstallDir = Join-Path $Programs 'ReminderFoxAgain'
$NewDir = "$InstallDir.new"
$OldDir = "$InstallDir.old"
$AppFile = Join-Path $Here "ReminderFoxAgain-app-$Version.asar"
$Exe = 'ReminderFoxAgain.exe'

$swapped = $false
$tempDir = $null

function Say([string]$text) { Write-Host $text }
function Fail([string]$text) { throw (New-Object System.Exception $text) }
function Get-Sha256([string]$path) { return (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() }
function Read-RuntimeVersion([string]$dir) {
  $f = Join-Path $dir 'version'
  if (Test-Path -LiteralPath $f -PathType Leaf) { return ((Get-Content -LiteralPath $f -Raw) -replace '\s', '') }
  return ''
}
function Remove-Dir([string]$dir) {
  if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force }
}
function Remove-IfThere([string]$path) {
  if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Recurse -Force }
}
function Copy-DirContents([string]$from, [string]$to) {
  New-Item -ItemType Directory -Path $to -Force | Out-Null
  foreach ($item in (Get-ChildItem -LiteralPath $from -Force)) {
    Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $to $item.Name) -Recurse -Force
  }
}

try {
  Say "ReminderFoxAgain $Version setup"
  Say ''

  # 1. the app file
  if (-not (Test-Path -LiteralPath $AppFile -PathType Leaf)) {
    Fail "The app file ReminderFoxAgain-app-$Version.asar is missing. Put it in the same folder as this script."
  }
  if ((Get-Sha256 $AppFile) -ne $AppHash) {
    Fail "The app file ReminderFoxAgain-app-$Version.asar is damaged (its checksum does not match). Download it again."
  }

  # 2. choose a runtime
  $runtimeFrom = $null
  $runtimeKind = ''
  if ((Read-RuntimeVersion $InstallDir) -eq $RuntimeVersion -and (Test-Path -LiteralPath (Join-Path $InstallDir $Exe))) {
    $runtimeKind = 'installed'
    $runtimeFrom = $InstallDir
  }
  $parts = @()
  $missing = @()
  for ($i = 1; $i -le $PartCount; $i++) {
    $p = Join-Path $Here "ReminderFoxAgain-runtime-$Version.part$i.bin"
    if (Test-Path -LiteralPath $p -PathType Leaf) { $parts += $p } else { $missing += "ReminderFoxAgain-runtime-$Version.part$i.bin" }
  }
  # runtimes from before 0.7.0 kept only three Chromium language files; with the parts at hand, take the full runtime
  $oldLocales = $runtimeFrom -and -not (Test-Path -LiteralPath (Join-Path (Join-Path $InstallDir 'locales') 'de.pak'))
  if ((-not $runtimeFrom -or $oldLocales) -and $PartCount -gt 0 -and $missing.Count -eq 0) {
    $runtimeKind = 'parts'
    $runtimeFrom = $null
  } elseif ($oldLocales) {
    Say 'Note: the installed runtime has date pickers in English only; put the runtime parts next to this script to get them in your language too.'
  }
  if (-not $runtimeKind) {
    if ($parts.Count -gt 0) {
      Fail ("Some runtime parts are missing: " + ($missing -join ', ') + ". Put all $PartCount parts in the same folder as this script.")
    }
    Fail "ReminderFoxAgain is not installed yet, and a new install needs the runtime parts (ReminderFoxAgain-runtime-$Version.part1.bin ... part$PartCount.bin) next to this script."
  }

  # 3. stop running copies
  Get-Process -Name 'ReminderFoxAgain' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 300

  # 4. stage the new folder
  Remove-Dir $NewDir
  New-Item -ItemType Directory -Path $Programs -Force | Out-Null
  if ($runtimeKind -eq 'parts') {
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("ReminderFoxAgain-setup-" + [System.Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    $zip = Join-Path $tempDir 'runtime.zip'
    $out = [System.IO.File]::Create($zip)
    try {
      foreach ($p in $parts) {
        $in = [System.IO.File]::OpenRead($p)
        try { $in.CopyTo($out) } finally { $in.Dispose() }
      }
    } finally { $out.Dispose() }
    if ((Get-Sha256 $zip) -ne $RuntimeHash) {
      Fail "The runtime parts are damaged (their checksum does not match). Download them again."
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $NewDir)
  } else {
    Say 'Reusing the installed runtime...'
    Copy-DirContents $runtimeFrom $NewDir
    Remove-IfThere (Join-Path $NewDir 'README.md')
    Remove-IfThere (Join-Path (Join-Path $NewDir 'resources') 'app.asar.bak')
  }
  $res = Join-Path $NewDir 'resources'
  New-Item -ItemType Directory -Path $res -Force | Out-Null
  Copy-Item -LiteralPath $AppFile -Destination (Join-Path $res 'app.asar') -Force
  Set-Content -LiteralPath (Join-Path $NewDir 'reminderfoxagain-version.txt') -Value $Version -Encoding Ascii
  if (-not (Test-Path -LiteralPath (Join-Path $NewDir $Exe))) { Fail "The runtime does not contain $Exe." }

  $uninstall = @'
# Uninstalls ReminderFoxAgain for this user. Your reminders are kept unless you type YES.
param([switch]$Quiet)
$ErrorActionPreference = 'Continue'
$OnWindows = ($null -eq $IsWindows) -or $IsWindows
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Data = Join-Path $env:APPDATA 'ReminderFoxAgain'
Write-Host 'Uninstalling ReminderFoxAgain...'
Get-Process -Name 'ReminderFoxAgain' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 300
if ($OnWindows) {
  $startMenu = Join-Path (Join-Path (Join-Path (Join-Path $env:APPDATA 'Microsoft') 'Windows') 'Start Menu') 'Programs'
  Remove-Item -LiteralPath (Join-Path $startMenu 'ReminderFoxAgain.lnk') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path ([Environment]::GetFolderPath('Desktop')) 'ReminderFoxAgain.lnk') -Force -ErrorAction SilentlyContinue
  Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'org.reminderfoxagain.desktop' -ErrorAction SilentlyContinue
  Remove-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ReminderFoxAgain' -Recurse -Force -ErrorAction SilentlyContinue
}
Set-Location ([System.IO.Path]::GetTempPath())
Remove-Item -LiteralPath $Dir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "The program was removed from $Dir"
if (-not $Quiet -and (Test-Path -LiteralPath $Data)) {
  Write-Host ''
  Write-Host "Your reminders are in $Data"
  $answer = Read-Host 'Type YES to delete them too, or press Enter to keep them'
  if ($answer -ceq 'YES') {
    Remove-Item -LiteralPath $Data -Recurse -Force
    Write-Host 'Your reminders were deleted.'
  } else {
    Write-Host 'Your reminders were kept.'
  }
}
Write-Host 'ReminderFoxAgain was uninstalled.'
'@
  Set-Content -LiteralPath (Join-Path $NewDir 'Uninstall ReminderFoxAgain.ps1') -Value $uninstall -Encoding Ascii

  # 5. swap the folders, with rollback
  Remove-Dir $OldDir
  $hadOld = Test-Path -LiteralPath $InstallDir
  if ($hadOld) { Move-Item -LiteralPath $InstallDir -Destination $OldDir }
  try {
    Move-Item -LiteralPath $NewDir -Destination $InstallDir
  } catch {
    if ($hadOld -and -not (Test-Path -LiteralPath $InstallDir)) { Move-Item -LiteralPath $OldDir -Destination $InstallDir }
    throw
  }
  $swapped = $true
  Remove-Dir $OldDir

  # 6. Windows integration
  if ($OnWindows) {
    Get-ChildItem -LiteralPath $InstallDir -Recurse -File | Unblock-File -ErrorAction SilentlyContinue
    $startMenu = Join-Path (Join-Path (Join-Path (Join-Path $env:APPDATA 'Microsoft') 'Windows') 'Start Menu') 'Programs'
    $desktop = [Environment]::GetFolderPath('Desktop')
    $uninstRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
    $exePath = Join-Path $InstallDir $Exe
    $shell = New-Object -ComObject WScript.Shell
    foreach ($lnkDir in @($startMenu, $desktop)) {
      New-Item -ItemType Directory -Path $lnkDir -Force | Out-Null
      $lnk = $shell.CreateShortcut((Join-Path $lnkDir 'ReminderFoxAgain.lnk'))
      $lnk.TargetPath = $exePath
      $lnk.WorkingDirectory = $InstallDir
      $lnk.IconLocation = "$exePath,0"
      $lnk.Description = 'Reminders, to-dos and alarms'
      $lnk.Save()
    }
    $key = Join-Path $uninstRoot 'ReminderFoxAgain'
    New-Item -Path $key -Force | Out-Null
    $uninstallPs1 = Join-Path $InstallDir 'Uninstall ReminderFoxAgain.ps1'
    $sizeKb = [int]((Get-ChildItem -LiteralPath $InstallDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1024)
    Set-ItemProperty -Path $key -Name 'DisplayName' -Value 'ReminderFoxAgain'
    Set-ItemProperty -Path $key -Name 'DisplayVersion' -Value $Version
    Set-ItemProperty -Path $key -Name 'Publisher' -Value 'ReminderFoxAgain'
    Set-ItemProperty -Path $key -Name 'DisplayIcon' -Value "$exePath,0"
    Set-ItemProperty -Path $key -Name 'InstallLocation' -Value $InstallDir
    Set-ItemProperty -Path $key -Name 'UninstallString' -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstallPs1`""
    Set-ItemProperty -Path $key -Name 'QuietUninstallString' -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstallPs1`" -Quiet"
    Set-ItemProperty -Path $key -Name 'NoModify' -Value 1 -Type DWord
    Set-ItemProperty -Path $key -Name 'NoRepair' -Value 1 -Type DWord
    Set-ItemProperty -Path $key -Name 'EstimatedSize' -Value $sizeKb -Type DWord
  }

  # 7. done
  Say ''
  Say "ReminderFoxAgain $Version is installed in $InstallDir"
  if ($OnWindows) { Start-Process -FilePath (Join-Path $InstallDir $Exe) -WorkingDirectory $InstallDir }
  if ($tempDir) { Remove-Dir $tempDir }
  exit 0
} catch {
  $msg = $_.Exception.Message
  if ($tempDir) { try { Remove-Dir $tempDir } catch { } }
  Say ''
  Say $msg
  if (-not $swapped) {
    try { Remove-Dir $NewDir } catch { }
    if (-not (Test-Path -LiteralPath $InstallDir) -and (Test-Path -LiteralPath $OldDir)) { try { Move-Item -LiteralPath $OldDir -Destination $InstallDir } catch { } }
    Say 'Nothing was changed in your existing installation or your reminders.'
  } else {
    Say "ReminderFoxAgain $Version was installed, but a final step failed. ReminderFoxAgain should still run from $InstallDir. Your reminders were not touched."
  }
  exit 1
}
