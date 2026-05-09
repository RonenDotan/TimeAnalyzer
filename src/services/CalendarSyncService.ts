import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LogEntry } from '../types/LogEntry';
import { PlanBlockWithDate } from '../types/DayPlan';
import StorageService from './StorageService';
import SettingsService, { DEFAULT_CALENDAR_COLOR } from './SettingsService';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const PLAN_COLOR   = '7';  // Peacock (blue)
const ACTUAL_COLOR = '2';  // Sage (green)

// Rolling pull window: yesterday through +7 days
const PULL_DAYS_BACK    = 1;
const PULL_DAYS_FORWARD = 7;

// Restore window: 1 year back through 30 days forward
const RESTORE_DAYS_BACK    = 365;
const RESTORE_DAYS_FORWARD = 30;

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

// Convert ISO 8601 datetime to minutes-from-midnight in local time
function isoToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

// Format Date as YYYY-MM-DD
function toDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Scan Google Calendar for events we pushed (source='timeanalyzer') and restore
 * any that are missing from the local DB. Covers 1 year back so a reinstall
 * recovers historical data. Uses pagination to handle large calendars.
 */
async function restoreFromCalendar(): Promise<void> {
  const now = new Date();

  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - RESTORE_DAYS_BACK);
  windowStart.setHours(0, 0, 0, 0);

  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + RESTORE_DAYS_FORWARD);
  windowEnd.setHours(23, 59, 59, 999);

  let pageToken: string | undefined;
  let restoredEntries = 0;
  let restoredBlocks  = 0;

  do {
    const params = new URLSearchParams({
      timeMin:       windowStart.toISOString(),
      timeMax:       windowEnd.toISOString(),
      singleEvents:  'true',
      orderBy:       'startTime',
      maxResults:    '250',
      privateExtendedProperty: 'source=timeanalyzer',
      ...(pageToken ? { pageToken } : {}),
    });

    const data = await apiRequest('GET', `/calendars/primary/events?${params.toString()}`);
    const items: any[] = data?.items ?? [];
    pageToken = data?.nextPageToken;

    for (const item of items) {
      if (item.extendedProperties?.private?.source !== 'timeanalyzer') continue;
      if (!item.start?.dateTime || !item.end?.dateTime) continue;
      if (item.status === 'cancelled') continue;

      const type            = item.extendedProperties?.private?.type as string | undefined;
      const calendarEventId = item.id as string;

      if (type === 'actual') {
        const exists = await StorageService.entryExistsByCalendarId(calendarEventId);
        if (!exists) {
          await StorageService.restoreEntryFromCalendar({
            timestampStart: new Date(item.start.dateTime).getTime(),
            timestampEnd:   new Date(item.end.dateTime).getTime(),
            transcript:     item.description ?? '',
            calendarEventId,
          });
          restoredEntries++;
        }
      } else if (type === 'plan') {
        const exists = await StorageService.planBlockExistsByCalendarId(calendarEventId);
        if (!exists) {
          const startDate = new Date(item.start.dateTime);
          const endDate   = new Date(item.end.dateTime);
          const dateStr   = toDateStr(startDate);
          const startMin  = isoToMinutes(item.start.dateTime);
          const endMin    = endDate.toDateString() !== startDate.toDateString()
            ? 23 * 60 + 59
            : isoToMinutes(item.end.dateTime);
          // Strip the "📅 " prefix we add when pushing plan blocks
          const activity = (item.summary ?? '').replace(/^📅\s*/, '') || '(No title)';
          await StorageService.restorePlanBlockFromCalendar(dateStr, calendarEventId, startMin, endMin, activity);
          restoredBlocks++;
        }
      }
    }
  } while (pageToken);

  if (restoredEntries > 0 || restoredBlocks > 0) {
    console.log(`[CalendarSync] Restored ${restoredEntries} check-in entries, ${restoredBlocks} plan blocks from calendar`);
  }
}

