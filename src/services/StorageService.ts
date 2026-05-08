import { LogEntry } from '../types/LogEntry';
import { Note } from '../types/Note';
import { DayPlan, ParsedBlock, PlanBlock, PlanBlockWithDate } from '../types/DayPlan';
import { StorageProvider } from '../providers/storage/StorageProvider';
import SQLiteStorageProvider from '../providers/storage/SQLiteStorageProvider';

let activeProvider: StorageProvider = SQLiteStorageProvider;

function setProvider(provider: StorageProvider): void {
  activeProvider = provider;
}

async function save(entry: Omit<LogEntry, 'id' | 'status' | 'updatedAt' | 'syncedAt'>): Promise<LogEntry> {
  return activeProvider.save(entry);
}

async function update(entry: LogEntry): Promise<void> {
  return activeProvider.update(entry);
}

async function getAll(): Promise<LogEntry[]> {
  return activeProvider.getAll();
}

async function getByDateRange(start: Date, end: Date): Promise<LogEntry[]> {
  return activeProvider.getByDateRange(start, end);
}

async function deleteEntry(id: number): Promise<void> {
  return activeProvider.delete(id);
}

async function hardDeleteEntry(id: number): Promise<void> {
  return activeProvider.hardDeleteEntry(id);
}

async function saveNote(note: Omit<Note, 'id'>): Promise<Note> {
  return activeProvider.saveNote(note);
}

async function updateNote(note: Note): Promise<void> {
  return activeProvider.updateNote(note);
}

async function getNotesByEntryId(entryId: number): Promise<Note[]> {
  return activeProvider.getNotesByEntryId(entryId);
}

async function deleteNote(id: number): Promise<void> {
  return activeProvider.deleteNote(id);
}

async function upsertDayPlan(date: string): Promise<DayPlan> {
  return activeProvider.upsertDayPlan(date);
}

async function getDayPlan(date: string): Promise<DayPlan | null> {
  return activeProvider.getDayPlan(date);
}

async function upsertPlanBlocks(
  planId: number,
  blocks: Array<ParsedBlock & { id?: number }>,
  deletedIds: number[],
): Promise<PlanBlock[]> {
  return activeProvider.upsertPlanBlocks(planId, blocks, deletedIds);
}

async function getPlanBlocks(planId: number): Promise<PlanBlock[]> {
  return activeProvider.getPlanBlocks(planId);
}

async function hardDeletePlanBlock(id: number): Promise<void> {
  return activeProvider.hardDeletePlanBlock(id);
}

async function getUnsyncedEntries(): Promise<LogEntry[]> {
  return activeProvider.getUnsyncedEntries();
}

async function getPendingDeleteEntries(): Promise<LogEntry[]> {
  return activeProvider.getPendingDeleteEntries();
}

async function getUnsyncedPlanBlocksWithDate(): Promise<PlanBlockWithDate[]> {
  return activeProvider.getUnsyncedPlanBlocksWithDate();
}

async function getPendingDeletePlanBlocksWithDate(): Promise<PlanBlockWithDate[]> {
  return activeProvider.getPendingDeletePlanBlocksWithDate();
}

async function updateEntryCalendarEventId(id: number, calendarEventId: string): Promise<void> {
  return activeProvider.updateEntryCalendarEventId(id, calendarEventId);
}

async function updatePlanBlockCalendarEventId(id: number, calendarEventId: string): Promise<void> {
  return activeProvider.updatePlanBlockCalendarEventId(id, calendarEventId);
}

async function updateEntrySyncedAt(id: number, ts: number): Promise<void> {
  return activeProvider.updateEntrySyncedAt(id, ts);
}

async function updatePlanBlockSyncedAt(id: number, ts: number): Promise<void> {
  return activeProvider.updatePlanBlockSyncedAt(id, ts);
}

async function hardResetSyncedAt(): Promise<void> {
  return activeProvider.hardResetSyncedAt();
}

async function getCalendarPlanBlocksByDate(dateStr: string): Promise<PlanBlock[]> {
  return activeProvider.getCalendarPlanBlocksByDate(dateStr);
}

async function upsertCalendarPlanBlock(
  dateStr: string,
  calendarEventId: string,
  startMin: number,
  endMin: number,
  activity: string,
): Promise<void> {
  return activeProvider.upsertCalendarPlanBlock(dateStr, calendarEventId, startMin, endMin, activity);
}

async function softDeleteCalendarBlocksNotIn(dateStr: string, calendarEventIds: string[]): Promise<void> {
  return activeProvider.softDeleteCalendarBlocksNotIn(dateStr, calendarEventIds);
}

const StorageService = {
  save, update, getAll, getByDateRange, deleteEntry, hardDeleteEntry,
  saveNote, updateNote, getNotesByEntryId, deleteNote,
  upsertDayPlan, getDayPlan, upsertPlanBlocks, getPlanBlocks, hardDeletePlanBlock,
  getUnsyncedEntries, getPendingDeleteEntries,
  getUnsyncedPlanBlocksWithDate, getPendingDeletePlanBlocksWithDate,
  updateEntryCalendarEventId, updatePlanBlockCalendarEventId,
  updateEntrySyncedAt, updatePlanBlockSyncedAt, hardResetSyncedAt,
  getCalendarPlanBlocksByDate, upsertCalendarPlanBlock, softDeleteCalendarBlocksNotIn,
  setProvider,
};
export default StorageService;
