export interface DailySummary {
  id: number;
  date: string;
  summaryJson: string;
  generatedAt: number;
}

export interface DailySummaryInsight {
  type?: string;
  text: string;
  confidence?: string;
}

export interface DailySummaryResult {
  debrief: string;
  keyInsights?: DailySummaryInsight[];
  momentum?: string;
  gaps?: string[];
}
