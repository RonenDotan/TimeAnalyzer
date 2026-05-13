import DailySummaryService from './DailySummaryService';
import GoalsService from './GoalsService';
import StorageService from './StorageService';
import { Goal } from '../types/Goal';
import { getDb } from '../providers/storage/SQLiteStorageProvider';

interface SeedResult {
  seeded: boolean;
  reason?: string;
}

function dateToStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function atTime(date: Date, hour: number, minute = 0): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
  return d.getTime();
}

function minutes(hour: number, minute = 0): number {
  return hour * 60 + minute;
}

const PLAN_BLOCKS = [
  { startMin: minutes(9), endMin: minutes(9, 30), activity: 'Standup, inbox triage, and daily plan' },
  { startMin: minutes(9, 30), endMin: minutes(11, 30), activity: 'Complete authentication module' },
  { startMin: minutes(11, 30), endMin: minutes(12, 15), activity: 'Review pull requests' },
  { startMin: minutes(13), endMin: minutes(15), activity: 'Write unit tests for API endpoints' },
  { startMin: minutes(15), endMin: minutes(16, 30), activity: 'Debug OAuth edge cases and update docs' },
  { startMin: minutes(16, 30), endMin: minutes(17), activity: 'Daily summary and handoff notes' },
];

async function seedDayPlans(today: Date): Promise<void> {
  const plan = await StorageService.upsertDayPlan(dateToStr(today));
  await StorageService.upsertPlanBlocks(plan.id, PLAN_BLOCKS, []);
}

async function seedGoals(today: Date): Promise<Goal[]> {
  const now = Date.now();
  const goals = [
    {
      text: 'Complete authentication module',
      startAt: atTime(today, 9),
      targetAt: atTime(addDays(today, 2), 17),
      progress: 62,
    },
    {
      text: 'Write unit tests for API endpoints',
      startAt: atTime(today, 9),
      targetAt: atTime(addDays(today, 1), 17),
      progress: 35,
    },
    {
      text: 'Review pull requests',
      startAt: atTime(today, 9),
      targetAt: atTime(today, 17),
      progress: 20,
    },
    {
      text: 'Document OAuth error handling',
      startAt: atTime(today, 9),
      targetAt: atTime(addDays(today, 3), 17),
      progress: 15,
    },
  ];

  const saved: Goal[] = [];
  for (const goal of goals) {
    saved.push(await GoalsService.saveGoal({
      ...goal,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }));
  }
  return saved;
}

async function seedEntriesAndContributions(today: Date, goals: Goal[]): Promise<void> {
  const entries = [
    {
      startHour: 9,
      startMinute: 0,
      endHour: 9,
      endMinute: 35,
      transcript: 'Started with standup, reviewed the overnight CI failure, and mapped out the auth module work. Decided to finish refresh token handling first, then move into API tests after lunch.',
      contributions: [
        { goalIndex: 0, pct: 5, reason: 'Scoped the remaining authentication work.' },
        { goalIndex: 2, pct: 5, reason: 'Reviewed CI and pull request status during planning.' },
      ],
    },
    {
      startHour: 9,
      startMinute: 35,
      endHour: 11,
      endMinute: 30,
      transcript: 'Implemented the refresh token path and cleaned up the auth service boundaries. The happy path is working now, and expired session handling is covered manually.',
      contributions: [{ goalIndex: 0, pct: 18, reason: 'Implemented refresh token behavior and service cleanup.' }],
    },
    {
      startHour: 11,
      startMinute: 30,
      endHour: 12,
      endMinute: 15,
      transcript: 'Reviewed Maya\'s billing API pull request and left comments on retry behavior and naming. Approved the small logging fix after checking the test output.',
      contributions: [{ goalIndex: 2, pct: 25, reason: 'Reviewed billing API and logging pull requests.' }],
    },
    {
      startHour: 13,
      startMinute: 0,
      endHour: 15,
      endMinute: 5,
      transcript: 'Added API unit tests for login, refresh, and unauthorized responses. Had to adjust the fetch mocks so the retry path is deterministic, but the important cases are covered.',
      contributions: [{ goalIndex: 1, pct: 28, reason: 'Added login, refresh, and unauthorized API tests.' }],
    },
    {
      startHour: 15,
      startMinute: 5,
      endHour: 16,
      endMinute: 45,
      transcript: 'Debugged the OAuth error mapping and wrote down the cases for invalid grants, network timeouts, and missing scopes. The UI copy still needs one pass tomorrow.',
      contributions: [
        { goalIndex: 0, pct: 8, reason: 'Debugged OAuth error handling.' },
        { goalIndex: 3, pct: 30, reason: 'Documented OAuth error cases.' },
      ],
    },
  ];

  const currentGoals = [...goals];
  for (const item of entries) {
    const entry = await StorageService.save({
      timestampStart: atTime(today, item.startHour, item.startMinute),
      timestampEnd: atTime(today, item.endHour, item.endMinute),
      transcript: item.transcript,
      calendarEventId: null,
      source: 'app',
    });
    for (const contribution of item.contributions) {
      const goal = currentGoals[contribution.goalIndex];
      currentGoals[contribution.goalIndex] = await GoalsService.applyContribution(
        goal,
        contribution.pct,
        entry.id,
        contribution.reason,
      );
    }
  }
}

async function seedDailySummary(today: Date): Promise<void> {
  await DailySummaryService.saveSummaryText(
    dateToStr(today),
    'Today centered on getting authentication closer to shippable. The refresh token path is working, API coverage improved around login and unauthorized responses, and pull request review cleared a small logging fix. The main remaining gap is a final pass on OAuth error copy and documentation before the module is ready to merge.',
  );
}

function clearExistingData(): void {
  const db = getDb();
  [
    'goal_contributions',
    'goals',
    'notes',
    'log_entries',
    'plan_blocks',
    'day_plans',
    'daily_summaries',
  ].forEach(table => db.executeSync(`DELETE FROM ${table}`));
  db.executeSync(
    "DELETE FROM sqlite_sequence WHERE name IN ('goal_contributions', 'goals', 'notes', 'log_entries', 'plan_blocks', 'day_plans', 'daily_summaries')",
  );
}

async function seedSoftwareEngineerDemo(debugEnabled: boolean): Promise<SeedResult> {
  if (!__DEV__ || !debugEnabled) {
    return { seeded: false, reason: 'Dev seeding requires __DEV__ and Debug mode.' };
  }

  const today = startOfDay(new Date());
  clearExistingData();
  await seedDayPlans(today);
  const savedGoals = await seedGoals(today);
  await seedEntriesAndContributions(today, savedGoals);
  await seedDailySummary(today);
  return { seeded: true };
}

const DevSeedService = {
  seedSoftwareEngineerDemo,
};

export default DevSeedService;
