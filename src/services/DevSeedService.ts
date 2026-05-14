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

const PLAN_BLOCKS_HE = [
  { startMin: minutes(9), endMin: minutes(9, 30), activity: 'סטנדאפ, מיון דואר נכנס ותכנון יומי' },
  { startMin: minutes(9, 30), endMin: minutes(11, 30), activity: 'השלמת מודול האימות' },
  { startMin: minutes(11, 30), endMin: minutes(12, 15), activity: 'סקירת בקשות משיכה' },
  { startMin: minutes(13), endMin: minutes(15), activity: 'כתיבת בדיקות יחידה לנקודות קצה של ה-API' },
  { startMin: minutes(15), endMin: minutes(16, 30), activity: 'דיבוג מקרי קצה של OAuth ועדכון תיעוד' },
  { startMin: minutes(16, 30), endMin: minutes(17), activity: 'סיכום יומי והעברת משמרת' },
];

async function seedDayPlans(today: Date, hebrew = false): Promise<void> {
  const plan = await StorageService.upsertDayPlan(dateToStr(today));
  await StorageService.upsertPlanBlocks(plan.id, hebrew ? PLAN_BLOCKS_HE : PLAN_BLOCKS, []);
}

const GOALS_TEXT = {
  en: [
    { text: 'Complete authentication module',      targetDays: 2, progress: 62 },
    { text: 'Write unit tests for API endpoints',  targetDays: 1, progress: 35 },
    { text: 'Review pull requests',                targetDays: 0, progress: 20 },
    { text: 'Document OAuth error handling',       targetDays: 3, progress: 15 },
  ],
  he: [
    { text: 'השלמת מודול האימות',                  targetDays: 2, progress: 62 },
    { text: 'כתיבת בדיקות יחידה לנקודות קצה API', targetDays: 1, progress: 35 },
    { text: 'סקירת בקשות משיכה',                  targetDays: 0, progress: 20 },
    { text: 'תיעוד טיפול בשגיאות OAuth',           targetDays: 3, progress: 15 },
  ],
};

