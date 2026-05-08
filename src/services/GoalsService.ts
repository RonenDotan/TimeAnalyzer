import { Goal } from '../types/Goal';
import { GoalsProvider } from '../providers/goals/GoalsProvider';
import SQLiteGoalsProvider from '../providers/goals/SQLiteGoalsProvider';

let activeProvider: GoalsProvider = SQLiteGoalsProvider;

function setProvider(provider: GoalsProvider): void {
  activeProvider = provider;
}

async function getGoals(date: string): Promise<Goal[]> {
  return activeProvider.getGoals(date);
}

async function saveGoal(goal: Omit<Goal, 'id'>): Promise<Goal> {
  return activeProvider.saveGoal(goal);
}

async function updateGoal(goal: Goal): Promise<void> {
  return activeProvider.updateGoal(goal);
}

async function deleteGoal(id: number): Promise<void> {
  return activeProvider.deleteGoal(id);
}

async function reorderGoals(date: string, orderedIds: number[]): Promise<void> {
  return activeProvider.reorderGoals(date, orderedIds);
}

/** Toggle a goal's done state and persist. Returns the updated goal. */
async function toggleGoal(goal: Goal): Promise<Goal> {
  const updated = { ...goal, done: !goal.done, updatedAt: Date.now() };
  await activeProvider.updateGoal(updated);
  return updated;
}

const GoalsService = {
  setProvider,
  getGoals,
  saveGoal,
  updateGoal,
  deleteGoal,
  reorderGoals,
  toggleGoal,
};

export default GoalsService;
