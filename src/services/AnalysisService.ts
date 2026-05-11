import ClaudeAnalysisProvider from '../providers/analysis/ClaudeAnalysisProvider';
import OpenAIAnalysisProvider from '../providers/analysis/OpenAIAnalysisProvider';
import {
  AnalysisProvider,
  GoalContributionSuggestionResult,
} from '../providers/analysis/AnalysisProvider';
import SettingsService from './SettingsService';
import { AnalysisProvider as AnalysisProviderName } from '../types/Settings';
import { Goal } from '../types/Goal';

function providerFor(name: AnalysisProviderName): AnalysisProvider {
  return name === 'openai' ? OpenAIAnalysisProvider : ClaudeAnalysisProvider;
}

async function getActiveProvider(): Promise<AnalysisProvider> {
  const settings = await SettingsService.load();
  return providerFor(settings.analysisProvider);
}

async function isConfigured(): Promise<boolean> {
  return (await getActiveProvider()).isConfigured();
}

async function getProviderLabel(): Promise<string> {
  const settings = await SettingsService.load();
  return settings.analysisProvider === 'openai' ? 'OpenAI' : 'Claude';
}

async function suggestGoalContributions(
  transcript: string,
  goals: Goal[],
): Promise<GoalContributionSuggestionResult> {
  if (goals.length === 0 || transcript.trim().length === 0) {
    return { suggestions: [] };
  }
  const provider = await getActiveProvider();
  if (!(await provider.isConfigured())) {
    return { suggestions: [] };
  }
  return provider.suggestGoalContributions(transcript, goals);
}

const AnalysisService = {
  isConfigured,
  getProviderLabel,
  suggestGoalContributions,
};

export default AnalysisService;
