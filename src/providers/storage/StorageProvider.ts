export type { LogEntry } from '../../types/LogEntry';
export type { Note } from '../../types/Note';
export type { DayPlan, PlanBlock, ParsedBlock } from '../../types/DayPlan';

import { LogEntry } from '../../types/LogEntry';
import { Note } from '../../types/Note';
import { DayPlan, ParsedBlock, PlanBlock } from '../../types/DayPlan';

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

  // day plans
  upsertDayPlan(date: string): Promise<DayPlan>;
  getDayPlan(date: string): Promise<DayPlan | null>;
  replacePlanBlocks(planId: number, blocks: ParsedBlock[]): Promise<PlanBlock[]>;
  getPlanBlocks(planId: number): Promise<PlanBlock[]>;

  // calendar sync
  updateEntryCalendarEventId(id: number, calendarEventId: string): Promise<void>;
  updatePlanBlockCalendarEventId(id: number, calendarEventId: string): Promise<void>;
}
