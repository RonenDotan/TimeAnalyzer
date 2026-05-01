param(
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$ADB = "$env:ANDROID_HOME\platform-tools\adb.exe"
$PACKAGE = "com.timeanalyzer"
$APK = "android\app\build\outputs\apk\debug\app-debug.apk"

# 1. Unit tests
if (-not $SkipTests) {
  Write-Host "==> Running unit tests..." -ForegroundColor Cyan
  npm test
  if ($LASTEXITCODE -ne 0) { Write-Error "Tests failed. Aborting."; exit 1 }
}

# 2. Build APK
Write-Host "==> Building APK..." -ForegroundColor Cyan
Push-Location android
.\gradlew.bat app:assembleDebug
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "Build failed."; exit 1 }
Pop-Location

# 3. Install APK
Write-Host "==> Installing APK..." -ForegroundColor Cyan
& $ADB install -r $APK
if ($LASTEXITCODE -ne 0) { Write-Error "Install failed."; exit 1 }

# 4. Grant notification permission (skips the runtime dialog)
Write-Host "==> Granting POST_NOTIFICATIONS permission..." -ForegroundColor Cyan
& $ADB shell pm grant $PACKAGE android.permission.POST_NOTIFICATIONS

# 5. Launch app
Write-Host "==> Launching app..." -ForegroundColor Cyan
& $ADB shell monkey -p $PACKAGE 1 | Out-Null

Write-Host "==> Done. App is running with notification permission granted." -ForegroundColor Green
