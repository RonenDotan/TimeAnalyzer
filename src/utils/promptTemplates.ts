import { Goal } from '../types/Goal';
import { LogEntry } from '../types/LogEntry';
import { PlanBlock } from '../types/DayPlan';

export const DEFAULT_GOAL_CONTRIBUTION_PROMPT_BODY = [
  'Suggest goal progress contributions for this work journal check-in.',
  '',
  'Rules:',
  '- Return only JSON with shape: {"suggestions":[{"goalId":number,"contributionPct":number,"reason":string}]}',
  '- Only suggest goals clearly advanced by the transcript.',
  '- contributionPct is the delta to add now, from 1 up to remainingAutoContribution for that goal.',
  '- Never suggest the final point to 100%; leave completion for the user to confirm manually.',
  '- Use conservative percentages. Typical small progress is 5-15. Major completion can be 20-40.',
  '- If no goal was clearly advanced, return {"suggestions":[]}.',
  '- Reasons must be short and user-facing.',
  '',
  'Active goals:',
  '{{goals_json}}',
  '',
  'Transcript:',
  '{{transcript}}',
].join('\n');

export const DEFAULT_DAILY_SUMMARY_PROMPT_BODY = [
  'Write a concise daily work summary from these work journal entries.',
  '',
  'Rules:',
  '- Focus on what was actually done, not generic productivity language.',
  '- Group related work into short bullets.',
  '- Mention notable meetings, planning, debugging, implementation, and follow-up items when present.',
  '- Keep the tone factual and user-facing.',
  '- If entries are sparse, say so directly.',
  '',
  'Date:',
  '{{date}}',
  '',
  'Entries:',
  '{{entries_json}}',
].join('\n');

export const CLAUDE_GOAL_CONTRIBUTION_PROMPT_BODY = [
  'You are analyzing a work journal check-in to suggest how much progress was made on each active goal.',
  '',
  'For each goal, consider:',
  '- Does the transcript mention work directly related to this goal?',
  '- How significant was that work relative to what remains?',
  '- Err on the side of under-estimating — it is better to suggest too little than too much.',
  '',
  'Rules:',
  '- Return only JSON: {"suggestions":[{"goalId":number,"contributionPct":number,"reason":string}]}',
  '- Only include goals where the transcript clearly shows progress.',
  '- contributionPct is the amount to add now (1 to remainingAutoContribution).',
  '- Never suggest the final point to 100%; leave completion for the user to confirm manually.',
  '- Small focused work: 5-10. Meaningful progress: 10-20. Near-completion work: 20-40.',
  '- Reasons are one short sentence, written for the user, not for a developer.',
  '- If nothing clearly advanced a goal, return {"suggestions":[]}.',
  '',
  'Active goals:',
  '{{goals_json}}',
  '',
  'Transcript:',
  '{{transcript}}',
].join('\n');

export const CLAUDE_DAILY_SUMMARY_PROMPT_BODY = [
  'Summarize today\'s work journal as an end-of-day debrief.',
  '',
  'You have:',
  '- Check-in transcripts: what was actually worked on',
  '- Day plan: what was intended',
  '- Active goals: long-term priorities with current progress',
  '',
  'Rules:',
  '- Return only valid JSON. No markdown.',
  '- Ground everything in the transcripts — they are the source of truth.',
  '- Be specific and concrete. Reference actual work mentioned.',
  '- Do not fabricate blockers, emotions, or progress not evidenced in the transcripts.',
  '- If no transcripts exist, return a minimal response.',
  '',
  'Return JSON:',
  '{',
  '  "debrief": "2-4 sentences. What actually happened, how it compared to the plan, what moved forward on goals.",',
  '  "momentum": "1 sentence. What to carry into tomorrow.",',
  '  "gaps": ["Planned work that did not happen. Empty array if no plan or no gaps."]',
  '}',
  '',
  'Date: {{date}}',
  '',
  'Transcripts: {{entries_json}}',
  '',
  'Plan: {{plan_json}}',
  '',
  'Goals: {{goals_json}}',
].join('\n');

export const CODEX_DAILY_SUMMARY_PROMPT_BODY = [
  'Generate an end-of-day debrief for a voice-driven work journal.',
  '',
  'You will receive:',
  '- Today\'s check-in transcripts: what was actually done, with timestamps.',
  '- Today\'s day plan: planned time blocks and activities.',
  '- Active goals: goal text, current progress %, and optional target date.',
  '',
  'Write a concise, factual debrief that helps the user understand how the day actually went.',
  '',
  'Rules:',
  '- Return only valid JSON. Do not include markdown or commentary.',
  '- Use the user\'s actual check-ins as the source of truth.',
  '- Compare plan vs actual when a day plan exists.',
  '- Mention goal progress only when the transcripts clearly relate to active goals.',
  '- Do not invent work, emotions, blockers, meetings, or progress.',
  '- If evidence is weak, say that directly.',
  '- Keep the debrief paragraph readable and specific, not generic.',
  '- Key insights should be short, practical observations.',
  '- Prefer concrete phrasing like "The morning shifted from planned writing to debugging" over vague phrasing like "There were productivity challenges."',
  '- If there are no transcripts, return an empty/low-confidence summary.',
  '- If there is no plan, focus on what was done and any goal alignment.',
  '',
  'Return JSON with this exact shape:',
  '{',
  '  "debrief": "One concise paragraph, 3-6 sentences.",',
  '  "keyInsights": [',
  '    {',
  '      "type": "plan_vs_actual | goal_progress | blocker | pattern | follow_up | note",',
  '      "text": "Short user-facing insight.",',
  '      "confidence": "high | medium | low"',
  '    }',
  '  ]',
  '}',
  '',
  'Date:',
  '{{date}}',
  '',
  'Check-in transcripts:',
  '{{entries_json}}',
  '',
  'Day plan:',
  '{{plan_json}}',
  '',
  'Active goals:',
  '{{goals_json}}',
].join('\n');

