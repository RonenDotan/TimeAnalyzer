import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CalendarSyncService from '../services/CalendarSyncService';
import DevSeedService from '../services/DevSeedService';
import GoogleAuthService, { getSignInErrorMessage } from '../services/GoogleAuthService';
import SettingsService from '../services/SettingsService';
import SchedulerService from '../services/SchedulerService';
import { GoogleIntegrationState } from '../types/Integrations';
import { version } from '../../App';
import {
  ANALYSIS_PROVIDERS,
  DAY_LABELS,
  DEFAULT_SETTINGS,
  Settings,
  SYNC_INTERVAL_OPTIONS,
  THEME_OPTIONS,
  TRANSCRIPTION_PROVIDERS,
} from '../types/Settings';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  onClose: (saved: boolean) => void;
}

type SectionKey = 'providers' | 'keywords' | 'theme' | 'notifications' | 'integrations' | 'debug' | 'debugNotifications';

export default function SettingsScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [groqKey, setGroqKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [expanded, setExpanded] = useState<Set<SectionKey>>(new Set());
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [googleState, setGoogleState] = useState<GoogleIntegrationState | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    Promise.all([
      SettingsService.load(),
      SettingsService.getGroqApiKey(),
      SettingsService.getClaudeApiKey(),
      SettingsService.getOpenAIApiKey(),
      GoogleAuthService.getState(),
    ]).then(([s, gk, ck, ok, gs]) => {
      setSettings(s);
      setGroqKey(gk);
      setClaudeKey(ck);
      setOpenaiKey(ok);
      setGoogleState(gs);
    });
  }, []);

  if (!settings) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  function toggleSection(key: SectionKey) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleDay(i: number) {
    if (!settings) return;
    const days = [...settings.checkInDays] as Settings['checkInDays'];
    days[i] = !days[i];
    setSettings({ ...settings, checkInDays: days });
  }

  function setFrequencyHours(value: string) {
    const numeric = value.replace(/[^0-9]/g, '');
    const hours = Number(numeric);
    if (!numeric || !Number.isFinite(hours) || hours < 1) {
      set({ frequencyMinutes: 60 });
      return;
    }
    set({ frequencyMinutes: hours * 60 });
  }

  async function handleGoogleSignIn() {
    setSigningIn(true);
    try {
      const state = await GoogleAuthService.signIn();
      setGoogleState(state);
      CalendarSyncService.hardSync().catch(() => {});
    } catch (e: any) {
      Alert.alert('Sign-in failed', getSignInErrorMessage(e));
    } finally {
      setSigningIn(false);
    }
  }

  async function handleGoogleSignOut() {
    Alert.alert(
      'Disconnect Google',
      'Check-ins and plans will no longer sync to Google Calendar.',
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
      'Re-push all check-ins and plans to Google Calendar. Continue?',
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

  async function handleSave() {
    if (!settings) return;
    const settingsToSave = { ...settings, dailyPlanEnabled: true };
    await Promise.all([
      SettingsService.save(settingsToSave),
      SettingsService.setGroqApiKey(groqKey.trim()),
      SettingsService.setClaudeApiKey(claudeKey.trim()),
      SettingsService.setOpenAIApiKey(openaiKey.trim()),
    ]);
    onClose(true);
  }

  async function handleSeedDemoData() {
    if (!settings) return;
    Alert.alert(
      'Seed Mock Data',
      'This clears existing entries, goals, plans, notes, and daily summaries, then inserts a software engineer demo day.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear and Seed',
          style: 'destructive',
          onPress: async () => {
            setSeeding(true);
            try {
              const result = await DevSeedService.seedSoftwareEngineerDemo(settings.debugMode);
              Alert.alert(
                result.seeded ? 'Seed complete' : 'Seed skipped',
                result.seeded ? 'Mock software engineer data was added.' : (result.reason ?? 'No data was added.'),
              );
            } catch (e: any) {
              Alert.alert('Seed failed', e?.message ?? String(e));
            } finally {
              setSeeding(false);
            }
          },
        },
      ],
    );
  }

  const set = (patch: Partial<Settings>) => setSettings(s => ({ ...(s ?? DEFAULT_SETTINGS), ...patch }));
  const styles = makeStyles(colors);

  function SectionHeader({ sectionKey, title }: { sectionKey: SectionKey; title: string }) {
    const open = expanded.has(sectionKey);
    return (
      <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(sectionKey)}>
        <Text style={styles.sectionHeaderText}>{title}</Text>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onClose(false)}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.save}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>

