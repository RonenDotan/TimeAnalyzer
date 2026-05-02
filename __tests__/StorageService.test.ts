import { LogEntry } from '../src/types/LogEntry';
import { StorageProvider } from '../src/providers/storage/StorageProvider';
import StorageService from '../src/services/StorageService';

const entry: LogEntry = {
  id: 'test-id-1',
  timestampStart: 1000000,
  timestampEnd: 1007200000,
  transcript: 'I was debugging the auth module.',
};

const mockProvider: StorageProvider = {
  save: jest.fn(),
  getAll: jest.fn(),
  getByDateRange: jest.fn(),
  delete: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  StorageService.setProvider(mockProvider);
});

test('save() delegates to active provider', async () => {
  await StorageService.save(entry);
  expect(mockProvider.save).toHaveBeenCalledWith(entry);
  expect(mockProvider.save).toHaveBeenCalledTimes(1);
});

test('getAll() delegates to active provider and returns its result', async () => {
  (mockProvider.getAll as jest.Mock).mockResolvedValue([entry]);
  const result = await StorageService.getAll();
  expect(mockProvider.getAll).toHaveBeenCalledTimes(1);
  expect(result).toEqual([entry]);
});

test('getByDateRange() delegates to active provider with correct dates', async () => {
  const start = new Date('2026-01-01T00:00:00');
  const end = new Date('2026-01-31T23:59:59');
  (mockProvider.getByDateRange as jest.Mock).mockResolvedValue([entry]);
  const result = await StorageService.getByDateRange(start, end);
  expect(mockProvider.getByDateRange).toHaveBeenCalledWith(start, end);
  expect(result).toEqual([entry]);
});

test('deleteEntry() delegates to active provider with correct id', async () => {
  await StorageService.deleteEntry('test-id-1');
  expect(mockProvider.delete).toHaveBeenCalledWith('test-id-1');
  expect(mockProvider.delete).toHaveBeenCalledTimes(1);
});

test('setProvider() switches the active provider', async () => {
  const otherProvider: StorageProvider = {
    save: jest.fn(),
    getAll: jest.fn().mockResolvedValue([]),
    getByDateRange: jest.fn(),
    delete: jest.fn(),
  };
  StorageService.setProvider(otherProvider);
  await StorageService.getAll();
  expect(otherProvider.getAll).toHaveBeenCalledTimes(1);
  expect(mockProvider.getAll).not.toHaveBeenCalled();
});

test('save() then getAll() returns saved entries from provider', async () => {
  (mockProvider.getAll as jest.Mock).mockResolvedValue([entry]);
  await StorageService.save(entry);
  const result = await StorageService.getAll();
  expect(result).toEqual([entry]);
  expect(mockProvider.save).toHaveBeenCalledTimes(1);
  expect(mockProvider.getAll).toHaveBeenCalledTimes(1);
});
