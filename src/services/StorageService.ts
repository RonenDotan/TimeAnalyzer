import { LogEntry, StorageProvider } from '../providers/storage/StorageProvider';

// Stub provider — logs to console until SQLite is wired in (ticket #6)
const stubProvider: StorageProvider = {
  async save(entry: LogEntry): Promise<void> {
    console.log('[StorageService] save entry:', JSON.stringify(entry));
  },
  async loadAll(): Promise<LogEntry[]> {
    return [];
  },
};

let activeProvider: StorageProvider = stubProvider;

function setProvider(provider: StorageProvider): void {
  activeProvider = provider;
}

async function save(entry: LogEntry): Promise<void> {
  return activeProvider.save(entry);
}

async function loadAll(): Promise<LogEntry[]> {
  return activeProvider.loadAll();
}

const StorageService = { save, loadAll, setProvider };
export default StorageService;
