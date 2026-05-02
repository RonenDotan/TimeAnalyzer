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
import {
  ANALYSIS_PROVIDERS,
  DAY_LABELS,
  DEFAULT_SETTINGS,
  FREQUENCY_OPTIONS,
  Settings,
  TRANSCRIPTION_PROVIDERS,
} from '../types/Settings';

interface Props {
  onClose: (saved: boolean) => void;
}

export default function SettingsScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [groqKey, setGroqKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');

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
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
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
        <Text style={styles.groupHeader}>SCHEDULE</Text>

        <Text style={styles.sectionLabel}>FREQUENCY</Text>
        <View style={styles.card}>
          {FREQUENCY_OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.row, i > 0 && styles.rowBorder]}
              onPress={() => set({ frequencyMinutes: opt.value })}>
              <Text style={styles.rowLabel}>{opt.label}</Text>
              {settings.frequencyMinutes === opt.value && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>WORKING HOURS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>All day</Text>
            <Switch
              value={settings.everyHour}
              onValueChange={v => set({ everyHour: v })}
            />
          </View>
          {!settings.everyHour && (
            <>
              <View style={[styles.row, styles.rowBorder]}>
                <Text style={styles.rowLabel}>Start</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    onPress={() => set({ startHour: Math.max(0, settings.startHour - 1) })}>
                    <Text style={styles.stepperBtn}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperVal}>
                    {settings.startHour.toString().padStart(2, '0')}:00
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      set({ startHour: Math.min(settings.endHour - 1, settings.startHour + 1) })
                    }>
                    <Text style={styles.stepperBtn}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.row, styles.rowBorder]}>
                <Text style={styles.rowLabel}>End</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    onPress={() =>
                      set({ endHour: Math.max(settings.startHour + 1, settings.endHour - 1) })
                    }>
                    <Text style={styles.stepperBtn}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperVal}>
                    {settings.endHour.toString().padStart(2, '0')}:00
                  </Text>
                  <TouchableOpacity
                    onPress={() => set({ endHour: Math.min(24, settings.endHour + 1) })}>
                    <Text style={styles.stepperBtn}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
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

        {/* ── PROVIDERS ────────────────────────────────────────── */}
        <Text style={[styles.groupHeader, styles.groupHeaderSpaced]}>PROVIDERS</Text>

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
              {settings.transcriptionProvider === p.value && (
                <Text style={styles.checkmark}>✓</Text>
              )}
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
                placeholderTextColor="#aaa"
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
              {settings.analysisProvider === p.value && (
                <Text style={styles.checkmark}>✓</Text>
              )}
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
                  placeholderTextColor="#aaa"
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
                  placeholderTextColor="#aaa"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </View>
            )}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  title: { fontSize: 17, fontWeight: '600' },
  cancel: { fontSize: 17, color: '#666' },
  save: { fontSize: 17, color: '#007AFF', fontWeight: '600' },
  body: { paddingVertical: 20, paddingHorizontal: 16, gap: 6, paddingBottom: 40 },
  groupHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 2,
    letterSpacing: 0.5,
  },
  groupHeaderSpaced: { marginTop: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6d6d72',
    marginBottom: 4,
    marginTop: 10,
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  rowLabel: { fontSize: 16, color: '#000' },
  rowSub: { fontSize: 12, color: '#8e8e93', marginTop: 2 },
  checkmark: { fontSize: 18, color: '#007AFF' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepperBtn: { fontSize: 22, color: '#007AFF', width: 28, textAlign: 'center' },
  stepperVal: { fontSize: 16, fontWeight: '500', width: 52, textAlign: 'center' },
  keyLabel: { fontSize: 15, color: '#6d6d72', width: 64 },
  keyInput: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    fontFamily: 'monospace',
    paddingVertical: 4,
    textAlign: 'right',
  },
});
