import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleIntegrationState } from '../types/Integrations';

// Replace with your OAuth 2.0 Web Client ID from Google Cloud Console
// https://console.cloud.google.com → APIs & Services → Credentials
const WEB_CLIENT_ID = '115013439807-j9l61ota8h0u4nfp163sm51ios9cacd8.apps.googleusercontent.com';

const STORAGE_KEY = '@google_integration';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

function configure() {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    scopes: [CALENDAR_SCOPE],
    offlineAccess: true, // get refresh token for server-side API calls
  });
}

async function signIn(): Promise<GoogleIntegrationState> {
  configure();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  if (response.type !== 'success') {
    throw new Error('Sign-in cancelled');
  }

  const state: GoogleIntegrationState = {
    connected: true,
    email: response.data.user.email,
    displayName: response.data.user.name,
    scopes: [CALENDAR_SCOPE],
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

async function signOut(): Promise<void> {
  configure();
  await GoogleSignin.signOut();
  await AsyncStorage.removeItem(STORAGE_KEY);
}

async function getState(): Promise<GoogleIntegrationState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { connected: false, email: null, displayName: null, scopes: [] };
  try {
    return JSON.parse(raw) as GoogleIntegrationState;
  } catch {
    return { connected: false, email: null, displayName: null, scopes: [] };
  }
}

async function getAccessToken(): Promise<string | null> {
  configure();
  try {
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken;
  } catch {
    return null;
  }
}

async function isConfigured(): Promise<boolean> {
  return WEB_CLIENT_ID !== 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
}

export function getSignInErrorMessage(error: any): string {
  if (error?.code === statusCodes.SIGN_IN_CANCELLED) return 'Sign-in cancelled.';
  if (error?.code === statusCodes.IN_PROGRESS) return 'Sign-in already in progress.';
  if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'Google Play Services not available.';
  return error?.message ?? 'Unknown error';
}

const GoogleAuthService = {
  configure,
  signIn,
  signOut,
  getState,
  getAccessToken,
  isConfigured,
};

export default GoogleAuthService;
