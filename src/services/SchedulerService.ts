import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
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

async function start(): Promise<void> {
  await ensureChannel();
  const settings = await SettingsService.load();
  const slots = buildSchedule(settings, Date.now());

  for (const { fireAt, periodStart } of slots) {
    await notifee.createTriggerNotification(
      {
        id: `checkin-${fireAt}`,
        title: 'Time for a check-in!',
        body: `What did you work on from ${formatTime(periodStart)} to ${formatTime(fireAt)}?`,
        android: {
          channelId: config.notificationChannelId,
          pressAction: { id: 'default' },
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: fireAt },
    );
  }
}

async function stop(): Promise<void> {
  await notifee.cancelTriggerNotifications();
}

async function reschedule(): Promise<void> {
  await stop();
  await start();
}

async function requestPermission(): Promise<boolean> {
  const result = await notifee.requestPermission();
  return result.authorizationStatus >= 1;
}

const SchedulerService = { start, stop, reschedule, requestPermission };
export default SchedulerService;
