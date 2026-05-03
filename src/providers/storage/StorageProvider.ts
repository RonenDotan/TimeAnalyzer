export type { LogEntry } from '../../types/LogEntry';
export type { Note } from '../../types/Note';

import { LogEntry } from '../../types/LogEntry';
import { Note } from '../../types/Note';

export interface StorageProvider {
  // entries
  save(entry: Omit<LogEntry, 'id'>): Promise<LogEntry>;
  update(entry: LogEntry): Promise<void>;
  getAll(): Promise<LogEntry[]>;
  getByDateRange(start: Date, end: Date): Promise<LogEntry[]>;
  delete(id: number): Promise<void>;

  // notes
  saveNote(note: Omit<Note, 'id'>): Promise<Note>;
  updateNote(note: Note): Promise<void>;
  getNotesByEntryId(entryId: number): Promise<Note[]>;
  deleteNote(id: number): Promise<void>;
}
