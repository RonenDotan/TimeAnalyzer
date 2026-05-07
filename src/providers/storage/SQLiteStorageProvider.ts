import { open } from '@op-engineering/op-sqlite';
import { LogEntry, EntrySource } from '../../types/LogEntry';
import { Note } from '../../types/Note';
import { DayPlan, ParsedBlock, PlanBlock, BlockSource } from '../../types/DayPlan';
import { StorageProvider } from './StorageProvider';

type DB = ReturnType<typeof open>;
let db: DB | null = null;

const SCHEMA_VERSION = 2;

function getDb(): DB {
  if (!db) {
    db = open({ name: 'time-analyzer.sqlite' });

    // Base tables
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS log_entries (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp_start INTEGER NOT NULL,
        timestamp_end   INTEGER NOT NULL,
        transcript      TEXT NOT NULL,
        calendar_event_id TEXT,
        source          TEXT NOT NULL DEFAULT 'app'
      )
    `);
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS notes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id   INTEGER NOT NULL,
        text       TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS day_plans (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        date       TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      )
    `);
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS plan_blocks (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id           INTEGER NOT NULL,
        start_min         INTEGER NOT NULL,
        end_min           INTEGER NOT NULL,
        activity          TEXT NOT NULL,
        calendar_event_id TEXT,
        source            TEXT NOT NULL DEFAULT 'app'
      )
    `);

    // Schema version table
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL
      )
    `);

    // Run migrations
    runMigrations(db);
  }
  return db;
}

function getCurrentVersion(d: DB): number {
  const result = d.executeSync('SELECT version FROM schema_version LIMIT 1');
  if (!result.rows || result.rows.length === 0) return 0;
  return result.rows[0].version as number;
}

function setVersion(d: DB, version: number): void {
  d.executeSync('DELETE FROM schema_version');
  d.executeSync('INSERT INTO schema_version (version) VALUES (?)', [version]);
}

function runMigrations(d: DB): void {
  const current = getCurrentVersion(d);
  if (current >= SCHEMA_VERSION) return;

  // Migration 1→2: add calendar_event_id and source to existing tables
  if (current < 2) {
    try { d.executeSync('ALTER TABLE log_entries ADD COLUMN calendar_event_id TEXT'); } catch {}
    try { d.executeSync("ALTER TABLE log_entries ADD COLUMN source TEXT NOT NULL DEFAULT 'app'"); } catch {}
    try { d.executeSync('ALTER TABLE plan_blocks ADD COLUMN calendar_event_id TEXT'); } catch {}
    try { d.executeSync("ALTER TABLE plan_blocks ADD COLUMN source TEXT NOT NULL DEFAULT 'app'"); } catch {}
    setVersion(d, 2);
  }
}

function rowToEntry(row: Record<string, unknown>): LogEntry {
  return {
    id: row.id as number,
    timestampStart: row.timestamp_start as number,
    timestampEnd: row.timestamp_end as number,
    transcript: row.transcript as string,
    calendarEventId: (row.calendar_event_id as string | null) ?? null,
    source: (row.source as EntrySource) ?? 'app',
  };
}

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as number,
    entryId: row.entry_id as number,
    text: row.text as string,
    createdAt: row.created_at as number,
  };
}

function rowToDayPlan(row: Record<string, unknown>): DayPlan {
  return {
    id: row.id as number,
    date: row.date as string,
    createdAt: row.created_at as number,
  };
}

function rowToPlanBlock(row: Record<string, unknown>): PlanBlock {
  return {
    id: row.id as number,
    planId: row.plan_id as number,
    startMin: row.start_min as number,
    endMin: row.end_min as number,
    activity: row.activity as string,
    calendarEventId: (row.calendar_event_id as string | null) ?? null,
    source: (row.source as BlockSource) ?? 'app',
  };
}

