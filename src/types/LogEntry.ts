export interface LogEntry {
  id: string;
  timestampStart: number; // Unix epoch ms
  timestampEnd: number;   // Unix epoch ms
  transcript: string;
}
