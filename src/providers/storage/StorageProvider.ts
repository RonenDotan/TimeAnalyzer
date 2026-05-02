export type { LogEntry } from '../../types/LogEntry';

import { LogEntry } from '../../types/LogEntry';

export interface StorageProvider {
  save(entry: LogEntry): Promise<void>;
  getAll(): Promise<LogEntry[]>;
  getByDateRange(start: Date, end: Date): Promise<LogEntry[]>;
  delete(id: string): Promise<void>;
}
