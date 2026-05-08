import { open } from '@op-engineering/op-sqlite';
import { Goal } from '../../types/Goal';
import { GoalsProvider } from './GoalsProvider';

type DB = ReturnType<typeof open>;
let db: DB | null = null;

function getDb(): DB {
  if (!db) {
    db = open({ name: 'time-analyzer.sqlite' });
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS goals (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        date        TEXT    NOT NULL,
        text        TEXT    NOT NULL,
        done        INTEGER NOT NULL DEFAULT 0,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL DEFAULT 0
      )
    `);
    db.executeSync(`
      CREATE INDEX IF NOT EXISTS idx_goals_date ON goals (date)
    `);
  }
  return db;
}

function rowToGoal(row: Record<string, unknown>): Goal {
  return {
    id:        row.id as number,
    date:      row.date as string,
    text:      row.text as string,
    done:      (row.done as number) === 1,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

const SQLiteGoalsProvider: GoalsProvider = {
  async getGoals(date) {
    const result = getDb().executeSync(
      'SELECT * FROM goals WHERE date = ? ORDER BY sort_order ASC, id ASC',
      [date],
    );
    return (result.rows ?? []).map(rowToGoal);
  },

  async saveGoal(goal) {
    const now = Date.now();
    const result = getDb().executeSync(
      'INSERT INTO goals (date, text, done, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [goal.date, goal.text, goal.done ? 1 : 0, goal.sortOrder, goal.createdAt ?? now, now],
    );
    return { ...goal, id: result.insertId as number, createdAt: goal.createdAt ?? now, updatedAt: now };
  },

  async updateGoal(goal) {
    const now = Date.now();
    getDb().executeSync(
      'UPDATE goals SET text = ?, done = ?, sort_order = ?, updated_at = ? WHERE id = ?',
      [goal.text, goal.done ? 1 : 0, goal.sortOrder, now, goal.id],
    );
  },

  async deleteGoal(id) {
    getDb().executeSync('DELETE FROM goals WHERE id = ?', [id]);
  },

  async reorderGoals(_date, orderedIds) {
    orderedIds.forEach((id, index) => {
      getDb().executeSync(
        'UPDATE goals SET sort_order = ? WHERE id = ?',
        [index, id],
      );
    });
  },
};

export default SQLiteGoalsProvider;
