import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EntryDetailScreen from './EntryDetailScreen';
import StorageService from '../services/StorageService';
import { LogEntry } from '../types/LogEntry';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  onStartCheckIn: () => void;
  onOpenMenu: () => void;
  initialDate?: Date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export default function ReportScreen({ onStartCheckIn, onOpenMenu, initialDate }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate ?? new Date());
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);

  const loadEntries = useCallback(async (date: Date) => {
    setLoading(true);
    const results = await StorageService.getByDateRange(startOfDay(date), endOfDay(date));
    setEntries(results.sort((a, b) => a.timestampStart - b.timestampStart));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEntries(currentDate);
  }, [currentDate, loadEntries]);

  function goToPrevDay() {
    setCurrentDate(d => new Date(d.getTime() - 86_400_000));
  }

  function goToNextDay() {
    setCurrentDate(d => new Date(d.getTime() + 86_400_000));
  }

  const canGoForward = !isToday(currentDate);
  const styles = makeStyles(colors);

  function handleEntrySaved(updated: LogEntry) {
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    setSelectedEntry(null);
  }

  if (selectedEntry) {
    return (
      <EntryDetailScreen
        entry={selectedEntry}
        onSave={handleEntrySaved}
        onClose={() => setSelectedEntry(null)}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onOpenMenu} style={styles.menuBtn}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.appTitle}>TimeAnalyzer</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.dayNav}>
        <TouchableOpacity onPress={goToPrevDay} style={styles.navBtn}>
          <Text style={styles.navArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.dayLabel}>{formatDayHeader(currentDate)}</Text>
        <TouchableOpacity
          onPress={goToNextDay}
          style={styles.navBtn}
          disabled={!canGoForward}>
          <Text style={[styles.navArrow, !canGoForward && styles.navArrowDisabled]}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No entries for this day</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {entries.map(entry => (
            <TouchableOpacity
              key={entry.id}
              style={styles.entryCard}
              onPress={() => setSelectedEntry(entry)}>
              <View style={styles.entryCardHeader}>
                <Text style={styles.timeRange}>
                  {formatTime(entry.timestampStart)} – {formatTime(entry.timestampEnd)}
                </Text>
                <Text style={styles.entryId}>#{entry.id}</Text>
              </View>
              <Text style={styles.transcript}>{entry.transcript}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={onStartCheckIn}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    menuBtn: { padding: 4, width: 36 },
    menuIcon: { fontSize: 22, color: colors.accent },
    appTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    topBarSpacer: { width: 36 },
    dayNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    navBtn: { padding: 8 },
    navArrow: { fontSize: 28, color: colors.accent, fontWeight: '300' },
    navArrowDisabled: { color: colors.border },
    dayLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: 16, color: colors.textSecondary },
    list: { padding: 16, gap: 12, paddingBottom: 100 },
    entryCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    entryId: { fontSize: 11, color: colors.border, fontWeight: '500' },
    entryCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    timeRange: { fontSize: 14, fontWeight: '700', color: colors.accent },
    transcript: { fontSize: 15, color: colors.text, lineHeight: 22 },
    fab: {
      position: 'absolute',
      right: 24,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.accent,
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 8,
    },
    fabIcon: { fontSize: 32, color: '#fff', lineHeight: 36 },
  });
}