{/* ── PROVIDERS ────────────────────────────────────────── */}
        <SectionHeader sectionKey="providers" title="PROVIDERS" />
        {expanded.has('providers') && (
          <>
            <Text style={styles.sectionLabel}>TRANSCRIPTION</Text>
            <View style={styles.card}>
              {TRANSCRIPTION_PROVIDERS.map((p, i) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                  onPress={() => set({ transcriptionProvider: p.value })}>
                  <View>
                    <Text style={styles.rowLabel}>{p.label}</Text>
                    <Text style={styles.rowSub}>{p.sublabel}</Text>
                  </View>
                  {settings.transcriptionProvider === p.value && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
              {settings.transcriptionProvider === 'groq' && (
                <View style={[styles.row, styles.rowBorder]}>
                  <Text style={styles.keyLabel}>API Key</Text>
                  <TextInput
                    style={styles.keyInput}
                    value={groqKey}
                    onChangeText={setGroqKey}
                    placeholder="gsk_..."
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                </View>
              )}
            </View>

            <Text style={styles.sectionLabel}>ANALYSIS</Text>
            <View style={styles.card}>
              {ANALYSIS_PROVIDERS.map((p, i) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                  onPress={() => set({ analysisProvider: p.value })}>
                  <View>
                    <Text style={styles.rowLabel}>{p.label}</Text>
                    <Text style={styles.rowSub}>{p.sublabel}</Text>
                  </View>
                  {settings.analysisProvider === p.value && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
              <View style={styles.rowBorder}>
                {settings.analysisProvider === 'claude' && (
                  <View style={styles.row}>
                    <Text style={styles.keyLabel}>API Key</Text>
                    <TextInput
                      style={styles.keyInput}
                      value={claudeKey}
                      onChangeText={setClaudeKey}
                      placeholder="sk-ant-..."
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                    />
                  </View>
                )}
                {settings.analysisProvider === 'openai' && (
                  <View style={styles.row}>
                    <Text style={styles.keyLabel}>API Key</Text>
                    <TextInput
                      style={styles.keyInput}
                      value={openaiKey}
                      onChangeText={setOpenaiKey}
                      placeholder="sk-..."
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                    />
                  </View>
                )}
              </View>
            </View>
          </>
        )}

        {/* ── KEYWORDS ─────────────────────────────────────────── */}
        <SectionHeader sectionKey="keywords" title="KEYWORDS" />
        {expanded.has('keywords') && (
          <>
            <Text style={styles.sectionLabel}>VOICE COMMANDS</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View>
                  <Text style={styles.rowLabel}>Note keyword</Text>
                  <Text style={styles.rowSub}>Splits speech into a new note</Text>
                </View>
                <TextInput
                  style={styles.keywordInput}
                  value={settings.noteKeyword}
                  onChangeText={v => set({ noteKeyword: v.toLowerCase().trim() || 'note' })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />
              </View>
              <View style={[styles.row, styles.rowBorder]}>
                <View>
                  <Text style={styles.rowLabel}>Append keyword</Text>
                  <Text style={styles.rowSub}>Appends dictation to existing text</Text>
                </View>
                <TextInput
                  style={styles.keywordInput}
                  value={settings.appendKeyword}
                  onChangeText={v => set({ appendKeyword: v.toLowerCase().trim() || 'append' })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />
              </View>
            </View>
          </>
        )}

        {/* ── THEME ────────────────────────────────────────────── */}
        <SectionHeader sectionKey="theme" title="THEME" />
        {expanded.has('theme') && (
          <>
            <Text style={styles.sectionLabel}>APPEARANCE</Text>
            <View style={styles.card}>
              {THEME_OPTIONS.map((opt, i) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                  onPress={() => set({ theme: opt.value })}>
                  <View>
                    <Text style={styles.rowLabel}>{opt.label}</Text>
                    <Text style={styles.rowSub}>{opt.sublabel}</Text>
                  </View>
                  {settings.theme === opt.value && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── NOTIFICATIONS ────────────────────────────────────── */}
        <SectionHeader sectionKey="notifications" title="NOTIFICATIONS" />
        {expanded.has('notifications') && (
          <>
            <Text style={styles.sectionLabel}>DIAGNOSTICS</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.row}
                onPress={async () => {
                  try {
                    const ns = await SchedulerService.getNotificationDiagnostics();
                    Alert.alert(
                      'Notification Status',
                      ns,
                      [
                        { text: 'OK' },
                        { text: 'Open Alarm Settings', onPress: () => SchedulerService.openAlarmSettings() },
                        { text: 'Open App Settings', onPress: () => SchedulerService.openAppSettings() },
                      ],
                    );
                  } catch (e: any) {
                    Alert.alert('Error', String(e?.message ?? e));
                  }
                }}>
                <Text style={styles.rowLabel}>Run full diagnostic</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.row, styles.rowBorder]}
                onPress={async () => {
                  try {
                    const report = await SchedulerService.rescheduleWithReport();
                    Alert.alert('Reschedule result', report);
                  } catch (e: any) {
                    Alert.alert('Failed', String(e?.message ?? e));
                  }
                }}>
                <Text style={styles.rowLabel}>Reschedule now</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.row, styles.rowBorder]}
                onPress={async () => {
                  try {
                    await SchedulerService.sendTestNotification();
                    Alert.alert('Fired', 'Check your notification shade (pull down from top).');
                  } catch (e: any) {
                    Alert.alert('Failed', String(e?.message ?? e));
                  }
                }}>
                <Text style={styles.rowLabel}>Send test notification</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.row, styles.rowBorder]}
                onPress={async () => {
                  const count = await SchedulerService.getPendingCount();
                  setPendingCount(count);
                }}>
                <Text style={styles.rowLabel}>Scheduled notifications</Text>
                <Text style={[styles.rowLabel, { color: colors.accent }]}>
                  {pendingCount === null ? 'tap to check' : `${pendingCount} pending`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.row, styles.rowBorder]}
                onPress={() => SchedulerService.openAlarmSettings()}>
                <Text style={styles.rowLabel}>Open alarm settings</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.row, styles.rowBorder]}
                onPress={() => SchedulerService.openAppSettings()}>
                <Text style={styles.rowLabel}>Open app notification settings</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── INTEGRATIONS ─────────────────────────────────────── */}
        <SectionHeader sectionKey="integrations" title="INTEGRATIONS" />
        {expanded.has('integrations') && (
          <>
            <Text style={styles.sectionLabel}>GOOGLE CALENDAR</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Google Calendar</Text>
                  {googleState?.email && (
                    <Text style={styles.rowSub}>{googleState.email}</Text>
                  )}
                </View>
                {googleState === null ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : googleState.connected ? (
                  <View style={styles.connectedBadge}>
                    <Text style={styles.connectedBadgeText}>Connected</Text>
                  </View>
                ) : (
                  <Text style={[styles.rowSub, { color: colors.placeholder }]}>Not connected</Text>
                )}
              </View>
              {googleState?.connected && (
                <>
                  <View style={[styles.row, styles.rowBorder]}>
                    <TouchableOpacity
                      style={[styles.syncActionBtn, syncing && styles.syncActionBtnDim]}
                      onPress={handleSyncNow}
                      disabled={syncing}>
                      {syncing
                        ? <ActivityIndicator size="small" color={colors.accent} />
                        : <Text style={styles.syncActionBtnText}>Sync now</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.syncActionBtn, syncing && styles.syncActionBtnDim]}
                      onPress={handleHardSync}
                      disabled={syncing}>
                      <Text style={styles.syncActionBtnText}>Hard sync</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.disconnectBtn}
                      onPress={handleGoogleSignOut}>
                      <Text style={styles.disconnectBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {!googleState?.connected && (
                <View style={[styles.row, styles.rowBorder]}>
                  <TouchableOpacity
                    style={[styles.connectBtn, signingIn && styles.connectBtnDim]}
                    onPress={handleGoogleSignIn}
                    disabled={signingIn}>
                    {signingIn
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.connectBtnText}>Sign in with Google</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text style={styles.sectionLabel}>SYNC INTERVAL</Text>
            <View style={styles.card}>
              {SYNC_INTERVAL_OPTIONS.map((opt, i) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                  onPress={() => set({ calendarSyncIntervalMinutes: opt.value })}>
                  <View>
                    <Text style={styles.rowLabel}>{opt.label}</Text>
                    <Text style={styles.rowSub}>{opt.sublabel}</Text>
                  </View>
                  {settings.calendarSyncIntervalMinutes === opt.value && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Debug section */}
        <SectionHeader sectionKey="debug" title="DEBUG" />
        {expanded.has('debug') && (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => set({ debugMode: !settings.debugMode })}>
              <View>
                <Text style={styles.rowLabel}>Debug mode</Text>
                <Text style={styles.rowSub}>Show sync fields on each entry</Text>
              </View>
              {settings.debugMode && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            {settings.debugMode && (
              <TouchableOpacity
                style={[styles.row, styles.rowBorder]}
                onPress={handleSeedDemoData}
                disabled={seeding}>
                <View>
                  <Text style={styles.rowLabel}>Seed Mock Data</Text>
                  <Text style={styles.rowSub}>Emulator-only software engineer dataset</Text>
                </View>
                {seeding
                  ? <ActivityIndicator size="small" color={colors.accent} />
                  : <Text style={styles.chevron}>›</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {settings.debugMode && (
          <>
            <SectionHeader sectionKey="debugNotifications" title="DEBUG NOTIFICATIONS" />
            {expanded.has('debugNotifications') && (
              <>
                <Text style={styles.sectionLabel}>NOTIFICATION DAYS</Text>
                <View style={styles.card}>
                  {DAY_LABELS.map((label, i) => (
                    <View key={label} style={[styles.row, i > 0 && styles.rowBorder]}>
                      <Text style={styles.rowLabel}>{label}</Text>
                      <Switch value={settings.checkInDays[i]} onValueChange={() => toggleDay(i)} />
                    </View>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>NOTIFICATION HOURS</Text>
                <View style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>All day</Text>
                    <Switch value={settings.everyHour} onValueChange={v => set({ everyHour: v })} />
                  </View>
                  {!settings.everyHour && (
                    <>
                      <View style={[styles.row, styles.rowBorder]}>
                        <Text style={styles.rowLabel}>Start</Text>
                        <View style={styles.stepper}>
                          <TouchableOpacity onPress={() => set({ startHour: Math.max(0, settings.startHour - 1) })}>
                            <Text style={styles.stepperBtn}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.stepperVal}>{settings.startHour.toString().padStart(2, '0')}:00</Text>
                          <TouchableOpacity onPress={() => set({ startHour: Math.min(settings.endHour - 1, settings.startHour + 1) })}>
                            <Text style={styles.stepperBtn}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={[styles.row, styles.rowBorder]}>
                        <Text style={styles.rowLabel}>End</Text>
                        <View style={styles.stepper}>
                          <TouchableOpacity onPress={() => set({ endHour: Math.max(settings.startHour + 1, settings.endHour - 1) })}>
                            <Text style={styles.stepperBtn}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.stepperVal}>{settings.endHour.toString().padStart(2, '0')}:00</Text>
                          <TouchableOpacity onPress={() => set({ endHour: Math.min(24, settings.endHour + 1) })}>
                            <Text style={styles.stepperBtn}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}
                </View>

                <Text style={styles.sectionLabel}>CHECK-IN FREQUENCY</Text>
                <View style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Check-in frequency</Text>
                    <View style={styles.numericInputGroup}>
                      <TextInput
                        style={styles.numericInput}
                        value={String(Math.max(1, Math.round(settings.frequencyMinutes / 60)))}
                        onChangeText={setFrequencyHours}
                        keyboardType="number-pad"
                        returnKeyType="done"
                      />
                      <Text style={styles.rowSub}>hours</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>DAILY PLAN</Text>
                <View style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Plan notification time</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity onPress={() => set({ dailyPlanHour: Math.max(0, settings.dailyPlanHour - 1) })}>
                        <Text style={styles.stepperBtn}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{settings.dailyPlanHour.toString().padStart(2, '0')}:00</Text>
                      <TouchableOpacity onPress={() => set({ dailyPlanHour: Math.min(23, settings.dailyPlanHour + 1) })}>
                        <Text style={styles.stepperBtn}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </>
            )}
          </>
        )}

        <Text style={styles.versionText}>{version}</Text>
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
    cancel: { fontSize: 17, color: colors.textSecondary },
    save: { fontSize: 17, color: colors.accent, fontWeight: '600' },
    body: { paddingVertical: 8, paddingHorizontal: 16, gap: 6, paddingBottom: 40 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 4,
      marginTop: 8,
    },
    sectionHeaderText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
      letterSpacing: 0.5,
    },
    chevron: { fontSize: 11, color: colors.accent },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 4,
      marginTop: 6,
      marginLeft: 4,
      letterSpacing: 0.3,
    },
    card: { backgroundColor: colors.surface, borderRadius: 10, overflow: 'hidden' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 48,
    },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    rowLabel: { fontSize: 16, color: colors.text },
    rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    checkmark: { fontSize: 18, color: colors.accent },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    stepperBtn: { fontSize: 22, color: colors.accent, width: 28, textAlign: 'center' },
    stepperVal: { fontSize: 16, fontWeight: '500', width: 52, textAlign: 'center', color: colors.text },
    keyLabel: { fontSize: 15, color: colors.textSecondary, width: 64 },
    keyInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontFamily: 'monospace',
      paddingVertical: 4,
      textAlign: 'right',
    },
    connectedBadge: {
      backgroundColor: colors.accent + '22',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    connectedBadgeText: { fontSize: 11, color: colors.accent, fontWeight: '600' },
    syncActionBtn: {
      borderWidth: 1,
      borderColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 7,
    },
    syncActionBtnDim: { opacity: 0.5 },
    syncActionBtnText: { fontSize: 13, color: colors.accent, fontWeight: '500' },
    connectBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    connectBtnDim: { opacity: 0.6 },
    connectBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
    disconnectBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 7,
    },
    disconnectBtnText: { fontSize: 13, color: colors.textSecondary },
    versionText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingTop: 24,
      paddingBottom: 8,
    },
    keywordInput: {
      fontSize: 15,
      color: colors.accent,
      fontWeight: '500',
      minWidth: 80,
      textAlign: 'right',
      borderBottomWidth: 1,
      borderBottomColor: colors.accent,
      paddingVertical: 2,
    },
    numericInputGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    numericInput: {
      fontSize: 16,
      color: colors.accent,
      fontWeight: '600',
      minWidth: 48,
      textAlign: 'right',
      borderBottomWidth: 1,
      borderBottomColor: colors.accent,
      paddingVertical: 2,
    },
  });
}
