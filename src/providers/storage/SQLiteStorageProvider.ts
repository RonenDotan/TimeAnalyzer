import { open } from '@op-engineering/op-sqlite';
import { LogEntry, EntrySource } from '../../types/LogEntry';
import { Note } from '../../types/Note';
import { DayPlan, ParsedBlock, PlanBlock, PlanBlockWithDate, BlockSource } from '../../types/DayPlan';
import { StorageProvider } from './StorageProvider';

type DB = ReturnType<typeof open>;
let db: DB | null = null;

const SCHEMA_VERSION = 3;

function getDb(): DB {
  if (!db) {
    db = open({ name: 'time-analyzer.sqlite' });

    // Base tables — new installs get full schema including v3 columns
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS log_entries (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp_start   INTEGER NOT NULL,
        timestamp_end     INTEGER NOT NULL,
        transcript        TEXT NOT NULL,
        calendar_event_id TEXT,
        source            TEXT NOT NULL DEFAULT 'app',
        status            INTEGER NOT NULL DEFAULT 1,
        updated_at        INTEGER NOT NULL DEFAULT 0,
        synced_at         INTEGER
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
        source            TEXT NOT NULL DEFAULT 'app',
        status            INTEGER NOT NULL DEFAULT 1,
        updated_at        INTEGER NOT NULL DEFAULT 0,
        synced_at         INTEGER
      )
    `);
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL
      )
    `);

    // Triggers: auto-update updated_at when content fields change.
    // Excludes calendar_event_id, synced_at, status so those updates
    // don't mark the row dirty for sync purposes.
    db.executeSync(`
      CREATE TRIGGER IF NOT EXISTS trg_log_entries_updated
      AFTER UPDATE OF timestamp_start, timestamp_end, transcript ON log_entries
      FOR EACH ROW
      BEGIN
        UPDATE log_entries SET updated_at = CAST(strftime('%s','now') AS INTEGER)*1000 WHERE id = NEW.id;
      END
    `);
    db.executeSync(`
      CREATE TRIGGER IF NOT EXISTS trg_plan_blocks_updated
      AFTER UPDATE OF start_min, end_min, activity ON plan_blocks
      FOR EACH ROW
      BEGIN
        UPDATE plan_blocks SET updated_at = CAST(strftime('%s','now') AS INTEGER)*1000 WHERE id = NEW.id;
      END
    `);

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

  // Migration 1→2: calendar_event_id and source
  if (current < 2) {
    try { d.executeSync('ALTER TABLE log_entries ADD COLUMN calendar_event_id TEXT'); } catch {}
    try { d.executeSync("ALTER TABLE log_entries ADD COLUMN source TEXT NOT NULL DEFAULT 'app'"); } catch {}
    try { d.executeSync('ALTER TABLE plan_blocks ADD COLUMN calendar_event_id TEXT'); } catch {}
    try { d.executeSync("ALTER TABLE plan_blocks ADD COLUMN source TEXT NOT NULL DEFAULT 'app'"); } catch {}
    setVersion(d, 2);
  }

  // Migration 2→3: status, updated_at, synced_at
  if (current < 3) {
    try { d.executeSync('ALTER TABLE log_entries ADD COLUMN status INTEGER NOT NULL DEFAULT 1'); } catch {}
    try { d.executeSync('ALTER TABLE log_entries ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0'); } catch {}
    try { d.executeSync('ALTER TABLE log_entries ADD COLUMN synced_at INTEGER'); } catch {}
    try { d.executeSync('ALTER TABLE plan_blocks ADD COLUMN status INTEGER NOT NULL DEFAULT 1'); } catch {}
    try { d.executeSync('ALTER TABLE plan_blocks ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0'); } catch {}
    try { d.executeSync('ALTER TABLE plan_blocks ADD COLUMN synced_at INTEGER'); } catch {}
    setVersion(d, 3);
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
    status: (row.status as 0 | 1) ?? 1,
    updatedAt: (row.updated_at as number) ?? 0,
    syncedAt: (row.synced_at as number | null) ?? null,
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
    status: (row.status as 0 | 1) ?? 1,
    updatedAt: (row.updated_at as number) ?? 0,
    syncedAt: (row.synced_at as number | null) ?? null,
  };
}

