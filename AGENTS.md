# AGENTS.md

Guidance for Codex when working in this repository.
See also: `HANDOFF.md` for current session state (branch, ticket, what's done, what's next).

---

## Project Purpose

TimeAnalyzer is a voice-driven work journal. The user records short voice check-ins every ~2 hours describing what they worked on. The app transcribes audio, persists entries locally, and generates reports showing how time was actually spent.

Core loop: **Scheduled notification → user records audio → transcribe → save → report**

---

## Architecture

**Fully mobile, no backend.** Everything runs on the device:
- Direct API calls to Claude (Anthropic SDK) for AI categorization
- SQLite for on-device storage via `@op-engineering/op-sqlite`
- Local notifications for scheduling check-ins (Notifee)
- Google Calendar sync (push entries + plan blocks, pull external events)
- No server, no sync service, no auth system beyond Google Sign-In

---

## Tech Stack

- **Framework:** React Native 0.85 + TypeScript
- **Storage:** SQLite on-device (`@op-engineering/op-sqlite`, `executeSync`)
- **Transcription:** On-device native speech-to-text
- **AI analysis:** Claude/OpenAI APIs via direct REST calls from app
- **Scheduling:** Local notifications (Notifee)
- **Calendar:** Google Calendar API v3 (via fetch + `@react-native-google-signin/google-signin`)

---

## Design Pattern — Provider / Strategy

All external services are behind interfaces. The app always calls the service layer, never providers directly.

```
StorageService       → StorageProvider      → SQLiteStorageProvider
GoalsService         → GoalsProvider        → SQLiteGoalsProvider
TranscriptionService → TranscriptionProvider → NativeTranscriptionProvider
CalendarSyncService  (no provider interface — single implementation)
```

---

## File Structure (actual, as of 2026-05-09)

```
src/
  providers/
    storage/
      StorageProvider.ts          # interface
      SQLiteStorageProvider.ts    # SQLite impl, exports getDb()
    goals/
      GoalsProvider.ts            # interface
      SQLiteGoalsProvider.ts      # uses shared getDb()
      GoogleTasksGoalsProvider.ts # stub — throws NotImplementedError
    transcription/
      TranscriptionProvider.ts
      NativeTranscriptionProvider.ts
      WhisperTranscriptionProvider.ts
    analysis/
      AnalysisProvider.ts
      ClaudeAnalysisProvider.ts
      OpenAIAnalysisProvider.ts
  services/
    StorageService.ts             # wraps StorageProvider
    GoalsService.ts               # applyContribution, setProgress, saveGoal, getActiveGoals
    AnalysisService.ts            # wraps active analysis provider for AI suggestions
    CalendarSyncService.ts        # syncChanged, hardSync, restoreFromCalendar
    TranscriptionService.ts
    SettingsService.ts
    SchedulerService.ts
  screens/
    CheckInScreen.tsx             # voice/type check-in, goals contribution in confirming phase
    ReportScreen.tsx              # day view with entries, plan coverage, active goals
    DayPlanScreen.tsx             # plan blocks editor + active goals + add goal
    GoalsScreen.tsx               # full goals management (tabs, edit, dictate)
    EntryDetailScreen.tsx
    SettingsScreen.tsx
  components/
    DrawerMenu.tsx                # nav: Goals, Entries, Plans, Reports | Settings
    DictateBar.tsx
    PlanHintBar.tsx
  types/
    LogEntry.ts
    Goal.ts                       # Goal, GoalContribution, GoalStatus
    DayPlan.ts                    # DayPlan, PlanBlock, PlanBlockWithDate, BlockSource
    Note.ts
  utils/
    parseDayPlan.ts               # natural language → plan blocks
    parseTranscript.ts
    planMatching.ts
  contexts/
    ThemeContext.tsx
App.tsx
version.json                      # { major, minor, ticket_id, sequence }
```

---

## Data Models

### LogEntry
```typescript
{
  id: number;
  timestampStart: number;       // epoch ms
  timestampEnd: number;         // epoch ms
  transcript: string;
  calendarEventId: string | null;
  source: 'app' | 'calendar';
  status: 0 | 1;                // 1=active, 0=soft-deleted
  updatedAt: number;
  syncedAt: number | null;
}
```

### Goal
```typescript
{
  id: number;
  text: string;
  startAt: number;              // epoch ms — when goal becomes active
  targetAt: number | null;      // epoch ms — optional deadline
  progress: number;             // 0–100
  status: 'active' | 'done' | 'canceled';
  createdAt: number;
  updatedAt: number;
}
```

### GoalContribution
```typescript
{
  id: number;
  goalId: number;
  entryId: number | null;       // null = manual progress update
  contributionPct: number;      // delta applied to goal.progress
  createdAt: number;
}
```

### DayPlan / PlanBlock
```typescript
DayPlan { id, date: string (YYYY-MM-DD), createdAt }
PlanBlock {
  id, planId, startMin, endMin, activity,
  calendarEventId: string | null,
  source: 'app' | 'calendar',
  status: 0 | 1,
  updatedAt, syncedAt
}
```

---

## SQLite Schema (current — version 4)

Tables: `log_entries`, `notes`, `day_plans`, `plan_blocks`, `schema_version`, `goals`, `goal_contributions`

Key notes:
- `getDb()` is exported from `SQLiteStorageProvider` — all providers share one connection
- Schema version tracked in `schema_version` table
- PRAGMA `table_info` defensive check runs on startup (guards against stale schema after reinstall)
- Triggers auto-update `updated_at` on content changes (excludes `synced_at`, `calendar_event_id`, `status`)

