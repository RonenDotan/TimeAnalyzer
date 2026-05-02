import { LogEntry } from '../types/LogEntry';
import { StorageProvider } from '../providers/storage/StorageProvider';
import SQLiteStorageProvider from '../providers/storage/SQLiteStorageProvider';

let activeProvider: StorageProvider = SQLiteStorageProvider;

function setProvider(provider: StorageProvider): void {
  activeProvider = provider;
}

async function save(entry: LogEntry): Promise<void> {
  return activeProvider.save(entry);
}

async function getAll(): Promise<LogEntry[]> {
  return activeProvider.getAll();
}

async function getByDateRange(start: Date, end: Date): Promise<LogEntry[]> {
  return activeProvider.getByDateRange(start, end);
}

async function deleteEntry(id: string): Promise<void> {
  return activeProvider.delete(id);
}

const StorageService = { save, getAll, getByDateRange, deleteEntry, setProvider };
export default StorageService;
