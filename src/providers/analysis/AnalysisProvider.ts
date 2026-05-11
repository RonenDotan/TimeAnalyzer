import { Goal } from '../../types/Goal';

export interface GoalContributionSuggestion {
  goalId: number;
  contributionPct: number;
  reason: string;
}

export interface GoalContributionSuggestionResult {
  suggestions: GoalContributionSuggestion[];
}

export interface AnalysisProvider {
  isConfigured(): Promise<boolean>;
  suggestGoalContributions(
    transcript: string,
    goals: Goal[],
  ): Promise<GoalContributionSuggestionResult>;
}

export function sanitizeGoalContributionSuggestions(
  raw: unknown,
  goals: Goal[],
): GoalContributionSuggestionResult {
  const knownGoals = new Map(goals.map(goal => [goal.id, goal]));
  const suggestions = Array.isArray((raw as any)?.suggestions)
    ? (raw as any).suggestions
    : [];

  return {
    suggestions: suggestions
      .map((item: any) => {
        const goalId = Number(item?.goalId);
        const goal = knownGoals.get(goalId);
        if (!goal) return null;

        const contributionPct = Math.round(Number(item?.contributionPct));
        if (!Number.isFinite(contributionPct) || contributionPct <= 0) return null;

        const remaining = Math.max(0, 100 - goal.progress);
        const clampedPct = Math.min(remaining, Math.max(0, contributionPct));
        if (clampedPct <= 0) return null;

        const reason = String(item?.reason ?? '').trim();
        return {
          goalId,
          contributionPct: clampedPct,
          reason: reason || 'Suggested from this check-in.',
        };
      })
      .filter((item: GoalContributionSuggestion | null): item is GoalContributionSuggestion => item !== null),
  };
}

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain JSON.');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export function buildGoalContributionPrompt(transcript: string, goals: Goal[]): string {
  return [
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
    JSON.stringify(
      goals.map(goal => ({
        id: goal.id,
        text: goal.text,
        progress: goal.progress,
        remaining: Math.max(0, 100 - goal.progress),
        targetAt: goal.targetAt,
      })),
      null,
      2,
    ),
    '',
    'Transcript:',
    transcript,
  ].join('\n');
}
