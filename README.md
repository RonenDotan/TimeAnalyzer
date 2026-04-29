# TimeAnalyzer

A personal work-session tracker that helps you understand where your time actually goes — not what you planned to do, but what you really did.

## The Problem

You finish a two-day programming task and have no idea what ate up your time. Was it reading unfamiliar code? Debugging a stubborn bug? Waiting for builds? TimeAnalyzer gives you an honest, detailed breakdown — built from your own voice, captured in the moment.

## How It Works

1. **Periodic check-ins** — The app sends you a prompt every couple of hours: *"What have you been doing?"*
2. **Voice recording** — You record a short audio clip describing what you worked on since the last check-in (no need to type — just talk naturally).
3. **AI analysis** — The app transcribes your audio and analyzes the content, extracting tasks, themes, and time spent.
4. **Categorization** — Each session is tagged automatically. Examples:
   - `Reading / Code Exploration`
   - `Debugging`
   - `Writing / Documentation`
   - `Research`
   - `Meetings / Communication`
   - `Setup / Configuration`
   - `Blocked / Waiting`
5. **Persistent log** — All entries are saved to a structured text file, timestamped and categorized.
6. **End-of-day report** — At any point you can generate a report showing:
   - A timeline of your work session
   - Which categories took the most time
   - Where you got stuck and for how long
   - A summary of what you accomplished

## Example Timeline

```
10:00 – 12:00  Reading / Code Exploration   (2h)  "Got familiar with the auth module, traced the token refresh flow"
12:00 – 14:00  Debugging                    (2h)  "Race condition in session handling, added logging to narrow it down"
14:00 – 14:30  Research                    (30m)  "Read docs on JWT expiry edge cases"
14:30 – 16:00  Debugging                  (1.5h)  "Fixed the race condition, wrote a regression test"
16:00 – 16:30  Writing / Documentation     (30m)  "Updated the PR description and inline comments"
```

## Key Features

- **Voice-first input** — No friction. Speak naturally for 30–60 seconds and the app handles the rest.
- **Automatic categorization** — AI extracts what you did and groups it into meaningful categories.
- **Honest tracking** — Captures what actually happened, not what was scheduled.
- **Searchable log** — Plain text storage so entries are always accessible.
- **Daily & per-task reports** — See breakdowns per day or per project/task.

## Goals

- Help developers (and other knowledge workers) understand their real time distribution.
- Identify recurring bottlenecks (e.g., "I spend 40% of every task reading code I don't own").
- Build a habit of reflection without adding manual overhead.

## Tech Stack (planned)

- **Frontend / CLI** — lightweight interface to trigger check-ins and view reports
- **Audio transcription** — speech-to-text (e.g., Whisper)
- **AI analysis** — LLM-based categorization and summarization (e.g., Claude API)
- **Storage** — structured local text/JSON log files
- **Reporting** — terminal or simple web report view
