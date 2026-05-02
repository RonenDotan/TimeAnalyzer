import type { LogEntry } from '../src/types/LogEntry';

const entry: LogEntry = {
  id: 'abc-123',
  timestampStart: 1000000000,
  timestampEnd: 1000007200000,
  transcript: 'Worked on auth module debugging',
};

let provider: {
  save: (e: LogEntry) => Promise<void>;
  getAll: () => Promise<LogEntry[]>;
  getByDateRange: (s: Date, e: Date) => Promise<LogEntry[]>;
  delete: (id: string) => Promise<void>;
};
let mockExecute: jest.Mock;

beforeEach(() => {
  jest.resetModules();
  // Re-require mock after module reset to get fresh jest.fn() instances
  const opSqlite = require('@op-engineering/op-sqlite');
  mockExecute = jest.fn().mockReturnValue({ rows: { _array: [] } });
  opSqlite.open.mockReturnValue({ execute: mockExecute });
  opSqlite.open.mockClear();
  // Re-require provider so the module-level db singleton resets to null
  provider = require('../src/providers/storage/SQLiteStorageProvider').default;
});

test('creates the log_entries table on first use', async () => {
  await provider.getAll();
  const firstCall = mockExecute.mock.calls[0][0] as string;
  expect(firstCall).toMatch(/CREATE TABLE IF NOT EXISTS log_entries/);
});

test('save() inserts entry with correct SQL and values', async () => {
  await provider.save(entry);
  const insertCall = mockExecute.mock.calls.find(
    ([sql]: [string]) => sql.includes('INSERT'),
  );
  expect(insertCall).toBeDefined();
  const [sql, params] = insertCall!;
  expect(sql).toMatch(/INSERT OR REPLACE INTO log_entries/);
  expect(params).toEqual([entry.id, entry.timestampStart, entry.timestampEnd, entry.transcript]);
});

test('getAll() queries all entries ordered by timestamp_end DESC', async () => {
  await provider.getAll();
  const selectCall = mockExecute.mock.calls.find(
    ([sql]: [string]) => sql.includes('SELECT'),
  );
  expect(selectCall).toBeDefined();
  expect(selectCall![0]).toMatch(/ORDER BY timestamp_end DESC/);
});

test('getAll() maps db rows to LogEntry objects correctly', async () => {
  mockExecute.mockImplementation((sql: string) => {
    if (sql.includes('SELECT')) {
      return {
        rows: {
          _array: [
            {
              id: entry.id,
              timestamp_start: entry.timestampStart,
              timestamp_end: entry.timestampEnd,
              transcript: entry.transcript,
            },
          ],
        },
      };
    }
    return { rows: { _array: [] } };
  });

  const results = await provider.getAll();
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual(entry);
});

test('getByDateRange() passes date range as unix timestamps', async () => {
  const start = new Date('2026-05-01T00:00:00');
  const end = new Date('2026-05-02T00:00:00');
  await provider.getByDateRange(start, end);
  const rangeCall = mockExecute.mock.calls.find(
    ([sql]: [string]) => sql.includes('WHERE'),
  );
  expect(rangeCall).toBeDefined();
  expect(rangeCall![1]).toEqual([start.getTime(), end.getTime()]);
});

test('delete() removes entry by id', async () => {
  await provider.delete('abc-123');
  const deleteCall = mockExecute.mock.calls.find(
    ([sql]: [string]) => sql.includes('DELETE'),
  );
  expect(deleteCall).toBeDefined();
  expect(deleteCall![1]).toEqual(['abc-123']);
});
