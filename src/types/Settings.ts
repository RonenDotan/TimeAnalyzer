export type FrequencyMinutes = number;
export type SyncIntervalMinutes = 0 | 1 | 5 | 15 | 30 | 60;
export type TranscriptionProvider = 'groq';
export type AnalysisProvider = 'claude' | 'openai';
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  checkInDays: [boolean, boolean, boolean, boolean, boolean, boolean, boolean]; // Sun–Sat
  everyHour: boolean; // true = fire 24/7, ignore startHour/endHour
  startHour: number; // 0–23
  endHour: number; // 0–23
  frequencyMinutes: FrequencyMinutes;
  transcriptionProvider: TranscriptionProvider;
  analysisProvider: AnalysisProvider;
  noteKeyword: string;
  appendKeyword: string;
  theme: Theme;
  dailyPlanEnabled: boolean;
  dailyPlanHour: number; // 0–23
  calendarSyncIntervalMinutes: SyncIntervalMinutes; // 0 = manual only
  debugMode: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  checkInDays: [true, true, true, true, true, true, true],
  everyHour: true,
  startHour: 10,
  endHour: 19,
  frequencyMinutes: 120,
  transcriptionProvider: 'groq',
  analysisProvider: 'claude',
  noteKeyword: 'note',
  appendKeyword: 'append',
  theme: 'system',
  dailyPlanEnabled: true,
  dailyPlanHour: 8,
  calendarSyncIntervalMinutes: 15,
  debugMode: false,
};

export const THEME_OPTIONS: { label: string; sublabel: string; value: Theme }[] = [
  { label: 'System', sublabel: 'Follow device setting', value: 'system' },
  { label: 'Light', sublabel: 'Always light', value: 'light' },
  { label: 'Dark', sublabel: 'Always dark', value: 'dark' },
];

export const SYNC_INTERVAL_OPTIONS: { label: string; sublabel: string; value: SyncIntervalMinutes }[] = [
  { label: 'Every 1 min',  sublabel: 'Debug only',        value: 1  },
  { label: 'Every 5 min',  sublabel: 'High frequency',   value: 5  },
  { label: 'Every 15 min', sublabel: 'Recommended',       value: 15 },
  { label: 'Every 30 min', sublabel: 'Balanced',          value: 30 },
  { label: 'Every hour',   sublabel: 'Low frequency',     value: 60 },
  { label: 'Manual only',  sublabel: 'Sync now / Hard sync only', value: 0 },
];

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TRANSCRIPTION_PROVIDERS: { label: string; sublabel: string; value: TranscriptionProvider }[] = [
  { label: 'Groq', sublabel: 'Whisper via Groq API', value: 'groq' },
];

export const ANALYSIS_PROVIDERS: { label: string; sublabel: string; value: AnalysisProvider }[] = [
  { label: 'Claude', sublabel: 'Anthropic', value: 'claude' },
  { label: 'OpenAI', sublabel: 'ChatGPT / GPT-4o', value: 'openai' },
];
