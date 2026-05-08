export type { LogEntry } from '../../types/LogEntry';
export type { Note } from '../../types/Note';
export type { DayPlan, PlanBlock, ParsedBlock, PlanBlockWithDate } from '../../types/DayPlan';

import { LogEntry } from '../../types/LogEntry';
import { Note } from '../../types/Note';
import { DayPlan, ParsedBlock, PlanBlock, PlanBlockWithDate } from '../../types/DayPlan';

export interface StorageProvider {
  // entries
  save(entry: Omit<LogEntry, 'id' | 'status' | 'updatedAt' | 'syncedAt'>): Promise<LogEntry>;
  update(entry: LogEntry): Promise<void>;
  getAll(): Promise<LogEntry[]>;
  getByDateRange(start: Date, end: Date): Promise<LogEntry[]>;
  delete(id: number): Promise<void>;           // soft-delete (status=0)
  hardDeleteEntry(id: number): Promise<void>;  // permanent delete (after calendar cleanup)

  // notes
  saveNote(note: Omit<Note, 'id'>): Promise<Note>;
  updateNote(note: Note): Promise<void>;
  getNotesByEntryId(entryId: number): Promise<Note[]>;
  deleteNote(id: number): Promise<void>;

  // day plans
  upsertDayPlan(date: string): Promise<DayPlan>;
  getDayPlan(date: string): Promise<DayPlan | null>;
  upsertPlanBlocks(
    planId: number,
    blocks: Array<ParsedBlock & { id?: number }>,
    deletedIds: number[],
  ): Promise<PlanBlock[]>;
  getPlanBlocks(planId: number): Promise<PlanBlock[]>;
  hardDeletePlanBlock(id: number): Promise<void>;

  // calendar sync queries (push — source='app' only)
  getUnsyncedEntries(): Promise<LogEntry[]>;
  getPendingDeleteEntries(): Promise<LogEntry[]>;
  getUnsyncedPlanBlocksWithDate(): Promise<PlanBlockWithDate[]>;
  getPendingDeletePlanBlocksWithDate(): Promise<PlanBlockWithDate[]>;
  updateEntryCalendarEventId(id: number, calendarEventId: string): Promise<void>;
  updatePlanBlockCalendarEventId(id: number, calendarEventId: string): Promise<void>;
  updateEntrySyncedAt(id: number, ts: number): Promise<void>;
  updatePlanBlockSyncedAt(id: number, ts: number): Promise<void>;
  hardResetSyncedAt(): Promise<void>;

  // calendar pull (source='calendar')
  upsertCalendarPlanBlock(
    dateStr: string,
    calendarEventId: string,
    startMin: number,
    endMin: number,
    activity: string,
  ): Promise<void>;
  softDeleteCalendarBlocksNotIn(dateStr: string, calendarEventIds: string[]): Promise<void>;
  getCalendarPlanBlocksByDate(dateStr: string): Promise<PlanBlock[]>;
}
