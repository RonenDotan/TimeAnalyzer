import SettingsService from '../../services/SettingsService';
import { Goal } from '../../types/Goal';
import {
  AnalysisProvider,
  GoalContributionSuggestionResult,
  parseJsonObject,
  sanitizeGoalContributionSuggestions,
} from './AnalysisProvider';

async function isConfigured(): Promise<boolean> {
  return (await SettingsService.getClaudeApiKey()).trim().length > 0;
}

async function suggestGoalContributions(
  transcript: string,
  goals: Goal[],
  prompt: string,
): Promise<GoalContributionSuggestionResult> {
  const apiKey = (await SettingsService.getClaudeApiKey()).trim();
  if (!apiKey) throw new Error('Claude API key is not configured.');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Claude request failed (${res.status})`);
  }

  const text = json?.content?.[0]?.text ?? '';
  return sanitizeGoalContributionSuggestions(parseJsonObject(text), goals);
}

const ClaudeAnalysisProvider: AnalysisProvider = {
  isConfigured,
  suggestGoalContributions,
};

export default ClaudeAnalysisProvider;