function rowToPlanBlockWithDate(row: Record<string, unknown>): PlanBlockWithDate {
  return { ...rowToPlanBlock(row), date: row.date as string };
}

const SQLiteStorageProvider: StorageProvider = {
  async save(entry) {
    const now = Date.now();
    const result = getDb().executeSync(
      'INSERT INTO log_entries (timestamp_start, timestamp_end, transcript, calendar_event_id, source, status, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [entry.timestampStart, entry.timestampEnd, entry.transcript, entry.calendarEventId ?? null, entry.source ?? 'app', 1, now, null],
    );
    return {
      ...entry,
      id: result.insertId as number,
      calendarEventId: entry.calendarEventId ?? null,
      source: entry.source ?? 'app',
      status: 1,
      updatedAt: now,
      syncedAt: null,
    };
  },

  async update(entry) {
    getDb().executeSync(
      'UPDATE log_entries SET timestamp_start = ?, timestamp_end = ?, transcript = ?, calendar_event_id = ?, source = ? WHERE id = ?',
      [entry.timestampStart, entry.timestampEnd, entry.transcript, entry.calendarEventId ?? null, entry.source ?? 'app', entry.id],
    );
  },

  async getAll() {
    const result = getDb().executeSync(
      'SELECT * FROM log_entries WHERE status = 1 ORDER BY timestamp_end DESC',
    );
    return (result.rows ?? []).map(rowToEntry);
  },

  async getByDateRange(start, end) {
    const result = getDb().executeSync(
      'SELECT * FROM log_entries WHERE status = 1 AND timestamp_end >= ? AND timestamp_end <= ? ORDER BY timestamp_end DESC',
      [start.getTime(), end.getTime()],
    );
    return (result.rows ?? []).map(rowToEntry);
  },

  async delete(id) {
    // Soft-delete: interval sync will remove the calendar event then hard-delete
    getDb().executeSync('UPDATE log_entries SET status = 0 WHERE id = ?', [id]);
  },

  async hardDeleteEntry(id) {
    getDb().executeSync('DELETE FROM log_entries WHERE id = ?', [id]);
  },

  async saveNote(note) {
    const result = getDb().executeSync(
      'INSERT INTO notes (entry_id, text, created_at) VALUES (?, ?, ?)',
      [note.entryId, note.text, note.createdAt],
    );
    return { ...note, id: result.insertId as number };
  },

  async updateNote(note) {
    getDb().executeSync('UPDATE notes SET text = ? WHERE id = ?', [note.text, note.id]);
  },

  async getNotesByEntryId(entryId) {
    const result = getDb().executeSync(
      'SELECT * FROM notes WHERE entry_id = ? ORDER BY created_at ASC',
      [entryId],
    );
    return (result.rows ?? []).map(rowToNote);
  },

  async deleteNote(id) {
    getDb().executeSync('DELETE FROM notes WHERE id = ?', [id]);
  },

  async upsertDayPlan(date) {
    const existing = getDb().executeSync('SELECT * FROM day_plans WHERE date = ?', [date]);
    if (existing.rows && existing.rows.length > 0) {
      return rowToDayPlan(existing.rows[0]);
    }
    const result = getDb().executeSync(
      'INSERT INTO day_plans (date, created_at) VALUES (?, ?)',
      [date, Date.now()],
    );
    return { id: result.insertId as number, date, createdAt: Date.now() };
  },

  async getDayPlan(date) {
    const result = getDb().executeSync('SELECT * FROM day_plans WHERE date = ?', [date]);
    if (!result.rows || result.rows.length === 0) return null;
    return rowToDayPlan(result.rows[0]);
  },

  async upsertPlanBlocks(planId, blocks, deletedIds) {
    const now = Date.now();
    const saved: PlanBlock[] = [];

    for (const block of blocks) {
      if (block.id !== undefined) {
        // Update existing — trigger will auto-update updated_at
        getDb().executeSync(
          'UPDATE plan_blocks SET start_min = ?, end_min = ?, activity = ? WHERE id = ?',
          [block.startMin, block.endMin, block.activity, block.id],
        );
        const r = getDb().executeSync('SELECT * FROM plan_blocks WHERE id = ?', [block.id]);
        if (r.rows && r.rows.length > 0) {
          saved.push(rowToPlanBlock(r.rows[0]));
        }
      } else {
        // Insert new
        const result = getDb().executeSync(
          'INSERT INTO plan_blocks (plan_id, start_min, end_min, activity, calendar_event_id, source, status, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [planId, block.startMin, block.endMin, block.activity, null, 'app', 1, now, null],
        );
        saved.push({
          id: result.insertId as number,
          planId,
          startMin: block.startMin,
          endMin: block.endMin,
          activity: block.activity,
          calendarEventId: null,
          source: 'app',
          status: 1,
          updatedAt: now,
          syncedAt: null,
        });
      }
    }

    // Soft-delete removed blocks; interval sync handles calendar deletion
    for (const id of deletedIds) {
      getDb().executeSync('UPDATE plan_blocks SET status = 0 WHERE id = ?', [id]);
    }

    return saved;
  },

  async getPlanBlocks(planId) {
    const result = getDb().executeSync(
      'SELECT * FROM plan_blocks WHERE plan_id = ? AND status = 1 ORDER BY start_min ASC',
      [planId],
    );
    return (result.rows ?? []).map(rowToPlanBlock);
  },

  async hardDeletePlanBlock(id) {
    getDb().executeSync('DELETE FROM plan_blocks WHERE id = ?', [id]);
  },

  async getUnsyncedEntries() {
    const result = getDb().executeSync(
      'SELECT * FROM log_entries WHERE status = 1 AND (synced_at IS NULL OR updated_at > synced_at)',
    );
    return (result.rows ?? []).map(rowToEntry);
  },

  async getPendingDeleteEntries() {
    const result = getDb().executeSync('SELECT * FROM log_entries WHERE status = 0');
    return (result.rows ?? []).map(rowToEntry);
  },

  async getUnsyncedPlanBlocksWithDate() {
    const result = getDb().executeSync(`
      SELECT pb.*, dp.date
      FROM plan_blocks pb
      JOIN day_plans dp ON pb.plan_id = dp.id
      WHERE pb.status = 1 AND (pb.synced_at IS NULL OR pb.updated_at > pb.synced_at)
    `);
    return (result.rows ?? []).map(rowToPlanBlockWithDate);
  },

  async getPendingDeletePlanBlocksWithDate() {
    const result = getDb().executeSync(`
      SELECT pb.*, dp.date
      FROM plan_blocks pb
      JOIN day_plans dp ON pb.plan_id = dp.id
      WHERE pb.status = 0
    `);
    return (result.rows ?? []).map(rowToPlanBlockWithDate);
  },

  async updateEntryCalendarEventId(id, calendarEventId) {
    getDb().executeSync(
      'UPDATE log_entries SET calendar_event_id = ? WHERE id = ?',
      [calendarEventId, id],
    );
  },

  async updatePlanBlockCalendarEventId(id, calendarEventId) {
    getDb().executeSync(
      'UPDATE plan_blocks SET calendar_event_id = ? WHERE id = ?',
      [calendarEventId, id],
    );
  },

  async updateEntrySyncedAt(id, ts) {
    getDb().executeSync('UPDATE log_entries SET synced_at = ? WHERE id = ?', [ts, id]);
  },

  async updatePlanBlockSyncedAt(id, ts) {
    getDb().executeSync('UPDATE plan_blocks SET synced_at = ? WHERE id = ?', [ts, id]);
  },

  async hardResetSyncedAt() {
    getDb().executeSync('UPDATE log_entries SET synced_at = NULL WHERE status = 1');
    getDb().executeSync('UPDATE plan_blocks SET synced_at = NULL WHERE status = 1');
  },
};

export default SQLiteStorageProvider;
