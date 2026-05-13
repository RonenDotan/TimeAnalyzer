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

async function updateContributionReason(id: number, reason: string | null): Promise<void> {
  return activeProvider.updateContributionReason(id, reason);
}

/**
 * Apply a session contribution to a goal:
 * - Adds contributionPct to goal.progress (capped at 99)
 * - Keeps status unchanged so automatic contributions never close a goal
 * - Saves a goal_contributions record linked to the entry
 * - Returns the updated goal
 */
async function applyContribution(
  goal: Goal,
  contributionPct: number,
  entryId: number | null,
  reason?: string | null,
): Promise<Goal> {
  const newProgress = Math.min(99, goal.progress + contributionPct);
  const appliedContributionPct = newProgress - goal.progress;
  const updated: Goal = { ...goal, progress: newProgress, updatedAt: Date.now() };
  await activeProvider.updateGoal(updated);
  if (appliedContributionPct !== 0) {
    await activeProvider.addContribution({
      goalId: goal.id,
      entryId,
      contributionPct: appliedContributionPct,
      reason: reason?.trim() || null,
      createdAt: Date.now(),
    });
  }
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
      reason: null,
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
  updateContributionReason,
  applyContribution,
  setProgress,
};

export default GoalsService;
