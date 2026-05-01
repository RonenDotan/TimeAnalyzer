import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings, DEFAULT_SETTINGS } from '../types/Settings';

const SETTINGS_KEY = 'checkin_settings';
const GROQ_KEY = 'groq_api_key';

async function load(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function save(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

async function getGroqApiKey(): Promise<string> {
  const stored = await AsyncStorage.getItem(GROQ_KEY);
  if (stored) return stored;
  // Fall back to local secrets file (gitignored)
  try {
    const { GROQ_API_KEY } = require('../secrets.local');
    return GROQ_API_KEY ?? '';
  } catch {
    return '';
  }
}

async function setGroqApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(GROQ_KEY, key);
}

const SettingsService = { load, save, getGroqApiKey, setGroqApiKey };
export default SettingsService;
