import { open } from '@op-engineering/op-sqlite';
import { LogEntry, EntrySource } from '../../types/LogEntry';
import { Note } from '../../types/Note';
import { DayPlan, ParsedBlock, PlanBlock, PlanBlockWithDate, BlockSource } from '../../types/DayPlan';
import { StorageProvider } from './StorageProvider';
import { PROMPT_ACTION_DAILY_SUMMARY, PROMPT_ACTION_GOAL_CONTRIBUTION } from '../../types/Prompt';
import { CLAUDE_DAILY_SUMMARY_PROMPT_BODY, CLAUDE_GOAL_CONTRIBUTION_PROMPT_BODY, CODEX_DAILY_SUMMARY_PROMPT_BODY, DEFAULT_DAILY_SUMMARY_PROMPT_BODY, DEFAULT_GOAL_CONTRIBUTION_PROMPT_BODY } from '../../utils/promptTemplates';

type DB = ReturnType<typeof open>;
let db: DB | null = null;

const SCHEMA_VERSION = 8;

export function getDb(): DB {
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
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS goals (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        text        TEXT    NOT NULL,
        start_at    INTEGER NOT NULL,
        target_at   INTEGER,
        progress    INTEGER NOT NULL DEFAULT 0,
        status      TEXT    NOT NULL DEFAULT 'active',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL DEFAULT 0
      )
    `);
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS goal_contributions (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id          INTEGER NOT NULL,
        entry_id         INTEGER,
        contribution_pct INTEGER NOT NULL,
        created_at       INTEGER NOT NULL
      )
    `);
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS prompts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        action_id  INTEGER NOT NULL,
        name       TEXT    NOT NULL,
        body       TEXT    NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS daily_summaries (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        date         TEXT    NOT NULL UNIQUE,
        summary_json TEXT    NOT NULL,
        generated_at INTEGER NOT NULL
      )
    `);
    db.executeSync(`CREATE INDEX IF NOT EXISTS idx_goals_status    ON goals (status)`);
    db.executeSync(`CREATE INDEX IF NOT EXISTS idx_goals_start_at  ON goals (start_at)`);
    db.executeSync(`CREATE INDEX IF NOT EXISTS idx_contributions_goal ON goal_contributions (goal_id)`);
    db.executeSync(`CREATE INDEX IF NOT EXISTS idx_prompts_action_default ON prompts (action_id, is_default)`);

    // Defensive fix: if goals table exists but has old schema (pre-v0.0.23.11),
    // drop and recreate regardless of schema_version state.
    {
      const pragma = db.executeSync("PRAGMA table_info(goals)");
      const cols = (pragma.rows ?? []).map((r: any) => String(r.name));
      if (cols.length > 0 && !cols.includes('status')) {
        db.executeSync('DROP TABLE IF EXISTS goals');
        db.executeSync('DROP TABLE IF EXISTS goal_contributions');
        db.executeSync(`
          CREATE TABLE goals (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            text        TEXT    NOT NULL,
            start_at    INTEGER NOT NULL,
            target_at   INTEGER,
            progress    INTEGER NOT NULL DEFAULT 0,
            status      TEXT    NOT NULL DEFAULT 'active',
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL DEFAULT 0
          )
        `);
        db.executeSync(`
          CREATE TABLE goal_contributions (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            goal_id          INTEGER NOT NULL,
            entry_id         INTEGER,
            contribution_pct INTEGER NOT NULL,
            created_at       INTEGER NOT NULL
          )
        `);
        try { db.executeSync('CREATE INDEX IF NOT EXISTS idx_goals_status       ON goals (status)'); } catch {}
        try { db.executeSync('CREATE INDEX IF NOT EXISTS idx_goals_start_at     ON goals (start_at)'); } catch {}
        try { db.executeSync('CREATE INDEX IF NOT EXISTS idx_contributions_goal ON goal_contributions (goal_id)'); } catch {}
      }
    }

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
    seedDefaultPrompts(db);
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

  // Migration 3→4: replace old goals table (date/done/sort_order) with new schema
  //   (start_at, target_at, progress, status) + goal_contributions table
  if (current < 4) {
    try { d.executeSync('DROP TABLE IF EXISTS goals'); } catch {}
    try { d.executeSync('DROP TABLE IF EXISTS goal_contributions'); } catch {}
    d.executeSync(`
      CREATE TABLE IF NOT EXISTS goals (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        text        TEXT    NOT NULL,
        start_at    INTEGER NOT NULL,
        target_at   INTEGER,
        progress    INTEGER NOT NULL DEFAULT 0,
        status      TEXT    NOT NULL DEFAULT 'active',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL DEFAULT 0
      )
    `);
    d.executeSync(`
      CREATE TABLE IF NOT EXISTS goal_contributions (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id          INTEGER NOT NULL,
        entry_id         INTEGER,
        contribution_pct INTEGER NOT NULL,
        created_at       INTEGER NOT NULL
      )
    `);
    try { d.executeSync('CREATE INDEX IF NOT EXISTS idx_goals_status       ON goals (status)'); } catch {}
    try { d.executeSync('CREATE INDEX IF NOT EXISTS idx_goals_start_at     ON goals (start_at)'); } catch {}
    try { d.executeSync('CREATE INDEX IF NOT EXISTS idx_contributions_goal ON goal_contributions (goal_id)'); } catch {}
    setVersion(d, 4);
  }

  // Migration 4->5: prompt management table for debug prompt editing/defaults
  if (current < 5) {
    d.executeSync(`
      CREATE TABLE IF NOT EXISTS prompts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        action_id  INTEGER NOT NULL,
        name       TEXT    NOT NULL,
        body       TEXT    NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);
    try { d.executeSync('CREATE INDEX IF NOT EXISTS idx_prompts_action_default ON prompts (action_id, is_default)'); } catch {}
    seedDefaultPrompts(d);
    setVersion(d, 5);
  }

  // Migration 5->6: add Claude and Codex daily summary prompts as alternatives
  if (current < 6) {
    const now = Date.now();
    d.executeSync(
      'INSERT INTO prompts (action_id, name, body, is_default, created_at) VALUES (?, ?, ?, 0, ?)',
      [PROMPT_ACTION_DAILY_SUMMARY, 'Claude daily summary', CLAUDE_DAILY_SUMMARY_PROMPT_BODY, now],
    );
    d.executeSync(
      'INSERT INTO prompts (action_id, name, body, is_default, created_at) VALUES (?, ?, ?, 0, ?)',
      [PROMPT_ACTION_DAILY_SUMMARY, 'Codex daily summary', CODEX_DAILY_SUMMARY_PROMPT_BODY, now + 1],
    );
    setVersion(d, 6);
  }

  // Migration 6->7: saved end-of-day AI summaries by local date
  if (current < 7) {
    d.executeSync(`
      CREATE TABLE IF NOT EXISTS daily_summaries (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        date         TEXT    NOT NULL UNIQUE,
        summary_json TEXT    NOT NULL,
        generated_at INTEGER NOT NULL
      )
    `);
    setVersion(d, 7);
  }

  // Migration 7->8: rename prompt labels; add Claude goal contribution prompt; remove default daily summary prompt
  if (current < 8) {
    const now = Date.now();
    // Rename the original goal contribution prompt to "Codex prompt"
    d.executeSync(
      "UPDATE prompts SET name = 'Codex prompt' WHERE action_id = ? AND name = 'Default goal contribution prompt'",
      [PROMPT_ACTION_GOAL_CONTRIBUTION],
    );
    // Add Claude's goal contribution prompt as default for action 1
    d.executeSync('UPDATE prompts SET is_default = 0 WHERE action_id = ?', [PROMPT_ACTION_GOAL_CONTRIBUTION]);
    d.executeSync(
      'INSERT INTO prompts (action_id, name, body, is_default, created_at) VALUES (?, ?, ?, 1, ?)',
      [PROMPT_ACTION_GOAL_CONTRIBUTION, 'Claude prompt', CLAUDE_GOAL_CONTRIBUTION_PROMPT_BODY, now],
    );
    // Remove the original default daily summary prompt; make Claude daily summary the default
    d.executeSync(
      "DELETE FROM prompts WHERE action_id = ? AND name = 'Default daily summary prompt'",
      [PROMPT_ACTION_DAILY_SUMMARY],
    );
    d.executeSync('UPDATE prompts SET is_default = 0 WHERE action_id = ?', [PROMPT_ACTION_DAILY_SUMMARY]);
    d.executeSync(
      "UPDATE prompts SET is_default = 1 WHERE action_id = ? AND name = 'Claude daily summary'",
      [PROMPT_ACTION_DAILY_SUMMARY],
    );
    setVersion(d, 8);
  }
}

