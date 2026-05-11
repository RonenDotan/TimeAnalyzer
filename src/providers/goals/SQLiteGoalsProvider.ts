import { Goal, GoalContribution, GoalEntryContribution, GoalStatus } from '../../types/Goal';
import { GoalsProvider } from './GoalsProvider';
import { getDb } from '../storage/SQLiteStorageProvider';

// Uses the shared DB connection from SQLiteStorageProvider (same file, same instance)

function rowToGoal(row: Record<string, unknown>): Goal {
  return {
    id:        row.id as number,
    text:      row.text as string,
    startAt:   row.start_at as number,
    targetAt:  (row.target_at as number | null) ?? null,
    progress:  row.progress as number,
    status:    (row.status as GoalStatus) ?? 'active',
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

function rowToContribution(row: Record<string, unknown>): GoalContribution {
  return {
    id:              row.id as number,
    goalId:          row.goal_id as number,
    entryId:         (row.entry_id as number | null) ?? null,
    contributionPct: row.contribution_pct as number,
    createdAt:       row.created_at as number,
  };
}

const SQLiteGoalsProvider: GoalsProvider = {
  async getActiveGoals(asOf) {
    const result = getDb().executeSync(
      `SELECT * FROM goals
       WHERE status = 'active'
         AND start_at <= ?
       ORDER BY created_at ASC`,
      [asOf],
    );
    return (result.rows ?? []).map(rowToGoal);
  },

  async getAllGoals() {
    const result = getDb().executeSync(
      'SELECT * FROM goals ORDER BY created_at DESC',
    );
    return (result.rows ?? []).map(rowToGoal);
  },

  async saveGoal(goal) {
    const now = Date.now();
    const result = getDb().executeSync(
      `INSERT INTO goals (text, start_at, target_at, progress, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [goal.text, goal.startAt, goal.targetAt ?? null, goal.progress, goal.status, goal.createdAt ?? now, now],
    );
    return { ...goal, id: result.insertId as number, createdAt: goal.createdAt ?? now, updatedAt: now };
  },

  async updateGoal(goal) {
    const now = Date.now();
    getDb().executeSync(
      `UPDATE goals SET text = ?, start_at = ?, target_at = ?, progress = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [goal.text, goal.startAt, goal.targetAt ?? null, goal.progress, goal.status, now, goal.id],
    );
  },

  async deleteGoal(id) {
    getDb().executeSync('DELETE FROM goal_contributions WHERE goal_id = ?', [id]);
    getDb().executeSync('DELETE FROM goals WHERE id = ?', [id]);
  },

  async addContribution(contribution) {
    const now = Date.now();
    const result = getDb().executeSync(
      `INSERT INTO goal_contributions (goal_id, entry_id, contribution_pct, created_at)
       VALUES (?, ?, ?, ?)`,
      [contribution.goalId, contribution.entryId ?? null, contribution.contributionPct, now],
    );
    return { ...contribution, id: result.insertId as number, createdAt: now };
  },

  async getContributions(goalId) {
    const result = getDb().executeSync(
      'SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY created_at DESC',
      [goalId],
    );
    return (result.rows ?? []).map(rowToContribution);
  },

  async getContributionsByEntryId(entryId) {
    const result = getDb().executeSync(
      `SELECT gc.goal_id, g.text AS goal_text, gc.contribution_pct
       FROM goal_contributions gc
       JOIN goals g ON g.id = gc.goal_id
       WHERE gc.entry_id = ?
       ORDER BY gc.created_at ASC`,
      [entryId],
    );
    return (result.rows ?? []).map(row => ({
      goalId:         row.goal_id as number,
      goalText:       row.goal_text as string,
      contributionPct: row.contribution_pct as number,
    })) as GoalEntryContribution[];
  },
};

export default SQLiteGoalsProvider;
