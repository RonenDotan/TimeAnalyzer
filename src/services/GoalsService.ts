import { Goal, GoalContribution, GoalEntryContribution } from '../types/Goal';
import { GoalsProvider } from '../providers/goals/GoalsProvider';
import SQLiteGoalsProvider from '../providers/goals/SQLiteGoalsProvider';

let activeProvider: GoalsProvider = SQLiteGoalsProvider;

function setProvider(provider: GoalsProvider): void {
  activeProvider = provider;
}

async function getActiveGoals(asOf: number): Promise<Goal[]> {
  return activeProvider.getActiveGoals(asOf);
}

async function getAllGoals(): Promise<Goal[]> {
  return activeProvider.getAllGoals();
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

async function getContributions(goalId: number): Promise<GoalContribution[]> {
  return activeProvider.getContributions(goalId);
}

async function getContributionsByEntryId(entryId: number): Promise<GoalEntryContribution[]> {
  return activeProvider.getContributionsByEntryId(entryId);
}

/**
 * Apply a session contribution to a goal:
 * - Adds contributionPct to goal.progress (capped at 100)
 * - Auto-sets status = 'done' if progress reaches 100
 * - Saves a goal_contributions record linked to the entry
 * - Returns the updated goal
 */
async function applyContribution(
  goal: Goal,
  contributionPct: number,
  entryId: number | null,
): Promise<Goal> {
  const newProgress = Math.min(100, goal.progress + contributionPct);
  const newStatus = newProgress >= 100 ? 'done' : goal.status;
  const updated: Goal = { ...goal, progress: newProgress, status: newStatus, updatedAt: Date.now() };
  await activeProvider.updateGoal(updated);
  await activeProvider.addContribution({
    goalId: goal.id,
    entryId,
    contributionPct,
    createdAt: Date.now(),
  });
  return updated;
}

/**
 * Manually set goal progress (not from a check-in).
 * entryId = null, records a manual contribution delta.
 */
async function setProgress(goal: Goal, newProgress: number): Promise<Goal> {
  const clamped = Math.max(0, Math.min(100, newProgress));
  const delta = clamped - goal.progress;
  const newStatus = clamped >= 100 ? 'done' : goal.status;
  const updated: Goal = { ...goal, progress: clamped, status: newStatus, updatedAt: Date.now() };
  await activeProvider.updateGoal(updated);
  if (delta !== 0) {
    await activeProvider.addContribution({
      goalId: goal.id,
      entryId: null,
      contributionPct: delta,
      createdAt: Date.now(),
    });
  }
  return updated;
}

const GoalsService = {
  setProvider,
  getActiveGoals,
  getAllGoals,
  saveGoal,
  updateGoal,
  deleteGoal,
  getContributions,
  getContributionsByEntryId,
  applyContribution,
  setProgress,
};

export default GoalsService;
