# Peer Review Skill

Trigger this skill when the user asks for a "peer review" on a feature, or says something like "peer review on X", "get outside opinion on X", "ask Codex and Claude about X".

## What this skill does

Sends a feature design question to fresh Codex and Claude sessions (no prior project context), synthesizes their responses, and saves everything as a new linked issue under #45 (peer-review: outside AI design reviews).

## Workflow

### Step 1 — Build the prompt

Construct a prompt with two parts:

**Part A — Base prompt (always included, verbatim):**
```
I'm asking for your honest, critical opinion — not validation. If you think something is a bad idea or won't work well in practice, say so directly. I'd rather hear a skeptical take than encouragement. You have no prior context about this app or its development — treat this as a cold design review.

I'm building a voice-driven work journal app for knowledge workers (primarily software engineers). The app lets users record short voice check-ins throughout the day describing what they worked on. It tracks goals (long-term objectives with a % progress indicator), generates daily summaries, and lets users manually create time-blocked day plans.
```

**Part B — Feature-specific section (you write this based on what the user described):**
- What the feature does, in plain language
- What the user input looks like and what the AI/app produces
- The specific human/UX/planning challenges and risks — NOT technical ones
- 3–5 numbered questions focused on the hardest design decisions

Close with:
```
I'm not looking for technical implementation advice. I want your honest perspective on the human challenges: where does this genuinely help, where does it go wrong, and what behaviors would make users trust — or distrust — this feature? Don't try to make the idea sound better than it is. Be direct about the failure modes.
```

### Step 2 — Show the prompt to the user

Display the full combined prompt and ask: "Does this look right? I'll send it to Codex and Claude once you confirm."

Wait for the user's go-ahead before sending. If they want changes, revise and show again.

### Step 3 — Send to both AI systems in parallel

Send the prompt to:
1. **Codex** — use the `mcp__codex__codex` tool with:
   - `prompt`: the full prompt
   - `base-instructions`: "You are a thoughtful product and design advisor. You have no context of any prior development work on this app. Respond honestly and critically — the person asking wants real opinions, not encouragement."
   - `sandbox`: "read-only"
2. **Fresh Claude** — use the `Agent` tool (general-purpose subagent) with the same prompt, emphasizing it has no prior context of this project

Send both in the same message so they run in parallel.

### Step 4 — Synthesize

After both respond, write a synthesis section covering:
- Where they agree
- Where they differ (and which view you find more compelling, with reasoning)
- Key design principles to carry forward (numbered list)
- Your own take: does the review confirm the approach, raise concerns, or change something?

### Step 5 — Create a linked GitHub issue

Create a new GitHub issue with:
- Title: `peer-review: [Feature Name] — outside AI design review`
- Body structured as:
  1. "Sub-issue of #45 — peer-review: outside AI design reviews"
  2. Reviewed by / date
  3. Full prompt sent
  4. Codex response
  5. Claude response
  6. Synthesis + key principles
- After creating: add a comment to #45 linking to the new issue number

Use: `gh issue create --title "..." --body-file tmp/peer-review-[feature].md`
Then: `gh issue comment 45 --body "Sub-issue: #NN — [Feature] peer review (YYYY-MM-DD)"`
And: `gh issue comment NN --body "Part of #45 — peer-review: outside AI design reviews"`

### Step 6 — Report back

Tell the user the issue number and URL, and summarize the 2–3 most important things the reviewers said.

## Important rules

- The Codex and Claude sessions must be **fresh** — no prior context of this project. Never reuse an existing session that worked on TimeAnalyzer code.
- Do not editorialize in the AI responses — record what they actually said.
- The synthesis is your own view, clearly labeled as such.
- Always show the prompt to the user before sending (Step 2). Don't skip this.
- Save tmp files to `tmp/` which is gitignored.
