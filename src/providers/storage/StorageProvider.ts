export interface LogEntry {
  id: string;
  timestampStart: number;
  timestampEnd: number;
  transcript: string;
}

export interface StorageProvider {
  save(entry: LogEntry): Promise<void>;
  loadAll(): Promise<LogEntry[]>;
}
