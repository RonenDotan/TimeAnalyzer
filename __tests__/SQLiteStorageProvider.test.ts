import type { LogEntry } from '../src/types/LogEntry';

const mockExecuteSync = jest.fn().mockReturnValue({ rows: [], insertId: 1 });
const mockOpen = jest.fn(() => ({ executeSync: mockExecuteSync }));

jest.mock('@op-engineering/op-sqlite', () => ({
  open: mockOpen,
}));

let provider: {
  save: (e: Omit<LogEntry, 'id' | 'status' | 'updatedAt' | 'syncedAt'>) => Promise<LogEntry>;
  getAll: () => Promise<LogEntry[]>;
  getByDateRange: (s: Date, e: Date) => Promise<LogEntry[]>;
  delete: (id: number) => Promise<void>;
  hardDeleteEntry: (id: number) => Promise<void>;
};

const entryInput: Omit<LogEntry, 'id' | 'status' | 'updatedAt' | 'syncedAt'> = {
  timestampStart: 1000000000,
  timestampEnd: 1000007200000,
  transcript: 'Worked on auth module debugging',
  calendarEventId: null,
  source: 'app',
};

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockExecuteSync.mockReturnValue({ rows: [], insertId: 1 });
  provider = require('../src/providers/storage/SQLiteStorageProvider').default;
});

test('creates the log_entries table on first use', async () => {
  await provider.getAll();
  const firstCall = mockExecuteSync.mock.calls[0][0] as string;
  expect(firstCall).toMatch(/CREATE TABLE IF NOT EXISTS log_entries/);
});

test('schema uses INTEGER PRIMARY KEY AUTOINCREMENT', async () => {
  await provider.getAll();
  const firstCall = mockExecuteSync.mock.calls[0][0] as string;
  expect(firstCall).toMatch(/INTEGER PRIMARY KEY AUTOINCREMENT/);
});

test('save() inserts with status=1, synced_at=null and returns entry with assigned id', async () => {
  const saved = await provider.save(entryInput);
  const insertCall = mockExecuteSync.mock.calls.find(
    ([sql]: unknown[]) => (sql as string).includes('INSERT INTO log_entries'),
  );
  expect(insertCall).toBeDefined();
  const [sql, params] = insertCall!;
  expect(sql).toMatch(/INSERT INTO log_entries/);
  // params: [timestampStart, timestampEnd, transcript, calendarEventId, source, status, updated_at, synced_at]
  expect(params[0]).toBe(entryInput.timestampStart);
  expect(params[1]).toBe(entryInput.timestampEnd);
  expect(params[2]).toBe(entryInput.transcript);
  expect(params[5]).toBe(1);   // status
  expect(params[7]).toBeNull(); // synced_at
  expect(saved).toEqual(expect.objectContaining({
    id: 1,
    timestampStart: entryInput.timestampStart,
    timestampEnd: entryInput.timestampEnd,
    transcript: entryInput.transcript,
    calendarEventId: null,
    source: 'app',
    status: 1,
    syncedAt: null,
  }));
  expect(typeof saved.updatedAt).toBe('number');
});

test('getAll() queries only active entries ordered by timestamp_end DESC', async () => {
  await provider.getAll();
  const selectCall = mockExecuteSync.mock.calls.find(
    ([sql]: unknown[]) => (sql as string).includes('FROM log_entries'),
  );
  expect(selectCall).toBeDefined();
  expect(selectCall![0]).toMatch(/WHERE status = 1/);
  expect(selectCall![0]).toMatch(/ORDER BY timestamp_end DESC/);
});

test('getAll() maps db rows to LogEntry objects correctly', async () => {
  mockExecuteSync.mockImplementation((sql: string) => {
    if (sql.includes('SELECT') && sql.includes('log_entries')) {
      return {
        rows: [{
          id: 1,
          timestamp_start: entryInput.timestampStart,
          timestamp_end: entryInput.timestampEnd,
          transcript: entryInput.transcript,
          calendar_event_id: null,
          source: 'app',
          status: 1,
          updated_at: 1000000000,
          synced_at: null,
        }],
        insertId: 1,
      };
    }
    return { rows: [], insertId: 1 };
  });

  const results = await provider.getAll();
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: 1,
    timestampStart: entryInput.timestampStart,
    timestampEnd: entryInput.timestampEnd,
    transcript: entryInput.transcript,
    calendarEventId: null,
    source: 'app',
    status: 1,
    updatedAt: 1000000000,
    syncedAt: null,
  });
});

test('getByDateRange() passes date range as unix timestamps and filters by status', async () => {
  const start = new Date('2026-05-01T00:00:00');
  const end = new Date('2026-05-02T00:00:00');
  await provider.getByDateRange(start, end);
  const rangeCall = mockExecuteSync.mock.calls.find(
    ([sql]: unknown[]) => (sql as string).includes('FROM log_entries') && (sql as string).includes('timestamp_end >='),
  );
  expect(rangeCall).toBeDefined();
  expect(rangeCall![0]).toMatch(/WHERE status = 1/);
  expect(rangeCall![1]).toEqual([start.getTime(), end.getTime()]);
});

test('delete() soft-deletes entry by setting status=0', async () => {
  await provider.delete(1);
  const updateCall = mockExecuteSync.mock.calls.find(
    ([sql]: unknown[]) => (sql as string).includes('SET status = 0'),
  );
  expect(updateCall).toBeDefined();
  expect(updateCall![1]).toEqual([1]);
});

test('hardDeleteEntry() permanently removes entry by id', async () => {
  await provider.hardDeleteEntry(1);
  const deleteCall = mockExecuteSync.mock.calls.find(
    ([sql]: unknown[]) => (sql as string).includes('DELETE FROM log_entries'),
  );
  expect(deleteCall).toBeDefined();
  expect(deleteCall![1]).toEqual([1]);
});
