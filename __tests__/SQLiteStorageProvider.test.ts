import type { LogEntry } from '../src/types/LogEntry';

const mockExecuteSync = jest.fn().mockReturnValue({ rows: [] });
const mockOpen = jest.fn(() => ({ executeSync: mockExecuteSync }));

jest.mock('@op-engineering/op-sqlite', () => ({
  open: (...args: unknown[]) => mockOpen(...args),
}));

let provider: {
  save: (e: LogEntry) => Promise<void>;
  getAll: () => Promise<LogEntry[]>;
  getByDateRange: (s: Date, e: Date) => Promise<LogEntry[]>;
  delete: (id: string) => Promise<void>;
};

const entry: LogEntry = {
  id: 'abc-123',
  timestampStart: 1000000000,
  timestampEnd: 1000007200000,
  transcript: 'Worked on auth module debugging',
};

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockExecuteSync.mockReturnValue({ rows: [] });
  provider = require('../src/providers/storage/SQLiteStorageProvider').default;
});

test('creates the log_entries table on first use', async () => {
  await provider.getAll();
  const firstCall = mockExecuteSync.mock.calls[0][0] as string;
  expect(firstCall).toMatch(/CREATE TABLE IF NOT EXISTS log_entries/);
});

test('save() inserts entry with correct SQL and values', async () => {
  await provider.save(entry);
  const insertCall = mockExecuteSync.mock.calls.find(
    ([sql]: [string]) => sql.includes('INSERT'),
  );
  expect(insertCall).toBeDefined();
  const [sql, params] = insertCall!;
  expect(sql).toMatch(/INSERT OR REPLACE INTO log_entries/);
  expect(params).toEqual([entry.id, entry.timestampStart, entry.timestampEnd, entry.transcript]);
});

test('getAll() queries all entries ordered by timestamp_end DESC', async () => {
  await provider.getAll();
  const selectCall = mockExecuteSync.mock.calls.find(
    ([sql]: [string]) => sql.includes('SELECT'),
  );
  expect(selectCall).toBeDefined();
  expect(selectCall![0]).toMatch(/ORDER BY timestamp_end DESC/);
});

test('getAll() maps db rows to LogEntry objects correctly', async () => {
  mockExecuteSync.mockImplementation((sql: string) => {
    if (sql.includes('SELECT')) {
      return {
        rows: [
          {
            id: entry.id,
            timestamp_start: entry.timestampStart,
            timestamp_end: entry.timestampEnd,
            transcript: entry.transcript,
          },
        ],
      };
    }
    return { rows: [] };
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
    ([sql]: [string]) => sql.includes('WHERE'),
  );
  expect(rangeCall).toBeDefined();
  expect(rangeCall![1]).toEqual([start.getTime(), end.getTime()]);
});

test('delete() removes entry by id', async () => {
  await provider.delete('abc-123');
  const deleteCall = mockExecuteSync.mock.calls.find(
    ([sql]: [string]) => sql.includes('DELETE'),
  );
  expect(deleteCall).toBeDefined();
  expect(deleteCall![1]).toEqual(['abc-123']);
});
