import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LogEntry } from '../types/LogEntry';
import { PlanBlockWithDate } from '../types/DayPlan';
import StorageService from './StorageService';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const PLAN_COLOR   = '7';  // Peacock (blue)
const ACTUAL_COLOR = '2';  // Sage (green)

let isSyncing = false;

// Minutes-from-midnight + a date string → ISO 8601 datetime with local offset
function minToIso(dateStr: string, minutes: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOff = Math.abs(offset);
  const offStr = `${sign}${pad(Math.floor(absOff / 60))}:${pad(absOff % 60)}`;
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00${offStr}`;
}

function tsToIso(ts: number): string {
  return new Date(ts).toISOString();
}

async function getToken(): Promise<string | null> {
  try {
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken;
  } catch {
    return null;
  }
}

async function apiRequest(method: string, path: string, body?: object): Promise<any> {
  const token = await getToken();
  if (!token) throw new Error('Not signed in to Google');

  const res = await fetch(`${CALENDAR_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar API ${res.status}: ${err}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function deleteCalendarEvent(calendarEventId: string): Promise<void> {
  try {
    await apiRequest('DELETE', `/calendars/primary/events/${calendarEventId}`);
  } catch {
    // Ignore — event may already be gone
  }
}

async function pushEntry(entry: LogEntry): Promise<void> {
  const event = {
    summary: '✅ Check-in',
    description: entry.transcript,
    start: { dateTime: tsToIso(entry.timestampStart) },
    end:   { dateTime: tsToIso(entry.timestampEnd) },
    colorId: ACTUAL_COLOR,
    extendedProperties: {
      private: { source: 'timeanalyzer', type: 'actual', entryId: String(entry.id) },
    },
  };

  if (entry.calendarEventId) {
    await apiRequest('PUT', `/calendars/primary/events/${entry.calendarEventId}`, event);
  } else {
    const created = await apiRequest('POST', '/calendars/primary/events', event);
    await StorageService.updateEntryCalendarEventId(entry.id, created.id);
  }
}

async function pushPlanBlock(block: PlanBlockWithDate): Promise<void> {
  const event = {
    summary: `📅 ${block.activity}`,
    start: { dateTime: minToIso(block.date, block.startMin) },
    end:   { dateTime: minToIso(block.date, block.endMin) },
    colorId: PLAN_COLOR,
    extendedProperties: {
      private: { source: 'timeanalyzer', type: 'plan', blockId: String(block.id) },
    },
  };

  if (block.calendarEventId) {
    await apiRequest('PUT', `/calendars/primary/events/${block.calendarEventId}`, event);
  } else {
    const created = await apiRequest('POST', '/calendars/primary/events', event);
    await StorageService.updatePlanBlockCalendarEventId(block.id, created.id);
  }
}

/**
 * Push all rows that have changed since last sync.
 * Called every 15 min and on foreground resume.
 * Silently no-ops when not connected.
 */
async function syncChanged(): Promise<void> {
  if (isSyncing) return;
  const token = await getToken();
  if (!token) return;

  isSyncing = true;
  try {
    // 1. Push / update unsynced check-in entries
    const unsyncedEntries = await StorageService.getUnsyncedEntries();
    for (const entry of unsyncedEntries) {
      try {
        await pushEntry(entry);
        await StorageService.updateEntrySyncedAt(entry.id, Date.now());
      } catch {
        // Failed entries will retry on the next interval
      }
    }

    // 2. Delete calendar events for soft-deleted entries, then hard-delete from DB
    const pendingEntries = await StorageService.getPendingDeleteEntries();
    for (const entry of pendingEntries) {
      try {
        if (entry.calendarEventId) {
          await deleteCalendarEvent(entry.calendarEventId);
        }
        await StorageService.hardDeleteEntry(entry.id);
      } catch {
        // Will retry next interval
      }
    }

    // 3. Push / update unsynced plan blocks
    const unsyncedBlocks = await StorageService.getUnsyncedPlanBlocksWithDate();
    for (const block of unsyncedBlocks) {
      try {
        await pushPlanBlock(block);
        await StorageService.updatePlanBlockSyncedAt(block.id, Date.now());
      } catch {
        // Will retry next interval
      }
    }

    // 4. Delete calendar events for soft-deleted plan blocks, then hard-delete
    const pendingBlocks = await StorageService.getPendingDeletePlanBlocksWithDate();
    for (const block of pendingBlocks) {
      try {
        if (block.calendarEventId) {
          await deleteCalendarEvent(block.calendarEventId);
        }
        await StorageService.hardDeletePlanBlock(block.id);
      } catch {
        // Will retry next interval
      }
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Reset synced_at on all active rows then run syncChanged().
 * Use this after first sign-in or when calendar events are stale.
 */
async function hardSync(): Promise<void> {
  await StorageService.hardResetSyncedAt();
  isSyncing = false; // Clear any stuck lock before re-running
  await syncChanged();
}

async function isConnected(): Promise<boolean> {
  return (await getToken()) !== null;
}

const CalendarSyncService = {
  syncChanged,
  hardSync,
  isConnected,
};

export default CalendarSyncService;
