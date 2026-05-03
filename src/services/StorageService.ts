import { LogEntry } from '../types/LogEntry';
import { StorageProvider } from '../providers/storage/StorageProvider';
import SQLiteStorageProvider from '../providers/storage/SQLiteStorageProvider';

let activeProvider: StorageProvider = SQLiteStorageProvider;

function setProvider(provider: StorageProvider): void {
  activeProvider = provider;
}

async function save(entry: Omit<LogEntry, 'id'>): Promise<LogEntry> {
  return activeProvider.save(entry);
}

async function update(entry: LogEntry): Promise<void> {
  return activeProvider.update(entry);
}

async function getAll(): Promise<LogEntry[]> {
  return activeProvider.getAll();
}

async function getByDateRange(start: Date, end: Date): Promise<LogEntry[]> {
  return activeProvider.getByDateRange(start, end);
}

async function deleteEntry(id: number): Promise<void> {
  return activeProvider.delete(id);
}

const StorageService = { save, update, getAll, getByDateRange, deleteEntry, setProvider };
export default StorageService;