const SQLiteStorageProvider: StorageProvider = {
  async save(entry: Omit<LogEntry, 'id'>): Promise<LogEntry> {
    const result = getDb().executeSync(
      'INSERT INTO log_entries (timestamp_start, timestamp_end, transcript, calendar_event_id, source) VALUES (?, ?, ?, ?, ?)',
      [entry.timestampStart, entry.timestampEnd, entry.transcript, entry.calendarEventId ?? null, entry.source ?? 'app'],
    );
    return { ...entry, id: result.insertId as number, calendarEventId: entry.calendarEventId ?? null, source: entry.source ?? 'app' };
  },

  async update(entry: LogEntry): Promise<void> {
    getDb().executeSync(
      'UPDATE log_entries SET timestamp_start = ?, timestamp_end = ?, transcript = ?, calendar_event_id = ?, source = ? WHERE id = ?',
      [entry.timestampStart, entry.timestampEnd, entry.transcript, entry.calendarEventId ?? null, entry.source ?? 'app', entry.id],
    );
  },

  async getAll(): Promise<LogEntry[]> {
    const result = getDb().executeSync('SELECT * FROM log_entries ORDER BY timestamp_end DESC');
    return (result.rows ?? []).map(rowToEntry);
  },

  async getByDateRange(start: Date, end: Date): Promise<LogEntry[]> {
    const result = getDb().executeSync(
      'SELECT * FROM log_entries WHERE timestamp_end >= ? AND timestamp_end <= ? ORDER BY timestamp_end DESC',
      [start.getTime(), end.getTime()],
    );
    return (result.rows ?? []).map(rowToEntry);
  },

  async delete(id: number): Promise<void> {
    getDb().executeSync('DELETE FROM log_entries WHERE id = ?', [id]);
  },

  async saveNote(note: Omit<Note, 'id'>): Promise<Note> {
    const result = getDb().executeSync(
      'INSERT INTO notes (entry_id, text, created_at) VALUES (?, ?, ?)',
      [note.entryId, note.text, note.createdAt],
    );
    return { ...note, id: result.insertId as number };
  },

  async updateNote(note: Note): Promise<void> {
    getDb().executeSync('UPDATE notes SET text = ? WHERE id = ?', [note.text, note.id]);
  },

  async getNotesByEntryId(entryId: number): Promise<Note[]> {
    const result = getDb().executeSync(
      'SELECT * FROM notes WHERE entry_id = ? ORDER BY created_at ASC',
      [entryId],
    );
    return (result.rows ?? []).map(rowToNote);
  },

  async deleteNote(id: number): Promise<void> {
    getDb().executeSync('DELETE FROM notes WHERE id = ?', [id]);
  },

  async upsertDayPlan(date: string): Promise<DayPlan> {
    const existing = getDb().executeSync(
      'SELECT * FROM day_plans WHERE date = ?', [date],
    );
    if (existing.rows && existing.rows.length > 0) {
      return rowToDayPlan(existing.rows[0]);
    }
    const result = getDb().executeSync(
      'INSERT INTO day_plans (date, created_at) VALUES (?, ?)',
      [date, Date.now()],
    );
    return { id: result.insertId as number, date, createdAt: Date.now() };
  },

  async getDayPlan(date: string): Promise<DayPlan | null> {
    const result = getDb().executeSync(
      'SELECT * FROM day_plans WHERE date = ?', [date],
    );
    if (!result.rows || result.rows.length === 0) return null;
    return rowToDayPlan(result.rows[0]);
  },

  async replacePlanBlocks(planId: number, blocks: ParsedBlock[]): Promise<PlanBlock[]> {
    // Return old blocks (with calendarEventIds) before deleting, for caller to clean up Calendar
    const oldResult = getDb().executeSync(
      'SELECT * FROM plan_blocks WHERE plan_id = ?', [planId],
    );
    const oldBlocks = (oldResult.rows ?? []).map(rowToPlanBlock);

    getDb().executeSync('DELETE FROM plan_blocks WHERE plan_id = ?', [planId]);

    const saved: PlanBlock[] = [];
    for (const block of blocks) {
      const result = getDb().executeSync(
        'INSERT INTO plan_blocks (plan_id, start_min, end_min, activity, calendar_event_id, source) VALUES (?, ?, ?, ?, ?, ?)',
        [planId, block.startMin, block.endMin, block.activity, null, 'app'],
      );
      saved.push({ ...block, id: result.insertId as number, planId, calendarEventId: null, source: 'app' });
    }

    // Attach old blocks to result so CalendarSyncService can delete their events
    (saved as any).__oldBlocks = oldBlocks;
    return saved;
  },

  async getPlanBlocks(planId: number): Promise<PlanBlock[]> {
    const result = getDb().executeSync(
      'SELECT * FROM plan_blocks WHERE plan_id = ? ORDER BY start_min ASC',
      [planId],
    );
    return (result.rows ?? []).map(rowToPlanBlock);
  },

  async updateEntryCalendarEventId(id: number, calendarEventId: string): Promise<void> {
    getDb().executeSync(
      'UPDATE log_entries SET calendar_event_id = ? WHERE id = ?',
      [calendarEventId, id],
    );
  },

  async updatePlanBlockCalendarEventId(id: number, calendarEventId: string): Promise<void> {
    getDb().executeSync(
      'UPDATE plan_blocks SET calendar_event_id = ? WHERE id = ?',
      [calendarEventId, id],
    );
  },
};

export default SQLiteStorageProvider;
