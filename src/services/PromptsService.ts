import SQLitePromptsProvider from '../providers/prompts/SQLitePromptsProvider';
import { PromptsProvider } from '../providers/prompts/PromptsProvider';
import {
  Prompt,
  PromptInput,
  PROMPT_ACTION_GOAL_CONTRIBUTION,
} from '../types/Prompt';
import {
  DEFAULT_GOAL_CONTRIBUTION_PROMPT_BODY,
  renderGoalContributionPrompt,
} from '../utils/promptTemplates';
import { Goal } from '../types/Goal';

let activeProvider: PromptsProvider = SQLitePromptsProvider;

function setProvider(provider: PromptsProvider): void {
  activeProvider = provider;
}

async function getAllPrompts(): Promise<Prompt[]> {
  return activeProvider.getAllPrompts();
}

async function getDefaultPrompt(actionId: number): Promise<Prompt | null> {
  return activeProvider.getDefaultPrompt(actionId);
}

async function savePrompt(prompt: PromptInput): Promise<Prompt> {
  return activeProvider.savePrompt(prompt);
}

async function updatePrompt(prompt: Prompt): Promise<void> {
  return activeProvider.updatePrompt(prompt);
}

async function setDefaultPrompt(actionId: number, promptId: number): Promise<void> {
  return activeProvider.setDefaultPrompt(actionId, promptId);
}

async function buildGoalContributionPromptFromDefault(
  transcript: string,
  goals: Goal[],
): Promise<string> {
  const prompt = await getDefaultPrompt(PROMPT_ACTION_GOAL_CONTRIBUTION);
  const body = prompt?.body?.trim() || DEFAULT_GOAL_CONTRIBUTION_PROMPT_BODY;
  return renderGoalContributionPrompt(body, transcript, goals);
}

const PromptsService = {
  setProvider,
  getAllPrompts,
  getDefaultPrompt,
  savePrompt,
  updatePrompt,
  setDefaultPrompt,
  buildGoalContributionPromptFromDefault,
};

export default PromptsService;
