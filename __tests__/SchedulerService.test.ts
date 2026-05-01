import notifee from '@notifee/react-native';
import SchedulerService from '../src/services/SchedulerService';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-01-01T10:00:00'));
});

afterEach(() => {
  jest.useRealTimers();
});

test('start() creates a channel and schedules 50 notifications', async () => {
  await SchedulerService.start();
  expect(notifee.createChannel).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'checkin-reminders' }),
  );
  expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(50);
});

test('each notification has a unique ID and correct time label', async () => {
  await SchedulerService.start();
  const calls = (notifee.createTriggerNotification as jest.Mock).mock.calls;
  const ids = calls.map((c: any) => c[0].id);
  const uniqueIds = new Set(ids);
  expect(uniqueIds.size).toBe(50);
  expect(calls[0][0].body).toMatch(/What did you work on from \d{2}:\d{2} to \d{2}:\d{2}\?/);
});

test('stop() cancels all trigger notifications', async () => {
  await SchedulerService.stop();
  expect(notifee.cancelTriggerNotifications).toHaveBeenCalled();
});

test('reschedule() stops then starts', async () => {
  await SchedulerService.reschedule();
  expect(notifee.cancelTriggerNotifications).toHaveBeenCalled();
  expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(50);
});

test('requestPermission() returns true when granted', async () => {
  const result = await SchedulerService.requestPermission();
  expect(result).toBe(true);
});
