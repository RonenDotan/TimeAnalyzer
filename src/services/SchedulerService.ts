import notifee, { AndroidImportance, AndroidNotificationSetting, AndroidVisibility, TriggerType } from '@notifee/react-native';
import config from '../config';
import SettingsService from './SettingsService';
import { Settings } from '../types/Settings';

const BATCH_SIZE = 50;

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function isAllowedDay(ts: number, checkInDays: Settings['checkInDays']): boolean {
  return checkInDays[new Date(ts).getDay()];
}

// Returns fire slots for a single calendar day.
// Each slot fires at the END of its period; the last slot fires at windowEnd even if partial.
function slotsForDay(
  midnight: number,
  settings: Settings,
): { fireAt: number; periodStart: number }[] {
  const { everyHour, startHour, endHour, frequencyMinutes } = settings;
  const windowStart = everyHour ? 0 : startHour;
  const windowEnd = everyHour ? 24 : endHour;
  const freqHours = frequencyMinutes / 60;

  const slots: { fireAt: number; periodStart: number }[] = [];
  let cursor = windowStart;

  while (cursor < windowEnd) {
    const nextCursor = cursor + freqHours;
    const fireHour = Math.min(nextCursor, windowEnd);
    slots.push({
      fireAt: midnight + fireHour * 3600_000,
      periodStart: midnight + cursor * 3600_000,
    });
    if (nextCursor >= windowEnd) break;
    cursor = nextCursor;
  }

  return slots;
}

export function buildSchedule(
  settings: Settings,
  now: number,
): { fireAt: number; periodStart: number }[] {
  const slots: { fireAt: number; periodStart: number }[] = [];

  for (let dayOffset = 0; slots.length < BATCH_SIZE; dayOffset++) {
    const d = new Date(now + dayOffset * 86_400_000);
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    if (!isAllowedDay(midnight, settings.checkInDays)) continue;

    for (const slot of slotsForDay(midnight, settings)) {
      if (slot.fireAt <= now) continue;
      slots.push(slot);
      if (slots.length >= BATCH_SIZE) break;
    }
  }

  return slots;
}

async function ensureChannel(): Promise<void> {
  await notifee.createChannel({
    id: config.notificationChannelId,
    name: config.notificationChannelName,
    importance: AndroidImportance.HIGH,
  });
}

async function ensureAlertChannel(): Promise<void> {
  await notifee.createChannel({
    id: config.checkInAlertChannelId,
    name: config.checkInAlertChannelName,
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [0, 400, 200, 400],
    visibility: AndroidVisibility.PUBLIC,
  });
}

async function start(): Promise<void> {
  await ensureAlertChannel();
  const settings = await SettingsService.load();
  const slots = buildSchedule(settings, Date.now());

  for (const { fireAt, periodStart } of slots) {
    await notifee.createTriggerNotification(
      {
        id: `checkin-${periodStart}-${fireAt}`,
        title: 'Time for a check-in! ⏰',
        body: `What did you work on from ${formatTime(periodStart)} to ${formatTime(fireAt)}?`,
        android: {
          channelId: config.checkInAlertChannelId,
          pressAction: { id: 'default' },
          sound: 'default',
          vibrationPattern: [0, 400, 200, 400],
          importance: AndroidImportance.HIGH,
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: fireAt },
    );
  }
}

async function stop(): Promise<void> {
  await notifee.cancelTriggerNotifications();
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function scheduleDailyPlan(settings: Settings, now: number): Promise<void> {
  if (!settings.dailyPlanEnabled) return;
  await ensureAlertChannel();
  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const d = new Date(now + dayOffset * 86_400_000);
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (!isAllowedDay(midnight, settings.checkInDays)) continue;
    const fireAt = midnight + settings.dailyPlanHour * 3_600_000;
    if (fireAt <= now) continue;
    const dateStr = toDateString(d);
    await notifee.createTriggerNotification(
      {
        id: `daily-plan-${dateStr}`,
        title: 'Time to plan your day 🗓',
        body: "What's on for today? Tap to set your daily plan.",
        android: {
          channelId: config.checkInAlertChannelId,
          pressAction: { id: 'default' },
          sound: 'default',
          vibrationPattern: [0, 400, 200, 400],
          importance: AndroidImportance.HIGH,
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: fireAt },
    );
  }
}

async function reschedule(): Promise<void> {
  await stop();
  const settings = await SettingsService.load();
  await start();
  await scheduleDailyPlan(settings, Date.now());
}

async function requestPermission(): Promise<boolean> {
  const result = await notifee.requestPermission();
  return result.authorizationStatus >= 1;
}

async function checkAlarmPermission(): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  return settings.android?.alarm !== AndroidNotificationSetting.DISABLED;
}

async function openAlarmSettings(): Promise<void> {
  await notifee.openAlarmPermissionSettings();
}

async function openAppSettings(): Promise<void> {
  await notifee.openNotificationSettings();
}

async function getNotificationDiagnostics(): Promise<string> {
  const ns = await notifee.getNotificationSettings();
  const pending = await notifee.getTriggerNotifications();
  const channels = await notifee.getChannels();

  const authStatus = ns.authorizationStatus;
  const alarmStatus = ns.android?.alarm;
  const alertChannel = channels.find(c => c.id === config.checkInAlertChannelId);

  const lines: string[] = [
    `Auth status: ${authStatus} (need ≥1)`,
    `Alarm permission: ${alarmStatus} (need 1=ENABLED)`,
    `Pending scheduled: ${pending.length}`,
    `Alert channel exists: ${alertChannel ? 'YES' : 'NO'}`,
    alertChannel ? `  Channel importance: ${alertChannel.importance}` : '',
    alertChannel ? `  Channel blocked: ${alertChannel.blocked ? 'YES ⚠️' : 'no'}` : '',
  ];

  return lines.filter(Boolean).join('\n');
}

async function sendTestNotification(): Promise<void> {
  await ensureAlertChannel();
  await notifee.displayNotification({
    title: 'Test notification ✅',
    body: 'Notifications are working! You will see check-ins like this.',
    android: {
      channelId: config.checkInAlertChannelId,
      pressAction: { id: 'default' },
      sound: 'default',
      vibrationPattern: [0, 400, 200, 400],
      importance: AndroidImportance.HIGH,
    },
  });
}

async function getPendingCount(): Promise<number> {
  const pending = await notifee.getTriggerNotifications();
  return pending.length;
}

async function hasMoreCheckInsToday(): Promise<boolean> {
  const pending = await notifee.getTriggerNotifications();
  const todayEnd = endOfDay(new Date());
  return pending.some(
    n =>
      n.notification.id?.startsWith('checkin-') &&
      n.trigger.type === TriggerType.TIMESTAMP &&
      (n.trigger as { timestamp: number }).timestamp <= todayEnd,
  );
}

function endOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

async function fireEndOfDayReport(): Promise<void> {
  await ensureChannel();
  await notifee.displayNotification({
    id: config.endOfDayNotificationId,
    title: "That's a wrap!",
    body: 'Tap to see your report for today.',
    android: {
      channelId: config.notificationChannelId,
      pressAction: { id: 'open-report' },
    },
  });
}

const SchedulerService = {
  start,
  stop,
  reschedule,
  scheduleDailyPlan,
  requestPermission,
  checkAlarmPermission,
  openAlarmSettings,
  openAppSettings,
  getNotificationDiagnostics,
  sendTestNotification,
  getPendingCount,
  hasMoreCheckInsToday,
  fireEndOfDayReport,
};
export default SchedulerService;
