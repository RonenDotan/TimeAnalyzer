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
import StorageService from '../services/StorageService';
import { LogEntry } from '../types/LogEntry';

interface Props {
  onClose: () => void;
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

export default function ReportScreen({ onClose, initialDate }: Props) {
  const insets = useSafeAreaInsets();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate ?? new Date());
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeBtn}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Report</Text>
        <View style={styles.closePlaceholder} />
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
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No entries for this day</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {entries.map(entry => (
            <View key={entry.id} style={styles.entryCard}>
              <Text style={styles.timeRange}>
                {formatTime(entry.timestampStart)} – {formatTime(entry.timestampEnd)}
              </Text>
              <Text style={styles.transcript}>{entry.transcript}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
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
  headerTitle: { fontSize: 17, fontWeight: '600' },
  closeBtn: { fontSize: 17, color: '#007AFF' },
  closePlaceholder: { width: 50 },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 28, color: '#007AFF', fontWeight: '300' },
  navArrowDisabled: { color: '#ccc' },
  dayLabel: { fontSize: 16, fontWeight: '600', color: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#6d6d72' },
  list: { padding: 16, gap: 12 },
  entryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  timeRange: { fontSize: 14, fontWeight: '700', color: '#007AFF', marginBottom: 8 },
  transcript: { fontSize: 15, color: '#000', lineHeight: 22 },
});
