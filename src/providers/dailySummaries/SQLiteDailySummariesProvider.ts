import { DailySummary } from '../../types/DailySummary';
import { getDb } from '../storage/SQLiteStorageProvider';
import { DailySummariesProvider } from './DailySummariesProvider';

function rowToDailySummary(row: Record<string, unknown>): DailySummary {
  return {
    id: row.id as number,
    date: row.date as string,
    summaryJson: row.summary_json as string,
    generatedAt: row.generated_at as number,
  };
}

const SQLiteDailySummariesProvider: DailySummariesProvider = {
  async saveSummary(date, summaryJson) {
    const now = Date.now();
    const existing = getDb().executeSync('SELECT id FROM daily_summaries WHERE date = ?', [date]);
    if ((existing.rows ?? []).length > 0) {
      getDb().executeSync(
        'UPDATE daily_summaries SET summary_json = ?, generated_at = ? WHERE date = ?',
        [summaryJson, now, date],
      );
    } else {
      getDb().executeSync(
        'INSERT INTO daily_summaries (date, summary_json, generated_at) VALUES (?, ?, ?)',
        [date, summaryJson, now],
      );
    }

    const result = getDb().executeSync('SELECT * FROM daily_summaries WHERE date = ?', [date]);
    return rowToDailySummary(result.rows![0]);
  },

  async getSummary(date) {
    const result = getDb().executeSync('SELECT * FROM daily_summaries WHERE date = ?', [date]);
    if (!result.rows || result.rows.length === 0) return null;
    return rowToDailySummary(result.rows[0]);
  },

  async getAllSummaries() {
    const result = getDb().executeSync('SELECT * FROM daily_summaries ORDER BY date DESC');
    return (result.rows ?? []).map(rowToDailySummary);
  },
};

export default SQLiteDailySummariesProvider;
