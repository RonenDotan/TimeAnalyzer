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
import { DayPlan, PlanBlock } from '../types/DayPlan';
import { allMatchingBlocks, isCovered } from '../utils/planMatching';
import { formatMin } from '../utils/parseDayPlan';

interface Props {
  onStartCheckIn: () => void;
  onOpenMenu: () => void;
  onEditPlan?: (date: Date) => void;
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

export default function ReportScreen({ onStartCheckIn, onOpenMenu, onEditPlan, initialDate }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate ?? new Date());
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([]);

  const loadEntries = useCallback(async (date: Date) => {
    setLoading(true);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const [results, plan] = await Promise.all([
      StorageService.getByDateRange(startOfDay(date), endOfDay(date)),
      StorageService.getDayPlan(dateStr),
    ]);
    setEntries(results.sort((a, b) => a.timestampStart - b.timestampStart));
    setDayPlan(plan);
    if (plan) {
      const blocks = await StorageService.getPlanBlocks(plan.id);
      setPlanBlocks(blocks);
    } else {
      setPlanBlocks([]);
    }
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
        <View style={styles.centeredFull}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {/* Plan section — always shown if plan exists */}
          {planBlocks.length > 0 && (() => {
            const coveredCount = planBlocks.filter(b => isCovered(b, entries)).length;
            return (
              <View style={styles.planSection}>
                <TouchableOpacity
                  onPress={() => onEditPlan?.(currentDate)}
                  style={styles.planHeaderRow}>
                  <Text style={styles.planHeader}>PLAN</Text>
                  <Text style={styles.planEditHint}>Edit ›</Text>
                </TouchableOpacity>
                {planBlocks.map(block => {
                  const covered = isCovered(block, entries);
                  return (
                    <View key={block.id} style={styles.planBlock}>
                      <View style={[styles.planDot, covered ? styles.planDotCovered : styles.planDotMissed]} />
                      <Text style={styles.planTime}>{formatMin(block.startMin)}–{formatMin(block.endMin)}</Text>
                      <Text style={[styles.planActivity, !covered && styles.planActivityMissed]}>{block.activity}</Text>
                    </View>
                  );
                })}
                <Text style={styles.planCoverage}>
                  {coveredCount}/{planBlocks.length} blocks covered
                  {coveredCount < planBlocks.length ? `  ·  ${planBlocks.length - coveredCount} missed` : '  ✓'}
                </Text>
              </View>
            );
          })()}

          {/* Entries */}
          {entries.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No entries for this day</Text>
            </View>
          ) : (
            entries.map(entry => {
              const matched = planBlocks.length > 0 ? allMatchingBlocks(entry, planBlocks) : [];
              return (
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
                  {matched.length > 0 && (
                    <Text style={styles.planTag}>→ {matched.map(b => b.activity).join(', ')}</Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
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
    centeredFull: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
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
    planSection: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      gap: 8,
    },
    planHeaderRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2,
    },
    planHeader: {
      fontSize: 11, fontWeight: '700', color: colors.accent, letterSpacing: 0.5,
    },
    planEditHint: { fontSize: 12, color: colors.accent },
    planBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    planDot: { width: 10, height: 10, borderRadius: 5 },
    planDotCovered: { backgroundColor: colors.accent },
    planDotMissed: { backgroundColor: colors.border },
    planTime: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, width: 100 },
    planActivity: { fontSize: 14, color: colors.text, flex: 1 },
    planActivityMissed: { color: colors.textSecondary },
    planCoverage: {
      fontSize: 12, color: colors.textSecondary, marginTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
      paddingTop: 8,
    },
    planTag: { fontSize: 12, color: colors.accent, marginTop: 6, fontWeight: '500' },
  });
}
