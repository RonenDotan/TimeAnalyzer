import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LogEntry } from '../types/LogEntry';
import { PlanBlock } from '../types/DayPlan';
import StorageService from './StorageService';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const PLAN_COLOR   = '7';  // Peacock (blue)
const ACTUAL_COLOR = '2';  // Sage (green)

// Minutes-from-midnight + a date string → ISO 8601 datetime
function minToIso(dateStr: string, minutes: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  // Use local time with timezone offset
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

async function apiRequest(
  method: string,
  path: string,
  body?: object,
): Promise<any> {
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

// Push a check-in entry to Google Calendar
async function pushEntry(entry: LogEntry, summary?: string): Promise<void> {
  const title = summary
    ? `✅ ${summary}`
    : `✅ Check-in`;

  const event = {
    summary: title,
    description: entry.transcript,
    start: { dateTime: tsToIso(entry.timestampStart) },
    end:   { dateTime: tsToIso(entry.timestampEnd) },
    colorId: ACTUAL_COLOR,
    extendedProperties: {
      private: { source: 'timeanalyzer', type: 'actual', entryId: String(entry.id) },
    },
  };

  if (entry.calendarEventId) {
    // Update existing event
    await apiRequest('PUT', `/calendars/primary/events/${entry.calendarEventId}`, event);
  } else {
    // Create new event, save ID back
    const created = await apiRequest('POST', '/calendars/primary/events', event);
    await StorageService.updateEntryCalendarEventId(entry.id, created.id);
  }
}

// Push a plan block to Google Calendar
async function pushPlanBlock(block: PlanBlock, dateStr: string): Promise<void> {
  const event = {
    summary: `📅 ${block.activity}`,
    start: { dateTime: minToIso(dateStr, block.startMin) },
    end:   { dateTime: minToIso(dateStr, block.endMin) },
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

// Delete a calendar event (used when plan blocks are replaced)
async function deleteEvent(calendarEventId: string): Promise<void> {
  try {
    await apiRequest('DELETE', `/calendars/primary/events/${calendarEventId}`);
  } catch {
    // Ignore — event may have already been deleted
  }
}

// Push all plan blocks for a day (called after plan save)
async function pushPlanForDate(dateStr: string): Promise<void> {
  const plan = await StorageService.getDayPlan(dateStr);
  if (!plan) return;
  const blocks = await StorageService.getPlanBlocks(plan.id);
  for (const block of blocks) {
    if (block.source !== 'app') continue;
    await pushPlanBlock(block, dateStr);
  }
}

// Delete old calendar events when plan blocks are replaced
async function deleteOldPlanEvents(oldBlocks: PlanBlock[]): Promise<void> {
  for (const block of oldBlocks) {
    if (block.source === 'app' && block.calendarEventId) {
      await deleteEvent(block.calendarEventId);
    }
  }
}

// Check if Google is connected (has a valid token)
async function isConnected(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}

const CalendarSyncService = {
  pushEntry,
  pushPlanBlock,
  pushPlanForDate,
  deleteOldPlanEvents,
  deleteEvent,
  isConnected,
};

export default CalendarSyncService;
