import { Goal } from '../../types/Goal';
export { buildGoalContributionPrompt } from '../../utils/promptTemplates';

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
    prompt: string,
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

