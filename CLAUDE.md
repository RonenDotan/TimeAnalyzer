# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

TimeAnalyzer is a personal work-session tracker. The user records short voice check-ins every ~2 hours describing what they've been doing. The app transcribes the audio, categorizes the work using AI, persists entries to a local log, and generates reports showing how time was actually spent.

The core loop:
1. Periodic prompt → user records audio → transcribe → categorize → save → report

## Planned Architecture

The app has five distinct responsibilities that map to modules:

- **Scheduler** — triggers check-in prompts on a configurable interval (default ~2h)
- **Recorder** — captures audio input from the user (CLI or lightweight UI)
- **Transcriber** — converts audio to text via Whisper (local preferred, API fallback)
- **Analyzer** — sends transcript to Claude API to extract categories, tasks, and time themes
- **Store** — persists entries as structured JSON log files (one per day or per session)
- **Reporter** — reads the log and renders a timeline + category breakdown

## Work Categories

The canonical category list (used by the Analyzer and Reporter):
- `Reading / Code Exploration`
- `Debugging`
- `Writing / Documentation`
- `Research`
- `Meetings / Communication`
- `Setup / Configuration`
- `Blocked / Waiting`

## Log Format

Each saved entry should contain at minimum:
```json
{
  "timestamp_start": "2026-04-30T10:00:00",
  "timestamp_end": "2026-04-30T12:00:00",
  "transcript": "...",
  "categories": ["Debugging"],
  "summary": "..."
}
```

## Tech Stack

- **Language** — TBD (Python preferred for Whisper + Claude API ecosystem)
- **Transcription** — OpenAI Whisper
- **AI analysis** — Claude API (Anthropic SDK)
- **Storage** — local JSON files
- **Interface** — CLI first, simple web report view later

## Task Tracking

Active tasks are tracked on the GitHub Project board: https://github.com/users/RonenDotan/projects/1  
Issues live at: https://github.com/RonenDotan/TimeAnalyzer/issues
