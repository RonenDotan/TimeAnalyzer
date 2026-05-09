import { Goal, GoalContribution, GoalEntryContribution } from '../../types/Goal';
import { GoalsProvider } from './GoalsProvider';

/**
 * Google Tasks implementation of GoalsProvider.
 *
 * STUB — not implemented. See issue #25.
 *
 * When implementing:
 *   1. Add 'https://www.googleapis.com/auth/tasks' OAuth scope to CalendarSyncService
 *   2. Create a TimeAnalyzer task list on first run (Tasks API: POST /lists)
 *   3. Map Goal ↔ Google Task:
 *        goal.text      ↔ task.title
 *        goal.progress  ↔ task.notes (serialised, no native % field)
 *        goal.status    ↔ task.status ('completed' | 'needsAction')
 *        goal.targetAt  ↔ task.due (RFC 3339)
 *        goal.startAt   ↔ task.notes (serialised)
 *   4. goal_contributions have no native Tasks equivalent — store in task.notes as JSON
 *   5. Sync: local-first. Push on save/update/delete. Pull on app open.
 *
 * API reference: https://developers.google.com/tasks/reference/rest
 */
const GoogleTasksGoalsProvider: GoalsProvider = {
  async getActiveGoals(_asOf: number): Promise<Goal[]> {
    // TODO (issue #25): GET /lists/{listId}/tasks?showCompleted=false
    throw new Error('GoogleTasksGoalsProvider.getActiveGoals not implemented — see issue #25');
  },

  async getAllGoals(): Promise<Goal[]> {
    // TODO (issue #25): GET /lists/{listId}/tasks?showCompleted=true&showHidden=true
    throw new Error('GoogleTasksGoalsProvider.getAllGoals not implemented — see issue #25');
  },

  async saveGoal(_goal: Omit<Goal, 'id'>): Promise<Goal> {
    // TODO (issue #25): POST /lists/{listId}/tasks
    throw new Error('GoogleTasksGoalsProvider.saveGoal not implemented — see issue #25');
  },

  async updateGoal(_goal: Goal): Promise<void> {
    // TODO (issue #25): PATCH /lists/{listId}/tasks/{taskId}
    throw new Error('GoogleTasksGoalsProvider.updateGoal not implemented — see issue #25');
  },

  async deleteGoal(_id: number): Promise<void> {
    // TODO (issue #25): DELETE /lists/{listId}/tasks/{taskId}
    throw new Error('GoogleTasksGoalsProvider.deleteGoal not implemented — see issue #25');
  },

  async addContribution(_contribution: Omit<GoalContribution, 'id'>): Promise<GoalContribution> {
    // TODO (issue #25): store in task.notes as serialised JSON
    throw new Error('GoogleTasksGoalsProvider.addContribution not implemented — see issue #25');
  },

  async getContributions(_goalId: number): Promise<GoalContribution[]> {
    // TODO (issue #25): parse contributions from task.notes JSON
    throw new Error('GoogleTasksGoalsProvider.getContributions not implemented — see issue #25');
  },

  async getContributionsByEntryId(_entryId: number): Promise<GoalEntryContribution[]> {
    // TODO (issue #25): parse contributions from task.notes JSON, join with goal text
    throw new Error('GoogleTasksGoalsProvider.getContributionsByEntryId not implemented — see issue #25');
  },
};

export default GoogleTasksGoalsProvider;
