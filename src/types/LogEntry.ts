export type EntrySource = 'app' | 'calendar';

export interface LogEntry {
  id: number;
  timestampStart: number; // Unix epoch ms
  timestampEnd: number;   // Unix epoch ms
  transcript: string;
  calendarEventId: string | null;
  source: EntrySource;
  status: 0 | 1;          // 1=active, 0=pending delete
  updatedAt: number;      // Unix epoch ms
  syncedAt: number | null; // Unix epoch ms, null = never synced
}
