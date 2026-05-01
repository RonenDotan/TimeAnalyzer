import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings, DEFAULT_SETTINGS } from '../types/Settings';

const KEY = 'checkin_settings';

async function load(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function save(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}

const SettingsService = { load, save };
export default SettingsService;
