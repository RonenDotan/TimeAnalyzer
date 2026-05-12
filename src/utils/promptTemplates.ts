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
