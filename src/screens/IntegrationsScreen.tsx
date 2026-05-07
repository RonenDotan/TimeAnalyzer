import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CalendarSyncService from '../services/CalendarSyncService';
import GoogleAuthService, { getSignInErrorMessage } from '../services/GoogleAuthService';
import { GoogleIntegrationState } from '../types/Integrations';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  onClose: () => void;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  available: boolean;
  comingSoon?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'google',
    name: 'Google',
    description: 'Sync check-ins and daily plans with Google Calendar',
    icon: '📅',
    available: true,
  },
  {
    id: 'outlook',
    name: 'Outlook / Microsoft 365',
    description: 'Sync with Outlook Calendar',
    icon: '📧',
    available: false,
    comingSoon: 'Coming soon',
  },
  {
    id: 'apple',
    name: 'Apple Calendar',
    description: 'Sync with iCloud Calendar',
    icon: '🍎',
    available: false,
    comingSoon: 'iOS only',
  },
];

export default function IntegrationsScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [googleState, setGoogleState] = useState<GoogleIntegrationState | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const styles = makeStyles(colors);

  useEffect(() => {
    GoogleAuthService.getState().then(setGoogleState);
  }, []);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    try {
      const state = await GoogleAuthService.signIn();
      setGoogleState(state);
      // Hard sync on first sign-in to push all existing data to calendar
      CalendarSyncService.hardSync().catch(() => {});
    } catch (e: any) {
      Alert.alert('Sign-in failed', getSignInErrorMessage(e));
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      await CalendarSyncService.syncChanged();
    } catch (e: any) {
      Alert.alert('Sync failed', e?.message ?? String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function handleHardSync() {
    Alert.alert(
      'Hard Sync',
      'This will re-push all check-ins and plans to Google Calendar. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync All',
          onPress: async () => {
            setSyncing(true);
            try {
              await CalendarSyncService.hardSync();
            } catch (e: any) {
              Alert.alert('Sync failed', e?.message ?? String(e));
            } finally {
              setSyncing(false);
            }
          },
        },
      ],
    );
  }

  async function handleGoogleSignOut() {
    Alert.alert(
      'Disconnect Google',
      'This will remove your Google account from TimeAnalyzer. Check-ins and plans will no longer sync to Google Calendar.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await GoogleAuthService.signOut();
              setGoogleState({ connected: false, email: null, displayName: null, scopes: [] });
            } catch (e: any) {
              Alert.alert('Sign-out failed', e?.message ?? String(e));
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Integrations</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionLabel}>CONNECTED ACCOUNTS</Text>

        {INTEGRATIONS.map((integration, i) => {
          const isGoogle = integration.id === 'google';
          const connected = isGoogle && googleState?.connected;

          return (
            <View key={integration.id} style={[styles.card, i > 0 && styles.cardGap]}>
              <View style={styles.integrationHeader}>
                <Text style={styles.icon}>{integration.icon}</Text>
                <View style={styles.integrationInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.integrationName}>{integration.name}</Text>
                    {connected && (
                      <View style={styles.connectedBadge}>
                        <Text style={styles.connectedBadgeText}>Connected</Text>
                      </View>
                    )}
                    {!integration.available && (
                      <View style={styles.soonBadge}>
                        <Text style={styles.soonBadgeText}>{integration.comingSoon}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.integrationDesc}>{integration.description}</Text>
                  {isGoogle && connected && googleState?.email && (
                    <Text style={styles.accountEmail}>{googleState.email}</Text>
                  )}
                </View>
              </View>

              {integration.available && (
                <View style={styles.actionRow}>
                  {isGoogle && !googleState ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : isGoogle && connected ? (
                    <View style={styles.syncRow}>
                      <TouchableOpacity
                        style={[styles.syncBtn, syncing && styles.syncBtnDim]}
                        onPress={handleSyncNow}
                        disabled={syncing}>
                        {syncing ? (
                          <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                          <Text style={styles.syncBtnText}>Sync now</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.syncBtn, syncing && styles.syncBtnDim]}
                        onPress={handleHardSync}
                        disabled={syncing}>
                        <Text style={styles.syncBtnText}>Hard sync</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.disconnectBtn} onPress={handleGoogleSignOut}>
                        <Text style={styles.disconnectBtnText}>Disconnect</Text>
                      </TouchableOpacity>
                    </View>
                  ) : isGoogle ? (
                    <TouchableOpacity
                      style={[styles.connectBtn, signingIn && styles.connectBtnDim]}
                      onPress={handleGoogleSignIn}
                      disabled={signingIn}>
                      {signingIn ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.connectBtnText}>Sign in with Google</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          );
        })}

      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 17, fontWeight: '600', color: colors.text },
    back: { fontSize: 17, color: colors.accent, width: 60 },
    body: { padding: 16, gap: 0, paddingBottom: 40 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 8,
      marginLeft: 4,
      letterSpacing: 0.3,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      gap: 12,
    },
    cardGap: { marginTop: 10 },
    integrationHeader: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
    icon: { fontSize: 32, marginTop: 2 },
    integrationInfo: { flex: 1, gap: 4 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    integrationName: { fontSize: 16, fontWeight: '600', color: colors.text },
    integrationDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    accountEmail: { fontSize: 13, color: colors.accent, marginTop: 2 },
    connectedBadge: {
      backgroundColor: colors.accent + '22',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    connectedBadgeText: { fontSize: 11, color: colors.accent, fontWeight: '600' },
    soonBadge: {
      backgroundColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    soonBadgeText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
    actionRow: { alignItems: 'flex-start' },
    syncRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    syncBtn: {
      borderWidth: 1,
      borderColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    syncBtnDim: { opacity: 0.5 },
    syncBtnText: { fontSize: 14, color: colors.accent, fontWeight: '500' },
    connectBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      minWidth: 160,
      alignItems: 'center',
    },
    connectBtnDim: { opacity: 0.6 },
    connectBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
    disconnectBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    disconnectBtnText: { fontSize: 15, color: colors.textSecondary },
    setupNote: {
      marginTop: 24,
      padding: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      gap: 8,
    },
    setupNoteTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    setupNoteText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    setupNoteCode: { fontFamily: 'monospace', fontSize: 12, color: colors.accent },
  });
}
