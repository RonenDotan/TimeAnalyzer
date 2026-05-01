import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsService from '../src/services/SettingsService';
import { DEFAULT_SETTINGS } from '../src/types/Settings';

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock)();
});

test('load() returns defaults when nothing stored', async () => {
  const s = await SettingsService.load();
  expect(s).toEqual(DEFAULT_SETTINGS);
});

test('save() then load() round-trips settings', async () => {
  const custom = { ...DEFAULT_SETTINGS, frequencyMinutes: 30 as const, everyHour: false, startHour: 9, endHour: 17 };
  await SettingsService.save(custom);
  const loaded = await SettingsService.load();
  expect(loaded).toEqual(custom);
});

test('load() merges missing keys with defaults if stored value is partial', async () => {
  await AsyncStorage.setItem('checkin_settings', JSON.stringify({ frequencyMinutes: 60 }));
  const s = await SettingsService.load();
  expect(s.frequencyMinutes).toBe(60);
  expect(s.checkInDays).toEqual(DEFAULT_SETTINGS.checkInDays);
});

test('load() returns defaults on corrupt JSON', async () => {
  await AsyncStorage.setItem('checkin_settings', 'not-json');
  const s = await SettingsService.load();
  expect(s).toEqual(DEFAULT_SETTINGS);
});