async function seedGoals(today: Date, hebrew = false): Promise<Goal[]> {
  const now = Date.now();
  const source = hebrew ? GOALS_TEXT.he : GOALS_TEXT.en;
  const goals = source.map(g => ({
    text: g.text,
    startAt: atTime(today, 9),
    targetAt: atTime(addDays(today, g.targetDays), 17),
    progress: g.progress,
  }));

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

const ENTRIES_DATA = {
  en: [
    {
      startHour: 9, startMinute: 0, endHour: 9, endMinute: 35,
      transcript: 'Started with standup, reviewed the overnight CI failure, and mapped out the auth module work. Decided to finish refresh token handling first, then move into API tests after lunch.',
      contributions: [
        { goalIndex: 0, pct: 5, reason: 'Scoped the remaining authentication work.' },
        { goalIndex: 2, pct: 5, reason: 'Reviewed CI and pull request status during planning.' },
      ],
    },
    {
      startHour: 9, startMinute: 35, endHour: 11, endMinute: 30,
      transcript: 'Implemented the refresh token path and cleaned up the auth service boundaries. The happy path is working now, and expired session handling is covered manually.',
      contributions: [{ goalIndex: 0, pct: 18, reason: 'Implemented refresh token behavior and service cleanup.' }],
    },
    {
      startHour: 11, startMinute: 30, endHour: 12, endMinute: 15,
      transcript: 'Reviewed Maya\'s billing API pull request and left comments on retry behavior and naming. Approved the small logging fix after checking the test output.',
      contributions: [{ goalIndex: 2, pct: 25, reason: 'Reviewed billing API and logging pull requests.' }],
    },
    {
      startHour: 13, startMinute: 0, endHour: 15, endMinute: 5,
      transcript: 'Added API unit tests for login, refresh, and unauthorized responses. Had to adjust the fetch mocks so the retry path is deterministic, but the important cases are covered.',
      contributions: [{ goalIndex: 1, pct: 28, reason: 'Added login, refresh, and unauthorized API tests.' }],
    },
    {
      startHour: 15, startMinute: 5, endHour: 16, endMinute: 45,
      transcript: 'Debugged the OAuth error mapping and wrote down the cases for invalid grants, network timeouts, and missing scopes. The UI copy still needs one pass tomorrow.',
      contributions: [
        { goalIndex: 0, pct: 8, reason: 'Debugged OAuth error handling.' },
        { goalIndex: 3, pct: 30, reason: 'Documented OAuth error cases.' },
      ],
    },
  ],
  he: [
    {
      startHour: 9, startMinute: 0, endHour: 9, endMinute: 35,
      transcript: 'התחלתי עם סטנדאפ, סקרתי את כשל ה-CI שקרה בלילה ותיכננתי את עבודת מודול האימות. החלטתי לסיים קודם את טיפול ב-refresh token ואז לעבור לבדיקות API אחרי הצהריים.',
      contributions: [
        { goalIndex: 0, pct: 5, reason: 'תחמתי את עבודת האימות שנותרה.' },
        { goalIndex: 2, pct: 5, reason: 'סקרתי סטטוס CI ובקשות משיכה בזמן התכנון.' },
      ],
    },
    {
      startHour: 9, startMinute: 35, endHour: 11, endMinute: 30,
      transcript: 'מימשתי את נתיב ה-refresh token וניקיתי את גבולות שירות האימות. הנתיב הרגיל עובד עכשיו, וטיפול בסשן פג תוקף מכוסה ידנית.',
      contributions: [{ goalIndex: 0, pct: 18, reason: 'מימשתי התנהגות refresh token וניקוי שירות.' }],
    },
    {
      startHour: 11, startMinute: 30, endHour: 12, endMinute: 15,
      transcript: 'סקרתי את בקשת המשיכה של Maya עבור ה-billing API והשארתי הערות על התנהגות ניסיונות חוזרים ומתן שמות. אישרתי את תיקון הלוגינג הקטן אחרי בדיקת פלט הבדיקות.',
      contributions: [{ goalIndex: 2, pct: 25, reason: 'סקרתי בקשות משיכה של billing API ולוגינג.' }],
    },
    {
      startHour: 13, startMinute: 0, endHour: 15, endMinute: 5,
      transcript: 'הוספתי בדיקות יחידה ל-API עבור כניסה, ריענון ותגובות לא מורשות. נאלצתי להתאים את ה-fetch mocks כדי שנתיב הניסיון החוזר יהיה דטרמיניסטי, אבל המקרים החשובים מכוסים.',
      contributions: [{ goalIndex: 1, pct: 28, reason: 'הוספתי בדיקות API לכניסה, ריענון ולא מורשה.' }],
    },
    {
      startHour: 15, startMinute: 5, endHour: 16, endMinute: 45,
      transcript: 'דיבגתי את מיפוי שגיאות OAuth ורשמתי את המקרים עבור הענקות לא תקפות, תפוגות זמן רשת ופעולות חסרות. עותק ה-UI עוד צריך סבב אחד מחר.',
      contributions: [
        { goalIndex: 0, pct: 8, reason: 'דיבגתי טיפול בשגיאות OAuth.' },
        { goalIndex: 3, pct: 30, reason: 'תיעדתי מקרי שגיאות OAuth.' },
      ],
    },
  ],
};

async function seedEntriesAndContributions(today: Date, goals: Goal[], hebrew = false): Promise<void> {
  const entries = hebrew ? ENTRIES_DATA.he : ENTRIES_DATA.en;

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

async function seedDailySummary(today: Date, hebrew = false): Promise<void> {
  const text = hebrew
    ? 'היום התמקד בקידום האימות לקראת שחרור. נתיב ה-refresh token עובד, כיסוי ה-API השתפר סביב כניסה ותגובות לא מורשות, וסקירת בקשת המשיכה פינתה תיקון לוגינג קטן. הפער העיקרי שנותר הוא סבב אחרון על עותק שגיאות OAuth ותיעוד לפני שהמודול מוכן למיזוג.'
    : 'Today centered on getting authentication closer to shippable. The refresh token path is working, API coverage improved around login and unauthorized responses, and pull request review cleared a small logging fix. The main remaining gap is a final pass on OAuth error copy and documentation before the module is ready to merge.';
  await DailySummaryService.saveSummaryText(dateToStr(today), text);
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

async function seedSoftwareEngineerDemo(debugEnabled: boolean, hebrew = false): Promise<SeedResult> {
  if (!__DEV__ || !debugEnabled) {
    return { seeded: false, reason: 'Dev seeding requires __DEV__ and Debug mode.' };
  }

  const today = startOfDay(new Date());
  clearExistingData();
  await seedDayPlans(today, hebrew);
  const savedGoals = await seedGoals(today, hebrew);
  await seedEntriesAndContributions(today, savedGoals, hebrew);
  await seedDailySummary(today, hebrew);
  return { seeded: true };
}

const DevSeedService = {
  seedSoftwareEngineerDemo,
};

export default DevSeedService;
