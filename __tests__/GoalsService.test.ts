import GoalsService from '../src/services/GoalsService';
import { GoalsProvider } from '../src/providers/goals/GoalsProvider';
import { Goal } from '../src/types/Goal';

const baseGoal: Goal = {
  id: 1,
  text: 'Ship ticket 40',
  startAt: 1000,
  targetAt: 2000,
  progress: 90,
  status: 'active',
  createdAt: 1000,
  updatedAt: 1000,
};

const mockProvider: GoalsProvider = {
  getActiveGoals: jest.fn(),
  getAllGoals: jest.fn(),
  saveGoal: jest.fn(),
  updateGoal: jest.fn(),
  deleteGoal: jest.fn(),
  addContribution: jest.fn(),
  getContributions: jest.fn(),
  getContributionsByEntryId: jest.fn(),
  updateContributionReason: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  GoalsService.setProvider(mockProvider);
  (mockProvider.addContribution as jest.Mock).mockImplementation(async contribution => ({ id: 1, ...contribution }));
});

test('applyContribution caps automatic progress at 99 and keeps the goal active', async () => {
  const updated = await GoalsService.applyContribution(baseGoal, 20, 12, 'Strong progress');

  expect(updated.progress).toBe(99);
  expect(updated.status).toBe('active');
  expect(mockProvider.updateGoal).toHaveBeenCalledWith(expect.objectContaining({
    id: baseGoal.id,
    progress: 99,
    status: 'active',
  }));
  expect(mockProvider.addContribution).toHaveBeenCalledWith(expect.objectContaining({
    goalId: baseGoal.id,
    entryId: 12,
    contributionPct: 9,
    reason: 'Strong progress',
  }));
});

test('setProgress can manually complete a goal at 100', async () => {
  const updated = await GoalsService.setProgress(baseGoal, 100);

  expect(updated.progress).toBe(100);
  expect(updated.status).toBe('done');
  expect(mockProvider.updateGoal).toHaveBeenCalledWith(expect.objectContaining({
    id: baseGoal.id,
    progress: 100,
    status: 'done',
  }));
  expect(mockProvider.addContribution).toHaveBeenCalledWith(expect.objectContaining({
    goalId: baseGoal.id,
    entryId: null,
    contributionPct: 10,
  }));
});
