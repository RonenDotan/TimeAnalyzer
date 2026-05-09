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
import GoalsService from '../services/GoalsService';
import { LogEntry } from '../types/LogEntry';
import { Goal } from '../types/Goal';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';
import { DayPlan, PlanBlock } from '../types/DayPlan';
import { allMatchingBlocks, isCovered } from '../utils/planMatching';
import { formatMin } from '../utils/parseDayPlan';

interface Props {
  onStartCheckIn: () => void;
  onOpenMenu: () => void;
  onEditPlan?: (date: Date) => void;
  initialDate?: Date;
  debugMode?: boolean;
  calendarColor?: string;
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

export default function ReportScreen({ onStartCheckIn, onOpenMenu, onEditPlan, initialDate, debugMode = false, calendarColor = '#7986CB' }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate ?? new Date());
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  const loadEntries = useCallback(async (date: Date) => {
    setLoading(true);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const [results, plan, calBlocks, loadedGoals] = await Promise.all([
      StorageService.getByDateRange(startOfDay(date), endOfDay(date)),
      StorageService.getDayPlan(dateStr),
      StorageService.getCalendarPlanBlocksByDate(dateStr),
      GoalsService.getActiveGoals(startOfDay(date).getTime()),
    ]);
    setEntries(results.sort((a, b) => a.timestampStart - b.timestampStart));
    setDayPlan(plan);
    setGoals(loadedGoals);
    if (plan) {
      const appBlocks = await StorageService.getPlanBlocks(plan.id);
      setPlanBlocks([...appBlocks, ...calBlocks].sort((a, b) => a.startMin - b.startMin));
    } else {
      setPlanBlocks(calBlocks.sort((a, b) => a.startMin - b.startMin));
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
  const styles = makeStyles(colors, calendarColor);

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
          {/* Active goals */}
          {goals.length > 0 && (
            <View style={styles.goalsSection}>
              <Text style={styles.goalsSectionHeader}>ACTIVE GOALS</Text>
              {goals.map(goal => (
                <View key={goal.id} style={styles.goalSummaryRow}>
                  <View style={styles.goalSummaryTop}>
                    <Text style={styles.goalSummaryText}>{goal.text}</Text>
                    <Text style={styles.goalSummaryPct}>{goal.progress}%</Text>
                  </View>
                  <View style={styles.goalProgressBg}>
                    <View style={[styles.goalProgressFill, { width: `${goal.progress}%` as any }]} />
                  </View>
                  {goal.targetAt !== null && (
                    <Text style={styles.goalTargetDate}>
                      📅 {new Date(goal.targetAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

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
                  const isCalendar = block.source === 'calendar';
                  return (
                    <View key={block.id} style={styles.planBlock}>
                      <View style={[
                        styles.planDot,
                        isCalendar
                          ? styles.planDotCalendar
                          : covered ? styles.planDotCovered : styles.planDotMissed,
                      ]} />
                      <Text style={styles.planTime}>{formatMin(block.startMin)}–{formatMin(block.endMin)}</Text>
                      <Text style={[styles.planActivity, !covered && styles.planActivityMissed]}>
                        {block.activity}{isCalendar ? ' 🗓' : ''}
                      </Text>
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
                  {debugMode && (
                    <View style={styles.debugRow}>
                      <Text style={styles.debugText}>
                        synced: {entry.syncedAt !== null && entry.syncedAt >= entry.updatedAt ? 'yes' : 'no'}
                      </Text>
                      <Text style={styles.debugText}>
                        upd: {new Date(entry.updatedAt).toLocaleTimeString()}
                      </Text>
                      {entry.syncedAt !== null && (
                        <Text style={styles.debugText}>
                          sync_at: {new Date(entry.syncedAt).toLocaleTimeString()}
                        </Text>
                      )}
                      <Text style={styles.debugText}>
                        status: {entry.status === 1 ? 'active' : 'del'}
                      </Text>
                    </View>
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

function makeStyles(colors: ColorPalette, calendarColor: string) {
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
      backgroundColor: '#33B679' + '18',
      borderRadius: 12,
      padding: 16,
      borderLeftWidth: 4,
      borderLeftColor: '#33B679',
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
    goalsSection: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      marginBottom: 4,
    },
    goalsSectionHeader: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    goalSummaryRow: { gap: 4 },
    goalSummaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    goalSummaryText: { fontSize: 14, color: colors.text, flex: 1, lineHeight: 20 },
    goalSummaryPct: { fontSize: 13, fontWeight: '600', color: colors.accent },
    goalProgressBg: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
    goalProgressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
    goalTargetDate: { fontSize: 11, color: colors.textSecondary },
    planSection: {
      backgroundColor: '#039BE5' + '18',
      borderRadius: 12,
      padding: 14,
      gap: 8,
      borderLeftWidth: 4,
      borderLeftColor: '#039BE5',
    },
    planHeaderRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2,
    },
    planHeader: {
      fontSize: 11, fontWeight: '700', color: '#039BE5', letterSpacing: 0.5,
    },
    planEditHint: { fontSize: 12, color: '#039BE5' },
    planBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    planDot: { width: 10, height: 10, borderRadius: 5 },
    planDotCovered: { backgroundColor: '#039BE5' },
    planDotMissed: { backgroundColor: colors.border },
    planDotCalendar: { backgroundColor: calendarColor },
    planTime: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, width: 100 },
    planActivity: { fontSize: 14, color: colors.text, flex: 1 },
    planActivityMissed: { color: colors.textSecondary },
    planCoverage: {
      fontSize: 12, color: colors.textSecondary, marginTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
      paddingTop: 8,
    },
    planTag: { fontSize: 12, color: '#039BE5', marginTop: 6, fontWeight: '500' },
    debugRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    debugText: { fontSize: 11, color: colors.textSecondary, fontFamily: 'monospace' },
  });
}
