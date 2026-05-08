import { Goal } from '../../types/Goal';
import { GoalsProvider } from './GoalsProvider';

/**
 * Google Tasks implementation of GoalsProvider.
 *
 * STUB — not implemented yet. See issue #25.
 *
 * When implementing:
 *   1. Add 'https://www.googleapis.com/auth/tasks' OAuth scope to CalendarSyncService
 *   2. Create a TimeAnalyzer task list on first run (Tasks API: POST /lists)
 *   3. Map Goal ↔ Google Task:
 *        goal.text      ↔ task.title
 *        goal.done      ↔ task.status ('completed' | 'needsAction')
 *        goal.date      ↔ task.due (RFC 3339)
 *        goal.taskId    ↔ task.id
 *        goal.listId    ↔ the TimeAnalyzer list id
 *   4. Sync strategy: local-first. Push on save/update/delete. Pull on app open.
 *   5. On reinstall: pull all tasks from the TimeAnalyzer list and seed SQLite.
 *
 * API reference: https://developers.google.com/tasks/reference/rest
 */
const GoogleTasksGoalsProvider: GoalsProvider = {
  async getGoals(_date: string): Promise<Goal[]> {
    // TODO (issue #25): GET /lists/{listId}/tasks?dueMin=...&dueMax=...
    throw new Error('GoogleTasksGoalsProvider.getGoals not implemented — see issue #25');
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

  async reorderGoals(_date: string, _orderedIds: number[]): Promise<void> {
    // TODO (issue #25): POST /lists/{listId}/tasks/{taskId}/move for each id
    throw new Error('GoogleTasksGoalsProvider.reorderGoals not implemented — see issue #25');
  },
};

export default GoogleTasksGoalsProvider;
