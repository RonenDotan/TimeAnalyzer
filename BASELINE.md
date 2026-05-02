# React Native Infra Baseline

This tag (`infra-baseline-v1`) marks the point where the app has a complete, working infrastructure
but no domain-specific logic. It's a good starting point for new voice-driven or check-in style apps.

## What's included

- **React Native 0.85 + TypeScript**, New Architecture (mandatory since RN 0.82)
- **Audio recording** — custom Kotlin `AudioRecorderModule` using Android `MediaRecorder`, records M4A to app cache
- **Transcription** — `WhisperTranscriptionProvider` sends audio to Groq Whisper API, returns text
- **Local SQLite storage** — `SQLiteStorageProvider` using `@op-engineering/op-sqlite`, stores entries on-device
- **Settings screen** — API key management via AsyncStorage
- **Local notifications scheduler** — periodic check-in prompts via `@notifee/react-native`
- **Provider/Strategy pattern** — all services (transcription, storage) are swappable via interface
- **Build script** — `scripts/build-and-install.ps1` builds APK, installs on device, syncs to Drive
- **Unit test suite** — 39 tests across all services and providers

## To adapt for a new project

1. **Rename the app**
   - `app.json` → change `name` and `displayName`
   - `android/app/src/main/res/values/strings.xml` → change `app_name`
   - `android/app/build.gradle` → change `applicationId` (e.g. `com.yourname.yourapp`)
   - `package.json` → change `name`

2. **Replace the domain logic**
   - `src/screens/CheckInScreen.tsx` — replace the recording/confirm flow with your app's main screen
   - `src/screens/ReportScreen.tsx` — replace or remove
   - `src/types/LogEntry.ts` — rename and adjust fields for your data model
   - `src/providers/storage/SQLiteStorageProvider.ts` — update table name and columns to match

3. **Keep or swap providers**
   - Transcription: swap `WhisperTranscriptionProvider` for any `TranscriptionProvider` implementation
   - Storage: swap `SQLiteStorageProvider` for any `StorageProvider` implementation
   - Both follow the same interface pattern — add a new provider file, call `setProvider()` at startup

4. **API keys**
   - Create `src/secrets.local.ts` (gitignored) with your keys
   - Or enter them at runtime via the Settings screen

5. **Update `version.json`** — reset to `{ "major": 0, "minor": 0, "ticket_id": 0, "sequence": 0 }`

## Key files to understand

| File | Purpose |
|------|---------|
| `src/services/TranscriptionService.ts` | Wraps active transcription provider |
| `src/services/StorageService.ts` | Wraps active storage provider |
| `src/providers/transcription/WhisperTranscriptionProvider.ts` | Groq Whisper integration |
| `src/providers/storage/SQLiteStorageProvider.ts` | SQLite on-device storage |
| `android/.../AudioRecorderModule.kt` | Native audio recording |
| `android/.../AudioRecorderPackage.kt` | Registers native module with RN |
| `scripts/build-and-install.ps1` | Build + install + sync APK |
