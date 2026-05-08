import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings, DEFAULT_SETTINGS } from '../types/Settings';

const SETTINGS_KEY = 'checkin_settings';
const GROQ_KEY = 'groq_api_key';
const CLAUDE_KEY = 'claude_api_key';
const OPENAI_KEY = 'openai_api_key';
const CALENDAR_COLOR_KEY = 'calendar_color';

export const DEFAULT_CALENDAR_COLOR = '#7986CB';

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

async function getClaudeApiKey(): Promise<string> {
  const stored = await AsyncStorage.getItem(CLAUDE_KEY);
  if (stored) return stored;
  try {
    const { CLAUDE_API_KEY } = require('../secrets.local');
    return CLAUDE_API_KEY ?? '';
  } catch {
    return '';
  }
}

async function setClaudeApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(CLAUDE_KEY, key);
}

async function getOpenAIApiKey(): Promise<string> {
  const stored = await AsyncStorage.getItem(OPENAI_KEY);
  if (stored) return stored;
  try {
    const { OPENAI_API_KEY } = require('../secrets.local');
    return OPENAI_API_KEY ?? '';
  } catch {
    return '';
  }
}

async function setOpenAIApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(OPENAI_KEY, key);
}

async function getCalendarColor(): Promise<string> {
  const stored = await AsyncStorage.getItem(CALENDAR_COLOR_KEY);
  return stored ?? DEFAULT_CALENDAR_COLOR;
}

async function setCalendarColor(color: string): Promise<void> {
  await AsyncStorage.setItem(CALENDAR_COLOR_KEY, color);
}

const SettingsService = {
  load,
  save,
  getGroqApiKey,
  setGroqApiKey,
  getClaudeApiKey,
  setClaudeApiKey,
  getOpenAIApiKey,
  setOpenAIApiKey,
  getCalendarColor,
  setCalendarColor,
};
export default SettingsService;
