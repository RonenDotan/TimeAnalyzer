import { Goal } from '../types/Goal';

export const DEFAULT_GOAL_CONTRIBUTION_PROMPT_BODY = [
  'Suggest goal progress contributions for this work journal check-in.',
  '',
  'Rules:',
  '- Return only JSON with shape: {"suggestions":[{"goalId":number,"contributionPct":number,"reason":string}]}',
  '- Only suggest goals clearly advanced by the transcript.',
  '- contributionPct is the delta to add now, from 1 to the remaining percent for that goal.',
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

export function goalContextJson(goals: Goal[]): string {
  return JSON.stringify(
    goals.map(goal => ({
      id: goal.id,
      text: goal.text,
      progress: goal.progress,
      remaining: Math.max(0, 100 - goal.progress),
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