// claude-summary-goals: plan→actual gap narrative + goal alignment.
// Uses all four template variables: {{date}} {{entries_json}} {{plan_json}} {{goals_json}}
// Returns the full DailySummaryResult shape: debrief + momentum + gaps + keyInsights.
export const CLAUDE_SUMMARY_GOALS_PROMPT_BODY = [
  'You are writing an end-of-day debrief for a work journal app.',
  '',
  'The user recorded short voice check-ins throughout the day and may have written a day plan in advance.',
  'Your job is to tell them concisely:',
  '  1. What they actually accomplished (grounded in the transcripts)',
  '  2. How the day compared to the plan — which blocks were covered, which slipped, what replaced them',
  '  3. How today moved the needle on active goals',
  '',
  'Source of truth: check-in transcripts. Only describe work that appears in a transcript.',
  '',
  'Rules:',
  '- Return only valid JSON. No markdown, no commentary outside the JSON.',
  '- Be specific. Reference actual activities, times, and work mentioned in the transcripts.',
  '- Debrief: 3–5 sentences. Readable, second-person ("You started the morning with…").',
  '  Cover: what was actually done, one clear plan/actual contrast if a plan exists, any notable goal progress.',
  '- Momentum: 1 sentence. The single most concrete thing to carry into tomorrow.',
  '- Gaps: list plan blocks that had zero or minimal check-in coverage.',
  '  Format each as: "<HH:MM–HH:MM> <activity> — <brief reason it slipped, if inferable from transcripts>".',
  '  Empty array if no plan exists or all blocks were covered.',
  '- Key insights: 2–4 short observations. Each must be specific and evidence-based.',
  '  type must be exactly one of: plan_vs_actual | goal_progress | blocker | pattern | follow_up',
  '  confidence: high (clearly evidenced) | medium (inferable) | low (speculative)',
  '- Do not invent blockers, emotions, meetings, or outcomes not evidenced in the transcripts.',
  '- If no transcripts exist, set debrief to "No check-ins were recorded for this day." and return empty arrays.',
  '- If no plan exists, skip plan comparison; focus on accomplishments and goal alignment.',
  '- If no goals exist, omit goal references entirely.',
  '',
  'Return JSON with this exact shape:',
  '{',
  '  "debrief": "3–5 sentences.",',
  '  "momentum": "1 sentence.",',
  '  "gaps": ["HH:MM–HH:MM activity — reason"],',
  '  "keyInsights": [{ "type": "...", "text": "...", "confidence": "..." }]',
  '}',
  '',
  'Date: {{date}}',
  '',
  'Check-in transcripts (source of truth):',
  '{{entries_json}}',
  '',
  'Day plan (intended):',
  '{{plan_json}}',
  '',
  'Active goals:',
  '{{goals_json}}',
].join('\n');

export function goalContextJson(goals: Goal[]): string {
  return JSON.stringify(
    goals.map(goal => ({
      id: goal.id,
      text: goal.text,
      progress: goal.progress,
      remaining: Math.max(0, 100 - goal.progress),
      remainingAutoContribution: Math.max(0, 99 - goal.progress),
      targetAt: goal.targetAt,
    })),
    null,
    2,
  );
}

export function renderGoalContributionPrompt(body: string, transcript: string, goals: Goal[]): string {
  return body
    .replaceAll('{{goals_json}}', goalContextJson(goals))
    .replaceAll('{{transcript}}', transcript);
}

export function buildGoalContributionPrompt(transcript: string, goals: Goal[]): string {
  return renderGoalContributionPrompt(DEFAULT_GOAL_CONTRIBUTION_PROMPT_BODY, transcript, goals);
}

export function renderDailySummaryPrompt(
  body: string,
  date: string,
  entries: LogEntry[],
  planBlocks: PlanBlock[],
  goals: Goal[],
): string {
  return body
    .replaceAll('{{date}}', date)
    .replaceAll('{{entries_json}}', JSON.stringify(
      entries.map(entry => ({
        id: entry.id,
        start: new Date(entry.timestampStart).toISOString(),
        end: new Date(entry.timestampEnd).toISOString(),
        transcript: entry.transcript,
      })),
      null,
      2,
    ))
    .replaceAll('{{plan_json}}', JSON.stringify(
      planBlocks.map(block => ({
        id: block.id,
        startMin: block.startMin,
        endMin: block.endMin,
        activity: block.activity,
        source: block.source,
      })),
      null,
      2,
    ))
    .replaceAll('{{goals_json}}', goalContextJson(goals));
}
