export const PROMPT_ACTION_GOAL_CONTRIBUTION = 1;
export const PROMPT_ACTION_DAILY_SUMMARY = 2;

export interface Prompt {
  id: number;
  actionId: number;
  name: string;
  body: string;
  isDefault: boolean;
  createdAt: number;
}

export type PromptInput = Omit<Prompt, 'id' | 'createdAt'> & {
  createdAt?: number;
};

export interface PromptActionDefinition {
  id: number;
  key: string;
  label: string;
  description: string;
}

export const PROMPT_ACTIONS: PromptActionDefinition[] = [
  {
    id: PROMPT_ACTION_GOAL_CONTRIBUTION,
    key: 'goal_contribution',
    label: 'Goal contribution',
    description: 'Suggest progress deltas for active goals from one check-in transcript.',
  },
  {
    id: PROMPT_ACTION_DAILY_SUMMARY,
    key: 'daily_summary',
    label: 'Daily Summary',
    description: 'Summarize a day of entries into a concise work report.',
  },
];

export function getPromptActionLabel(actionId: number): string {
  return PROMPT_ACTIONS.find(action => action.id === actionId)?.label ?? `Action ${actionId}`;
}
