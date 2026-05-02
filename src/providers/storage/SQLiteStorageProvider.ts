import { open } from '@op-engineering/op-sqlite';
import { LogEntry } from '../../types/LogEntry';
import { StorageProvider } from './StorageProvider';

type DB = ReturnType<typeof open>;
let db: DB | null = null;

function getDb(): DB {
  if (!db) {
    db = open({ name: 'time-analyzer.sqlite' });
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS log_entries (
        id TEXT PRIMARY KEY,
        timestamp_start INTEGER NOT NULL,
        timestamp_end INTEGER NOT NULL,
        transcript TEXT NOT NULL
      )
    `);
  }
  return db;
}

function rowToEntry(row: Record<string, unknown>): LogEntry {
  return {
    id: row.id as string,
    timestampStart: row.timestamp_start as number,
    timestampEnd: row.timestamp_end as number,
    transcript: row.transcript as string,
  };
}

const SQLiteStorageProvider: StorageProvider = {
  async save(entry: LogEntry): Promise<void> {
    getDb().executeSync(
      'INSERT OR REPLACE INTO log_entries (id, timestamp_start, timestamp_end, transcript) VALUES (?, ?, ?, ?)',
      [entry.id, entry.timestampStart, entry.timestampEnd, entry.transcript],
    );
  },

  async update(entry: LogEntry): Promise<void> {
    getDb().executeSync(
      'UPDATE log_entries SET timestamp_start = ?, timestamp_end = ?, transcript = ? WHERE id = ?',
      [entry.timestampStart, entry.timestampEnd, entry.transcript, entry.id],
    );
  },

  async getAll(): Promise<LogEntry[]> {
    const result = getDb().executeSync(
      'SELECT * FROM log_entries ORDER BY timestamp_end DESC',
    );
    return (result.rows ?? []).map(rowToEntry);
  },

  async getByDateRange(start: Date, end: Date): Promise<LogEntry[]> {
    const result = getDb().executeSync(
      'SELECT * FROM log_entries WHERE timestamp_end >= ? AND timestamp_end <= ? ORDER BY timestamp_end DESC',
      [start.getTime(), end.getTime()],
    );
    return (result.rows ?? []).map(rowToEntry);
  },

  async delete(id: string): Promise<void> {
    getDb().executeSync('DELETE FROM log_entries WHERE id = ?', [id]);
  },
};

export default SQLiteStorageProvider;
