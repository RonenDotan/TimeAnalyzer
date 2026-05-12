import SQLiteDailySummariesProvider from '../providers/dailySummaries/SQLiteDailySummariesProvider';
import { DailySummariesProvider } from '../providers/dailySummaries/DailySummariesProvider';
import { DailySummary, DailySummaryResult } from '../types/DailySummary';
import AnalysisService from './AnalysisService';
import GoalsService from './GoalsService';
import PromptsService from './PromptsService';
import StorageService from './StorageService';

let activeProvider: DailySummariesProvider = SQLiteDailySummariesProvider;

function setProvider(provider: DailySummariesProvider): void {
  activeProvider = provider;
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function normalizeSummary(raw: unknown): DailySummaryResult {
  const value = raw as any;
  const debrief = String(value?.debrief ?? '').trim();
  const keyInsights = Array.isArray(value?.keyInsights)
    ? value.keyInsights
        .map((item: any) => ({
          type: item?.type === undefined ? undefined : String(item.type),
          text: String(item?.text ?? '').trim(),
          confidence: item?.confidence === undefined ? undefined : String(item.confidence),
        }))
        .filter((item: any) => item.text.length > 0)
    : undefined;
  const gaps = Array.isArray(value?.gaps)
    ? value.gaps.map((item: any) => String(item).trim()).filter((item: string) => item.length > 0)
    : undefined;
  const momentum = value?.momentum === undefined ? undefined : String(value.momentum).trim();

  return {
    debrief: debrief || 'No daily summary was generated.',
    keyInsights,
    momentum,
    gaps,
  };
}

function parseSummary(summary: DailySummary | null): DailySummaryResult | null {
  if (!summary) return null;
  return normalizeSummary(JSON.parse(summary.summaryJson));
}

async function generateSummary(date: Date): Promise<DailySummary> {
  const dateStr = toDateStr(date);
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [entries, plan, calBlocks, goals] = await Promise.all([
    StorageService.getByDateRange(dayStart, dayEnd),
    StorageService.getDayPlan(dateStr),
    StorageService.getCalendarPlanBlocksByDate(dateStr),
    GoalsService.getActiveGoals(dayEnd.getTime()),
  ]);

  const sortedEntries = entries.sort((a, b) => a.timestampStart - b.timestampStart);
  const appBlocks = plan ? await StorageService.getPlanBlocks(plan.id) : [];
  const planBlocks = [...appBlocks, ...calBlocks].sort((a, b) => a.startMin - b.startMin);
  const prompt = await PromptsService.buildDailySummaryPromptFromDefault(dateStr, sortedEntries, planBlocks, goals);
  const summary = normalizeSummary(await AnalysisService.generateJson(prompt, 1200));

  return activeProvider.saveSummary(dateStr, JSON.stringify(summary));
}

async function getSummary(date: Date | string): Promise<DailySummary | null> {
  return activeProvider.getSummary(typeof date === 'string' ? date : toDateStr(date));
}

async function getAllSummaries(): Promise<DailySummary[]> {
  return activeProvider.getAllSummaries();
}

const DailySummaryService = {
  setProvider,
  generateSummary,
  getSummary,
  getAllSummaries,
  parseSummary,
};

export default DailySummaryService;
