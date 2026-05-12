import { Prompt, PromptInput } from '../../types/Prompt';

export interface PromptsProvider {
  getAllPrompts(): Promise<Prompt[]>;
  getDefaultPrompt(actionId: number): Promise<Prompt | null>;
  savePrompt(prompt: PromptInput): Promise<Prompt>;
  updatePrompt(prompt: Prompt): Promise<void>;
  setDefaultPrompt(actionId: number, promptId: number): Promise<void>;
}
