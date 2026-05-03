export type FrequencyMinutes = 1 | 2 | 30 | 60 | 120 | 240 | 480 | 1440;
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
  noteKeyword: string;   // spoken word that starts a note (default: "note")
  appendKeyword: string; // spoken word that appends transcription (default: "append")
  theme: Theme;
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
};

export const THEME_OPTIONS: { label: string; sublabel: string; value: Theme }[] = [
  { label: 'System', sublabel: 'Follow device setting', value: 'system' },
  { label: 'Light', sublabel: 'Always light', value: 'light' },
  { label: 'Dark', sublabel: 'Always dark', value: 'dark' },
];

export const FREQUENCY_OPTIONS: { label: string; value: FrequencyMinutes }[] = [
  { label: '1 min', value: 1 },
  { label: '2 min', value: 2 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '8 hours', value: 480 },
  { label: '1 day', value: 1440 },
];

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TRANSCRIPTION_PROVIDERS: { label: string; sublabel: string; value: TranscriptionProvider }[] = [
  { label: 'Groq', sublabel: 'Whisper via Groq API', value: 'groq' },
];

export const ANALYSIS_PROVIDERS: { label: string; sublabel: string; value: AnalysisProvider }[] = [
  { label: 'Claude', sublabel: 'Anthropic', value: 'claude' },
  { label: 'OpenAI', sublabel: 'ChatGPT / GPT-4o', value: 'openai' },
];
