import SettingsService from '../../services/SettingsService';
import { Goal } from '../../types/Goal';
import {
  AnalysisProvider,
  GoalContributionSuggestionResult,
  parseJsonObject,
  sanitizeGoalContributionSuggestions,
} from './AnalysisProvider';

async function isConfigured(): Promise<boolean> {
  return (await SettingsService.getOpenAIApiKey()).trim().length > 0;
}

async function suggestGoalContributions(
  transcript: string,
  goals: Goal[],
  prompt: string,
): Promise<GoalContributionSuggestionResult> {
  const apiKey = (await SettingsService.getOpenAIApiKey()).trim();
  if (!apiKey) throw new Error('OpenAI API key is not configured.');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You return strict JSON only. Do not include markdown.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `OpenAI request failed (${res.status})`);
  }

  const text = json?.choices?.[0]?.message?.content ?? '';
  return sanitizeGoalContributionSuggestions(parseJsonObject(text), goals);
}

const OpenAIAnalysisProvider: AnalysisProvider = {
  isConfigured,
  suggestGoalContributions,
};

export default OpenAIAnalysisProvider;
