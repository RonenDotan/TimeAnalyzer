import notifee, {
  AndroidImportance,
  TriggerType,
} from '@notifee/react-native';
import config from '../config';

const BATCH_SIZE = 50;

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
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

  const intervalMs = config.checkInIntervalMinutes * 60 * 1000;

  for (let i = 0; i < BATCH_SIZE; i++) {
    const endTime = Date.now() + (i + 1) * intervalMs;
    const startTime = endTime - intervalMs;
    const id = `checkin-${endTime}`;

    await notifee.createTriggerNotification(
      {
        id,
        title: 'Time for a check-in!',
        body: `What did you work on from ${formatTime(startTime)} to ${formatTime(endTime)}?`,
        android: {
          channelId: config.notificationChannelId,
          pressAction: { id: 'default' },
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: endTime,
      },
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
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1;
}

const SchedulerService = { start, stop, reschedule, requestPermission };
export default SchedulerService;
