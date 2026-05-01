import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SettingsService from '../services/SettingsService';
import { Settings, DAY_LABELS, FREQUENCY_OPTIONS, DEFAULT_SETTINGS } from '../types/Settings';

interface Props {
  onClose: (saved: boolean) => void;
}

export default function SettingsScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    SettingsService.load().then(setSettings);
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
    await SettingsService.save(settings);
    onClose(true);
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
        {/* Check-in days */}
        <Text style={styles.sectionLabel}>CHECK-IN DAYS</Text>
        <View style={styles.card}>
          {DAY_LABELS.map((label, i) => (
            <View key={label} style={[styles.row, i < DAY_LABELS.length - 1 && styles.rowBorder]}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Switch
                value={settings.checkInDays[i]}
                onValueChange={() => toggleDay(i)}
              />
            </View>
          ))}
        </View>

        {/* Working hours */}
        <Text style={styles.sectionLabel}>WORKING HOURS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Every hour (all day)</Text>
            <Switch
              value={settings.everyHour}
              onValueChange={v => setSettings({ ...settings, everyHour: v })}
            />
          </View>
          {!settings.everyHour && (
            <>
              <View style={[styles.row, styles.rowBorder]}>
                <Text style={styles.rowLabel}>Start</Text>
                <View style={styles.hourPicker}>
                  <TouchableOpacity
                    onPress={() =>
                      setSettings({ ...settings, startHour: Math.max(0, settings.startHour - 1) })
                    }>
                    <Text style={styles.stepper}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.hourValue}>
                    {settings.startHour.toString().padStart(2, '0')}:00
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setSettings({
                        ...settings,
                        startHour: Math.min(settings.endHour - 1, settings.startHour + 1),
                      })
                    }>
                    <Text style={styles.stepper}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.row, styles.rowBorder]}>
                <Text style={styles.rowLabel}>End</Text>
                <View style={styles.hourPicker}>
                  <TouchableOpacity
                    onPress={() =>
                      setSettings({
                        ...settings,
                        endHour: Math.max(settings.startHour + 1, settings.endHour - 1),
                      })
                    }>
                    <Text style={styles.stepper}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.hourValue}>
                    {settings.endHour.toString().padStart(2, '0')}:00
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setSettings({ ...settings, endHour: Math.min(24, settings.endHour + 1) })
                    }>
                    <Text style={styles.stepper}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Frequency */}
        <Text style={styles.sectionLabel}>FREQUENCY</Text>
        <View style={styles.card}>
          {FREQUENCY_OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.row, i < FREQUENCY_OPTIONS.length - 1 && styles.rowBorder]}
              onPress={() => setSettings({ ...settings, frequencyMinutes: opt.value })}>
              <Text style={styles.rowLabel}>{opt.label}</Text>
              {settings.frequencyMinutes === opt.value && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
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
  body: { paddingVertical: 24, paddingHorizontal: 16, gap: 8 },
  sectionLabel: {
    fontSize: 12,
    color: '#6d6d72',
    fontWeight: '500',
    marginBottom: 4,
    marginTop: 8,
    marginLeft: 4,
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
  checkmark: { fontSize: 18, color: '#007AFF' },
  hourPicker: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepper: { fontSize: 22, color: '#007AFF', width: 28, textAlign: 'center' },
  hourValue: { fontSize: 16, fontWeight: '500', width: 52, textAlign: 'center' },
});
