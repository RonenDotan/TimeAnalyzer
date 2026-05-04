import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SettingsService from '../services/SettingsService';
import { version } from '../../App';
import {
  ANALYSIS_PROVIDERS,
  DAY_LABELS,
  DEFAULT_SETTINGS,
  FREQUENCY_OPTIONS,
  Settings,
  THEME_OPTIONS,
  TRANSCRIPTION_PROVIDERS,
} from '../types/Settings';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  onClose: (saved: boolean) => void;
}

type SectionKey = 'schedule' | 'providers' | 'keywords' | 'theme';

export default function SettingsScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [groqKey, setGroqKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [expanded, setExpanded] = useState<Set<SectionKey>>(new Set(['schedule']));

  useEffect(() => {
    Promise.all([
      SettingsService.load(),
      SettingsService.getGroqApiKey(),
      SettingsService.getClaudeApiKey(),
      SettingsService.getOpenAIApiKey(),
    ]).then(([s, gk, ck, ok]) => {
      setSettings(s);
      setGroqKey(gk);
      setClaudeKey(ck);
      setOpenaiKey(ok);
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

  async function handleSave() {
    if (!settings) return;
    await Promise.all([
      SettingsService.save(settings),
      SettingsService.setGroqApiKey(groqKey.trim()),
      SettingsService.setClaudeApiKey(claudeKey.trim()),
      SettingsService.setOpenAIApiKey(openaiKey.trim()),
    ]);
    onClose(true);
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

        {/* ── SCHEDULE ─────────────────────────────────────────── */}
        <SectionHeader sectionKey="schedule" title="SCHEDULE" />
        {expanded.has('schedule') && (
          <>
            <Text style={styles.sectionLabel}>FREQUENCY</Text>
            <View style={styles.card}>
              {FREQUENCY_OPTIONS.map((opt, i) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                  onPress={() => set({ frequencyMinutes: opt.value })}>
                  <Text style={styles.rowLabel}>{opt.label}</Text>
                  {settings.frequencyMinutes === opt.value && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>WORKING HOURS</Text>
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
                        <Text style={styles.stepperBtn}>−</Text>
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
                        <Text style={styles.stepperBtn}>−</Text>
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

            <Text style={styles.sectionLabel}>DAILY PLAN</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Daily plan reminder</Text>
                <Switch value={settings.dailyPlanEnabled} onValueChange={v => set({ dailyPlanEnabled: v })} />
              </View>
              {settings.dailyPlanEnabled && (
                <View style={[styles.row, styles.rowBorder]}>
                  <Text style={styles.rowLabel}>Reminder time</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity onPress={() => set({ dailyPlanHour: Math.max(0, settings.dailyPlanHour - 1) })}>
                      <Text style={styles.stepperBtn}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepperVal}>{settings.dailyPlanHour.toString().padStart(2, '0')}:00</Text>
                    <TouchableOpacity onPress={() => set({ dailyPlanHour: Math.min(23, settings.dailyPlanHour + 1) })}>
                      <Text style={styles.stepperBtn}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            <Text style={styles.sectionLabel}>CHECK-IN DAYS</Text>
            <View style={styles.card}>
              {DAY_LABELS.map((label, i) => (
                <View key={label} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Switch value={settings.checkInDays[i]} onValueChange={() => toggleDay(i)} />
                </View>
              ))}
            </View>
          </>
        )}

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
  });
}
