export type { LogEntry } from '../../types/LogEntry';

import { LogEntry } from '../../types/LogEntry';

export interface StorageProvider {
  save(entry: Omit<LogEntry, 'id'>): Promise<LogEntry>;
  update(entry: LogEntry): Promise<void>;
  getAll(): Promise<LogEntry[]>;
  getByDateRange(start: Date, end: Date): Promise<LogEntry[]>;
  delete(id: number): Promise<void>;
}