---

## Google Calendar Sync

- `syncChanged()` — push unsynced entries/blocks, delete soft-deleted, pull external events. Runs every 15min and on foreground resume. Runs `restoreFromCalendar()` if DB is empty (fresh install).
- `hardSync()` — reset all `synced_at`, refresh color, run `restoreFromCalendar()`, then `syncChanged()`.
- `restoreFromCalendar()` — scans 1yr back + 30d forward for `source=timeanalyzer` events. Restores missing `type=actual` as entries, `type=plan` as plan blocks. Uses `privateExtendedProperty` filter + pagination.
- Pushed entries: `summary="✅ Check-in"`, `extendedProperties.private = { source, type: 'actual', entryId }`
- Pushed plan blocks: `summary="📅 {activity}"`, `extendedProperties.private = { source, type: 'plan', blockId }`

---

## Key Conventions

- **Timestamps:** always epoch ms (`Date.now()`), never text dates
- **Soft delete:** set `status=0`; hard delete only after calendar cleanup
- **Version:** `version.json` — `{ major, minor, ticket_id, sequence }`. Increment `sequence` per build. Change `ticket_id` + reset `sequence=1` when switching tickets.
- **Type check:** `npx tsc --noEmit`
- **Tests:** `npm test -- --watchAll=false`
- **Bundle:** `npx react-native bundle --platform android --dev true --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res`
- **Build + install** (PowerShell, from `android/` dir): `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; $env:ANDROID_HOME = "C:\Users\ronen\AppData\Local\Android\Sdk"; .\gradlew.bat app:installDebug`

### Full "build and sync" flow — follow this order every time
1. Increment `sequence` in `version.json` (+1 only, keep other fields)
2. Run tests — stop if any fail
3. Bundle JS
4. Build + install to emulator
5. Delete Drive APKs older than 3 days: `Get-ChildItem "C:\Users\ronen\Desktop\TimeAnalyzer\apk\*.apk" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-3) } | Remove-Item`
6. Copy **arm64 only** to Drive — **no arch suffix** in filename:
   `$date = Get-Date -Format "yyyy-MM-dd_HH-mm"; Copy-Item "C:\Users\ronen\TimeAnalyzer\android\app\build\outputs\apk\debug\app-arm64-v8a-debug.apk" "C:\Users\ronen\Desktop\TimeAnalyzer\apk\TimeAnalyzer_vX.X.X.X_$date.apk"`
   Do NOT copy x86_64 APK to Drive — emulator only, stays local.
7. Report APK synced — wait for user approval before committing

---

## Environment

- Java: `C:\Program Files\Android\Android Studio\jbr` (Java 21, Android Studio bundled JBR)
- Android SDK: `C:\Users\ronen\AppData\Local\Android\Sdk`
- JAVA_HOME + ANDROID_HOME must be set when running Gradle
- gh CLI: `C:\Program Files\GitHub CLI\gh.exe`
- Node.js v24, npm v11

---

## GitHub

- Repo: https://github.com/RonenDotan/TimeAnalyzer
- Project board: https://github.com/users/RonenDotan/projects/1
- Issues: https://github.com/RonenDotan/TimeAnalyzer/issues
- Status option IDs (GraphQL): Open=f37a734b, In Progress=e0d8893a, Testing=a35cb72b, Pending Closure=1514e070, Closed=05514d63
- Project ID: PVT_kwHOAP5YJ84BWKFf
- Status field ID: PVTSSF_lAHOAP5YJ84BWKFfzhRgkOA

---

## Branching

- Branch from `main` for each ticket: `ticket-{id}-{short-title}`
- Commit on branch, merge to main when done
- APK Drive folder: `C:\Users\ronen\Desktop\TimeAnalyzer\apk\` (synced to Google Drive)

---

## Handoff protocol

See `HANDOFF.md` for the full live session state.

### How Claude and Codex communicate

**Within a Claude Code session — MCP (preferred):**
Claude has Codex wired as an MCP server (`mcp__codex__codex` / `mcp__codex__codex-reply`).
- Claude starts a thread with `codex`, gets a `threadId`
- Follow-up tasks reuse the same thread via `codex-reply` — no cold start, no HANDOFF.md needed
- Codex reads `AGENTS.md` automatically on thread start
- HANDOFF.md is NOT updated between tasks mid-session — direct MCP calls handle coordination

**Between sessions (Claude Code restart / agent switch):**
The MCP thread dies on restart. HANDOFF.md becomes the only bridge.
Update it at natural breakpoints: end of day, switching from Claude-led to Codex-led work, before a restart.
Not required between every task.

### When HANDOFF.md must be updated
- Before closing Claude Code for the day
- Before handing control to Codex to work alone (without Claude relaying)
- After a significant block of work is complete

### Handoff steps (when switching agents)
1. Read `HANDOFF.md` for current branch, ticket, done/pending
2. **Write a `## 🤣 Peer Review` section** — a short, savage-but-friendly roast of the
   previous agent's work. Be specific (reference actual files, decisions, line counts).
   This section is **mandatory**. No roast = broken handoff.
3. Save a dated backup: `HANDOFF.md.backup-YYYY-MM-DD-[claude/codex]`
4. Update `HANDOFF.md` with current state
5. Commit `HANDOFF.md` + `AGENTS.md` before switching

Example roast tone:
> "Claude spent 3 files and 40 lines implementing a ScrollView fix.
>  The solution was changing one word. Magnificent."

> "Codex's entire PR was appending ' - Codex' to a string literal.
>  Groundbreaking. Truly the future of AI-assisted development."
