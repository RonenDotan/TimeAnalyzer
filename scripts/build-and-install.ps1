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

# 6. Delete APK files older than 2 days from Drive
$DriveApk = "C:\Users\ronen\Desktop\TimeAnalyzer\apk"
if (Test-Path $DriveApk) {
  Get-ChildItem "$DriveApk\*.apk" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-2) } | Remove-Item
}

# 7. Copy arm64 APK to Drive (real phones only)
$Version = (Get-Content version.json | ConvertFrom-Json)
$VersionStr = "v$($Version.major).$($Version.minor).$($Version.ticket_id).$($Version.sequence)"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$DriveApkPath = "$DriveApk\TimeAnalyzer_${VersionStr}_${Timestamp}.apk"
$Arm64Apk = "android\app\build\outputs\apk\debug\app-arm64-v8a-debug.apk"
if (Test-Path $Arm64Apk) {
  Copy-Item $Arm64Apk $DriveApkPath
  Write-Host "==> APK synced to Drive: $DriveApkPath" -ForegroundColor Green
}

# 8. Launch app
Write-Host "==> Launching app..." -ForegroundColor Cyan
& $ADB shell monkey -p $PACKAGE 1 | Out-Null

# 9. Take screenshot of home screen and save to Drive
Start-Sleep -Seconds 4
$ScreenshotDir = "C:\Users\ronen\Desktop\TimeAnalyzer\tests\screenshots"
if (-not (Test-Path $ScreenshotDir)) { New-Item -ItemType Directory -Path $ScreenshotDir | Out-Null }
$ScreenshotPath = "$ScreenshotDir\home-screen_${VersionStr}_${Timestamp}.png"
& $ADB shell screencap -p /sdcard/build_screen.png
& $ADB pull /sdcard/build_screen.png $ScreenshotPath | Out-Null
Write-Host "==> Screenshot saved to Drive: $ScreenshotPath" -ForegroundColor Green

Write-Host "==> Done." -ForegroundColor Green
