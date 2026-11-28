# Builds the Campus Notices desktop app and installs it for the current user (Start menu and desktop shortcuts).
# Needs Node and a Java 21 JDK (Gradle toolchain). Run from anywhere: powershell -ExecutionPolicy Bypass -File desktop\install.ps1
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot
$name = 'Campus Notices'

function Invoke-Step([string]$dir, [scriptblock]$step) {
	Push-Location $dir
	try {
		& $step
		if ($LASTEXITCODE -ne 0) { throw "Build step failed in $dir (exit code $LASTEXITCODE)" }
	} finally {
		Pop-Location
	}
}

Invoke-Step "$repo\frontend" { npm ci --no-audit --no-fund }
Invoke-Step "$repo\frontend" { npm run build }
Invoke-Step "$repo\backend" { .\gradlew.bat desktopImage --no-daemon }

# a running copy keeps its files locked until its process has fully exited
$running = Get-Process -Name $name -ErrorAction SilentlyContinue
if ($running) {
	$running | Stop-Process -Force
	$running | Wait-Process -Timeout 30 -ErrorAction SilentlyContinue
}
# a force-stopped app leaves its database running, which would block the next start; stop it cleanly
$data = Join-Path $env:LOCALAPPDATA 'CampusNotices'
$pgCtl = Get-ChildItem "$data\postgres" -Recurse -Filter pg_ctl.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgCtl -and (Test-Path "$data\pgdata\postmaster.pid")) {
	& $pgCtl.FullName stop -D "$data\pgdata" -m fast -w | Out-Null
}
$target = Join-Path $env:LOCALAPPDATA "Programs\$name"
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Copy-Item "$repo\backend\build\desktop\image\$name" $target -Recurse

$shell = New-Object -ComObject WScript.Shell
$startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) "$name.lnk"
$desktop = Join-Path ([Environment]::GetFolderPath('Desktop')) "$name.lnk"
foreach ($path in $startMenu, $desktop) {
	$link = $shell.CreateShortcut($path)
	$link.TargetPath = "$target\$name.exe"
	$link.WorkingDirectory = $target
	$link.IconLocation = "$target\$name.exe"
	$link.Save()
}
Write-Host "Installed to $target"
