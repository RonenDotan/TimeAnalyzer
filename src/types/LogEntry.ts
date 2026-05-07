export type EntrySource = 'app' | 'calendar';

export interface LogEntry {
  id: number;
  timestampStart: number; // Unix epoch ms
  timestampEnd: number;   // Unix epoch ms
  transcript: string;
  calendarEventId: string | null;
  source: EntrySource;
}
