param(
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$ADB = "$env:ANDROID_HOME\platform-tools\adb.exe"
$PACKAGE = "com.timeanalyzer"
# Pick the right split APK for the connected device (arm64-v8a for real phones, x86_64 for emulator)
$ABI = (& $ADB shell getprop ro.product.cpu.abi).Trim()
$APK = if ($ABI -like "*x86_64*") {
    "android\app\build\outputs\apk\debug\app-x86_64-debug.apk"
} else {
    "android\app\build\outputs\apk\debug\app-arm64-v8a-debug.apk"
}

# 1. Unit tests
if (-not $SkipTests) {
  Write-Host "==> Running unit tests..." -ForegroundColor Cyan
  npm test
  if ($LASTEXITCODE -ne 0) { Write-Error "Tests failed. Aborting."; exit 1 }
}

# 2. Bundle JS
Write-Host "==> Bundling JS..." -ForegroundColor Cyan
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
if ($LASTEXITCODE -ne 0) { Write-Error "JS bundle failed."; exit 1 }

# 3. Build APK
Write-Host "==> Building APK..." -ForegroundColor Cyan
Push-Location android
.\gradlew.bat app:assembleDebug
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "Build failed."; exit 1 }
Pop-Location

# 4. Install APK
Write-Host "==> Installing APK..." -ForegroundColor Cyan
& $ADB install -r $APK
if ($LASTEXITCODE -ne 0) { Write-Error "Install failed."; exit 1 }

# 5. Grant permissions (skips the runtime dialogs)
Write-Host "==> Granting permissions..." -ForegroundColor Cyan
& $ADB shell pm grant $PACKAGE android.permission.POST_NOTIFICATIONS
& $ADB shell pm grant $PACKAGE android.permission.RECORD_AUDIO

# 6. Launch app
Write-Host "==> Launching app..." -ForegroundColor Cyan
& $ADB shell monkey -p $PACKAGE 1 | Out-Null

Write-Host "==> Done. App is running with notification permission granted." -ForegroundColor Green
