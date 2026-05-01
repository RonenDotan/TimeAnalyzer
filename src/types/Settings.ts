export type FrequencyMinutes = 1 | 30 | 60 | 120 | 240 | 480 | 1440;

export interface Settings {
  checkInDays: [boolean, boolean, boolean, boolean, boolean, boolean, boolean]; // Sun–Sat
  everyHour: boolean; // true = fire 24/7, ignore startHour/endHour
  startHour: number; // 0–23
  endHour: number; // 0–23
  frequencyMinutes: FrequencyMinutes;
}

export const DEFAULT_SETTINGS: Settings = {
  checkInDays: [true, true, true, true, true, true, true],
  everyHour: true,
  startHour: 10,
  endHour: 19,
  frequencyMinutes: 120,
};

export const FREQUENCY_OPTIONS: { label: string; value: FrequencyMinutes }[] = [
  { label: '1 min (debug)', value: 1 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '8 hours', value: 480 },
  { label: '1 day', value: 1440 },
];

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