function seedDefaultPrompts(d: DB): void {
  seedPromptForAction(
    d,
    PROMPT_ACTION_GOAL_CONTRIBUTION,
    'Default goal contribution prompt',
    DEFAULT_GOAL_CONTRIBUTION_PROMPT_BODY,
  );
  seedPromptForAction(
    d,
    PROMPT_ACTION_DAILY_SUMMARY,
    'Default daily summary prompt',
    DEFAULT_DAILY_SUMMARY_PROMPT_BODY,
  );
}

function seedPromptForAction(d: DB, actionId: number, name: string, body: string): void {
  const existing = d.executeSync('SELECT COUNT(*) as cnt FROM prompts WHERE action_id = ?', [actionId]);
  const count = ((existing.rows?.[0] as any)?.cnt as number) ?? 0;
  if (count > 0) return;

  d.executeSync(
    'INSERT INTO prompts (action_id, name, body, is_default, created_at) VALUES (?, ?, ?, 1, ?)',
    [actionId, name, body, Date.now()],
  );
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
      "SELECT * FROM plan_blocks WHERE plan_id = ? AND source = 'app' AND status = 1 ORDER BY start_min ASC",
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
      WHERE pb.source = 'app' AND pb.status = 1 AND (pb.synced_at IS NULL OR pb.updated_at > pb.synced_at)
    `);
    return (result.rows ?? []).map(rowToPlanBlockWithDate);
  },

  async getPendingDeletePlanBlocksWithDate() {
    const result = getDb().executeSync(`
      SELECT pb.*, dp.date
      FROM plan_blocks pb
      JOIN day_plans dp ON pb.plan_id = dp.id
      WHERE pb.source = 'app' AND pb.status = 0
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
    getDb().executeSync("UPDATE log_entries SET synced_at = NULL WHERE status = 1 AND source = 'app'");
    getDb().executeSync("UPDATE plan_blocks SET synced_at = NULL WHERE status = 1 AND source = 'app'");
  },

  async getCalendarPlanBlocksByDate(dateStr) {
    const result = getDb().executeSync(`
      SELECT pb.* FROM plan_blocks pb
      JOIN day_plans dp ON pb.plan_id = dp.id
      WHERE dp.date = ? AND pb.source = 'calendar' AND pb.status = 1
      ORDER BY pb.start_min ASC
    `, [dateStr]);
    return (result.rows ?? []).map(rowToPlanBlock);
  },

  async upsertCalendarPlanBlock(dateStr, calendarEventId, startMin, endMin, activity) {
    const db = getDb();
    const now = Date.now();
    // Ensure day_plan row exists (include created_at — required NOT NULL column)
    db.executeSync(
      'INSERT OR IGNORE INTO day_plans (date, created_at) VALUES (?, ?)',
      [dateStr, now],
    );
    const planRow = db.executeSync('SELECT id FROM day_plans WHERE date = ?', [dateStr]);
    const planId = (planRow.rows?.[0] as any)?.id as number;

    const existing = db.executeSync(
      'SELECT id FROM plan_blocks WHERE calendar_event_id = ?',
      [calendarEventId],
    );
    if ((existing.rows ?? []).length > 0) {
      // Update existing
      db.executeSync(
        'UPDATE plan_blocks SET start_min = ?, end_min = ?, activity = ?, status = 1, synced_at = ? WHERE calendar_event_id = ?',
        [startMin, endMin, activity, now, calendarEventId],
      );
    } else {
      // Insert new
      db.executeSync(
        "INSERT INTO plan_blocks (plan_id, start_min, end_min, activity, calendar_event_id, source, status, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, 'calendar', 1, ?, ?)",
        [planId, startMin, endMin, activity, calendarEventId, now, now],
      );
    }
  },

  async entryExistsByCalendarId(calendarEventId) {
    const r = getDb().executeSync(
      'SELECT 1 FROM log_entries WHERE calendar_event_id = ? AND status = 1 LIMIT 1',
      [calendarEventId],
    );
    return (r.rows ?? []).length > 0;
  },

  async planBlockExistsByCalendarId(calendarEventId) {
    const r = getDb().executeSync(
      'SELECT 1 FROM plan_blocks WHERE calendar_event_id = ? AND status = 1 LIMIT 1',
      [calendarEventId],
    );
    return (r.rows ?? []).length > 0;
  },

  async restoreEntryFromCalendar({ timestampStart, timestampEnd, transcript, calendarEventId }) {
    const now = Date.now();
    getDb().executeSync(
      `INSERT INTO log_entries
       (timestamp_start, timestamp_end, transcript, calendar_event_id, source, status, updated_at, synced_at)
       VALUES (?, ?, ?, ?, 'app', 1, ?, ?)`,
      [timestampStart, timestampEnd, transcript, calendarEventId, now, now],
    );
  },

  async restorePlanBlockFromCalendar(dateStr, calendarEventId, startMin, endMin, activity) {
    const database = getDb();
    const now = Date.now();
    database.executeSync(
      'INSERT OR IGNORE INTO day_plans (date, created_at) VALUES (?, ?)',
      [dateStr, now],
    );
    const planRow = database.executeSync('SELECT id FROM day_plans WHERE date = ?', [dateStr]);
    const planId = (planRow.rows?.[0] as any)?.id as number;
    database.executeSync(
      `INSERT INTO plan_blocks
       (plan_id, start_min, end_min, activity, calendar_event_id, source, status, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, 'app', 1, ?, ?)`,
      [planId, startMin, endMin, activity, calendarEventId, now, now],
    );
  },

  async getEntryCount() {
    const r = getDb().executeSync('SELECT COUNT(*) as cnt FROM log_entries WHERE status = 1');
    return ((r.rows?.[0] as any)?.cnt as number) ?? 0;
  },

  async softDeleteCalendarBlocksNotIn(dateStr, calendarEventIds) {
    const planRow = getDb().executeSync('SELECT id FROM day_plans WHERE date = ?', [dateStr]);
    const planId = (planRow.rows?.[0] as any)?.id as number | undefined;
    if (!planId) return;

    if (calendarEventIds.length === 0) {
      // Delete all calendar blocks for this day
      getDb().executeSync(
        "UPDATE plan_blocks SET status = 0 WHERE plan_id = ? AND source = 'calendar' AND status = 1",
        [planId],
      );
    } else {
      const placeholders = calendarEventIds.map(() => '?').join(', ');
      getDb().executeSync(
        `UPDATE plan_blocks SET status = 0 WHERE plan_id = ? AND source = 'calendar' AND status = 1 AND calendar_event_id NOT IN (${placeholders})`,
        [planId, ...calendarEventIds],
      );
    }
  },
};

export default SQLiteStorageProvider;
