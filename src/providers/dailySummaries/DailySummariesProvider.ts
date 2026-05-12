import { DailySummary } from '../../types/DailySummary';

export interface DailySummariesProvider {
  saveSummary(date: string, summaryJson: string): Promise<DailySummary>;
  getSummary(date: string): Promise<DailySummary | null>;
  getAllSummaries(): Promise<DailySummary[]>;
}
