import { Goal } from '../../types/Goal';

/**
 * Interface for all goal persistence operations.
 *
 * Two implementations exist:
 *   SQLiteGoalsProvider      — active, on-device storage
 *   GoogleTasksGoalsProvider — stub, ready for issue #25
 */
export interface GoalsProvider {
  /** Return all goals for a date, ordered by sortOrder ASC. */
  getGoals(date: string): Promise<Goal[]>;

  /** Persist a new goal. Returns the saved goal with its generated id. */
  saveGoal(goal: Omit<Goal, 'id'>): Promise<Goal>;

  /** Update an existing goal (text, done, sortOrder, updatedAt). */
  updateGoal(goal: Goal): Promise<void>;

  /** Permanently delete a goal by id. */
  deleteGoal(id: number): Promise<void>;

  /** Update sortOrder for all goals on a day. orderedIds = ids in new order. */
  reorderGoals(date: string, orderedIds: number[]): Promise<void>;
}
