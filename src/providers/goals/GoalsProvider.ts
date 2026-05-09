import { Goal, GoalContribution, GoalEntryContribution } from '../../types/Goal';

/**
 * Interface for all goal persistence operations.
 *
 * Two implementations:
 *   SQLiteGoalsProvider      — active, on-device storage
 *   GoogleTasksGoalsProvider — stub, ready for issue #25
 */
export interface GoalsProvider {
  /** All goals where start_at <= asOf <= target_at (or no target), status = 'active'. */
  getActiveGoals(asOf: number): Promise<Goal[]>;

  /** All goals regardless of status or date range. */
  getAllGoals(): Promise<Goal[]>;

  /** Persist a new goal. Returns saved goal with generated id. */
  saveGoal(goal: Omit<Goal, 'id'>): Promise<Goal>;

  /** Update an existing goal. */
  updateGoal(goal: Goal): Promise<void>;

  /** Permanently delete a goal and its contributions. */
  deleteGoal(id: number): Promise<void>;

  /** Record a contribution (session delta) for a goal. */
  addContribution(contribution: Omit<GoalContribution, 'id'>): Promise<GoalContribution>;

  /** All contributions for a goal, newest first. */
  getContributions(goalId: number): Promise<GoalContribution[]>;

  /** All contributions for a specific entry, with goal text joined in. */
  getContributionsByEntryId(entryId: number): Promise<GoalEntryContribution[]>;
}
