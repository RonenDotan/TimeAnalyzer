import type { LogEntry } from '../src/types/LogEntry';

const mockExecuteSync = jest.fn().mockReturnValue({ rows: [], insertId: 1 });
const mockOpen = jest.fn(() => ({ executeSync: mockExecuteSync }));

jest.mock('@op-engineering/op-sqlite', () => ({
  open: mockOpen,
}));

let provider: {
  save: (e: Omit<LogEntry, 'id'>) => Promise<LogEntry>;
  getAll: () => Promise<LogEntry[]>;
  getByDateRange: (s: Date, e: Date) => Promise<LogEntry[]>;
  delete: (id: number) => Promise<void>;
};

const entryInput: Omit<LogEntry, 'id'> = {
  timestampStart: 1000000000,
  timestampEnd: 1000007200000,
  transcript: 'Worked on auth module debugging',
  calendarEventId: null,
  source: 'app',
};

const entry: LogEntry = { id: 1, ...entryInput };

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

test('save() inserts without id and returns entry with assigned id', async () => {
  const saved = await provider.save(entryInput);
  const insertCall = mockExecuteSync.mock.calls.find(
    ([sql]: unknown[]) => (sql as string).includes('INSERT'),
  );
  expect(insertCall).toBeDefined();
  const [sql, params] = insertCall!;
  expect(sql).toMatch(/INSERT INTO log_entries/);
  expect(params).toEqual([entryInput.timestampStart, entryInput.timestampEnd, entryInput.transcript]);
  expect(saved).toEqual(entry);
});

test('getAll() queries all entries ordered by timestamp_end DESC', async () => {
  await provider.getAll();
  const selectCall = mockExecuteSync.mock.calls.find(
    ([sql]: unknown[]) => (sql as string).includes('SELECT'),
  );
  expect(selectCall).toBeDefined();
  expect(selectCall![0]).toMatch(/ORDER BY timestamp_end DESC/);
});

test('getAll() maps db rows to LogEntry objects correctly', async () => {
  mockExecuteSync.mockImplementation((sql: string) => {
    if (sql.includes('SELECT')) {
      return {
        rows: [{
          id: 1,
          timestamp_start: entryInput.timestampStart,
          timestamp_end: entryInput.timestampEnd,
          transcript: entryInput.transcript,
        }],
        insertId: 1,
      };
    }
    return { rows: [], insertId: 1 };
  });

  const results = await provider.getAll();
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual(entry);
});

test('getByDateRange() passes date range as unix timestamps', async () => {
  const start = new Date('2026-05-01T00:00:00');
  const end = new Date('2026-05-02T00:00:00');
  await provider.getByDateRange(start, end);
  const rangeCall = mockExecuteSync.mock.calls.find(
    ([sql]: unknown[]) => (sql as string).includes('WHERE'),
  );
  expect(rangeCall).toBeDefined();
  expect(rangeCall![1]).toEqual([start.getTime(), end.getTime()]);
});

test('delete() removes entry by integer id', async () => {
  await provider.delete(1);
  const deleteCall = mockExecuteSync.mock.calls.find(
    ([sql]: unknown[]) => (sql as string).includes('DELETE'),
  );
  expect(deleteCall).toBeDefined();
  expect(deleteCall![1]).toEqual([1]);
});