/**
 * Pull Google Calendar events for a rolling window and upsert into plan_blocks
 * with source='calendar'. Events already pushed by TimeAnalyzer are excluded.
 * Events deleted from Google Calendar are soft-deleted locally.
 */
async function pullCalendarEvents(): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - PULL_DAYS_BACK);
  windowStart.setHours(0, 0, 0, 0);

  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + PULL_DAYS_FORWARD);
  windowEnd.setHours(23, 59, 59, 999);

  // Fetch all events in the window
  const params = new URLSearchParams({
    timeMin: windowStart.toISOString(),
    timeMax: windowEnd.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const data = await apiRequest('GET', `/calendars/primary/events?${params.toString()}`);
  const items: any[] = data?.items ?? [];

  // Group fetched external event IDs by date
  const fetchedIdsByDate: Record<string, string[]> = {};

  for (const item of items) {
    // Skip our own events
    if (item.extendedProperties?.private?.source === 'timeanalyzer') continue;
    // Skip all-day events (no dateTime)
    if (!item.start?.dateTime || !item.end?.dateTime) continue;
    // Skip cancelled events
    if (item.status === 'cancelled') continue;

    const startDate = new Date(item.start.dateTime);
    const endDate = new Date(item.end.dateTime);
    const dateStr = toDateStr(startDate);

    const startMin = isoToMinutes(item.start.dateTime);
    const endMin   = isoToMinutes(item.end.dateTime);
    const activity = item.summary ?? '(No title)';
    const eventId  = item.id as string;

    // Handle events that span midnight: cap at 23:59
    const effectiveEndMin = endDate.toDateString() !== startDate.toDateString()
      ? 23 * 60 + 59
      : endMin;

    await StorageService.upsertCalendarPlanBlock(dateStr, eventId, startMin, effectiveEndMin, activity);

    if (!fetchedIdsByDate[dateStr]) fetchedIdsByDate[dateStr] = [];
    fetchedIdsByDate[dateStr].push(eventId);
  }

  // Soft-delete local calendar blocks not present in the fetched results, per day
  const dates: string[] = [];
  for (let i = -PULL_DAYS_BACK; i <= PULL_DAYS_FORWARD; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    dates.push(toDateStr(d));
  }
  for (const dateStr of dates) {
    const fetchedIds = fetchedIdsByDate[dateStr] ?? [];
    await StorageService.softDeleteCalendarBlocksNotIn(dateStr, fetchedIds);
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
    // 0. Fetch calendar color once (only if still at default — i.e. never fetched before)
    const currentColor = await SettingsService.getCalendarColor();
    if (currentColor === DEFAULT_CALENDAR_COLOR) {
      await fetchAndStoreCalendarColor();
    }

    // 0b. On fresh install (empty DB), restore from calendar before pushing
    try {
      const count = await StorageService.getEntryCount();
      if (count === 0) {
        await restoreFromCalendar();
      }
    } catch {
      // Non-fatal
    }

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

    // 5. Pull external calendar events into plan_blocks (source='calendar')
    try {
      await pullCalendarEvents();
    } catch {
      // Pull failure is non-fatal — will retry next sync
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Reset synced_at on all active rows then run syncChanged().
 * Also restores any entries/plan blocks missing from local DB that exist in calendar.
 * Use this after first sign-in, reinstall, or when calendar events are stale.
 */
async function hardSync(): Promise<void> {
  await StorageService.hardResetSyncedAt();
  await fetchAndStoreCalendarColor(); // Always refresh color on hard sync
  // Restore missing entries/blocks from calendar (covers reinstall scenario)
  try {
    await restoreFromCalendar();
  } catch {
    // Non-fatal — proceed with normal sync
  }
  isSyncing = false; // Clear any stuck lock before re-running
  await syncChanged();
}

async function fetchAndStoreCalendarColor(): Promise<void> {
  try {
    const data = await apiRequest('GET', '/users/me/calendarList/primary');
    const color: string | undefined = data?.backgroundColor;
    if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
      await SettingsService.setCalendarColor(color);
    }
  } catch {
    // Non-fatal — keep existing color
  }
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
