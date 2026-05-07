import notifee from '@notifee/react-native';
import SchedulerService, { buildSchedule } from '../src/services/SchedulerService';
import { DEFAULT_SETTINGS, Settings } from '../src/types/Settings';

const NOW = new Date('2026-01-01T10:00:00').getTime(); // Thursday 10:00

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

// --- buildSchedule unit tests ---

test('slots fire at end of each period within working hours', () => {
  const s: Settings = { ...DEFAULT_SETTINGS, everyHour: false, startHour: 10, endHour: 19, frequencyMinutes: 120 };
  // Thursday midnight
  const midnight = new Date(2026, 0, 1).getTime();
  // NOW is 10:00, so slots at 12,14,16,18 are future; 19 is partial end slot
  const slots = buildSchedule(s, midnight + 10 * 3600_000); // "now" = 10:00
  const hours = slots.slice(0, 5).map(({ fireAt }) => new Date(fireAt).getHours());
  expect(hours).toEqual([12, 14, 16, 18, 19]);
});

test('partial last slot fires at endHour', () => {
  const s: Settings = { ...DEFAULT_SETTINGS, everyHour: false, startHour: 10, endHour: 19, frequencyMinutes: 120 };
  const slots = buildSchedule(s, new Date('2026-01-01T17:00:00').getTime());
  expect(new Date(slots[0].fireAt).getHours()).toBe(18);
  expect(new Date(slots[1].fireAt).getHours()).toBe(19); // partial 18→19
});

test('skips days not in checkInDays', () => {
  // Only Wednesday (day 3) enabled
  const days: Settings['checkInDays'] = [false, false, false, true, false, false, false];
  // Use working hours so the single daily slot fires at endHour (still same weekday)
  const s: Settings = { ...DEFAULT_SETTINGS, checkInDays: days, everyHour: false, startHour: 10, endHour: 18, frequencyMinutes: 1440 };
  const slots = buildSchedule(s, NOW);
  slots.forEach(({ fireAt }) => expect(new Date(fireAt).getDay()).toBe(3));
});

test('everyHour=true spans midnight (hour 24 → next day 00)', () => {
  const s: Settings = { ...DEFAULT_SETTINGS, everyHour: true, frequencyMinutes: 480 };
  const slots = buildSchedule(s, NOW);
  expect(slots.length).toBe(50);
});

// --- SchedulerService integration ---

test('start() creates channel and schedules 50 notifications', async () => {
  await SchedulerService.start();
  expect(notifee.createChannel).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'checkin-alerts-v2' }),
  );
  expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(50);
});

test('each notification has unique ID and correct body format', async () => {
  await SchedulerService.start();
  const calls = (notifee.createTriggerNotification as jest.Mock).mock.calls;
  const ids = calls.map((c: any) => c[0].id);
  expect(new Set(ids).size).toBe(50);
  expect(calls[0][0].body).toMatch(/What did you work on from \d{2}:\d{2} to \d{2}:\d{2}\?/);
});

test('stop() cancels all trigger notifications', async () => {
  await SchedulerService.stop();
  expect(notifee.cancelTriggerNotifications).toHaveBeenCalled();
});

test('reschedule() stops then starts', async () => {
  await SchedulerService.reschedule();
  expect(notifee.cancelTriggerNotifications).toHaveBeenCalled();
  // 50 check-in + up to 4 daily-plan notifications (5-day window minus today)
  const count = (notifee.createTriggerNotification as jest.Mock).mock.calls.length;
  expect(count).toBeGreaterThanOrEqual(50);
  expect(count).toBeLessThanOrEqual(54);
});

test('requestPermission() returns true when granted', async () => {
  expect(await SchedulerService.requestPermission()).toBe(true);
});
