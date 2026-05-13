import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import DailySummaryService from '../services/DailySummaryService';
import DateNavigator from '../components/DateNavigator';
import GoalCard from '../components/GoalCard';
import ScreenHeader from '../components/ScreenHeader';
import { LogEntry } from '../types/LogEntry';
import { Goal, GoalEntryContribution } from '../types/Goal';
import { DailySummaryResult } from '../types/DailySummary';

const GOAL_COLOR = '#F97316';
const OVERDUE_COLOR = '#DC2626';
const SUMMARY_COLOR = '#F5A623';
const PINNED_GOALS_COLLAPSED_COUNT = 2;
import { ColorPalette, useTheme } from '../contexts/ThemeContext';
import { DayPlan, PlanBlock } from '../types/DayPlan';
import { allMatchingBlocks, isCovered } from '../utils/planMatching';
import { formatMin } from '../utils/parseDayPlan';

interface Props {
  onStartCheckIn: () => void;
  onOpenMenu: () => void;
  onEditPlan?: (date: Date) => void;
  onOpenDailySummary?: (date: Date) => void;
  onOpenGoal?: (goalId: number) => void;
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

function formatDayHeader(date: Date): string {
  const today = new Date();
  const todayStart = startOfDay(today).getTime();
  const dateStart = startOfDay(date).getTime();
  const diffDays = Math.round((dateStart - todayStart) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function ReportScreen({
  onStartCheckIn,
  onOpenMenu,
  onEditPlan,
  onOpenDailySummary,
  onOpenGoal,
  initialDate,
  debugMode = false,
  calendarColor = '#7986CB',
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate ?? new Date());
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsExpanded, setGoalsExpanded] = useState(false);
  const [entryContributions, setEntryContributions] = useState<Record<number, GoalEntryContribution[]>>({});
  const [summary, setSummary] = useState<DailySummaryResult | null>(null);

  const loadEntries = useCallback(async (date: Date) => {
    setLoading(true);
    const dateStr = dateToStr(date);
    const [results, plan, calBlocks, loadedGoals] = await Promise.all([
      StorageService.getByDateRange(startOfDay(date), endOfDay(date)),
      StorageService.getDayPlan(dateStr),
      StorageService.getCalendarPlanBlocksByDate(dateStr),
      GoalsService.getActiveGoals(endOfDay(date).getTime()),
    ]);
    const sorted = results.sort((a, b) => a.timestampStart - b.timestampStart);
    setEntries(sorted);
    setDayPlan(plan);
    setGoals(loadedGoals);
    const savedSummary = await DailySummaryService.getSummary(dateStr);
    const parsedSummary = DailySummaryService.parseSummary(savedSummary);
    setSummary(parsedSummary);
    // Load goal contributions for each entry (to show 🎯 tag)
    const contribMap: Record<number, GoalEntryContribution[]> = {};
    await Promise.all(sorted.map(async e => {
      const c = await GoalsService.getContributionsByEntryId(e.id);
      if (c.length > 0) contribMap[e.id] = c;
    }));
    setEntryContributions(contribMap);
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
    setGoalsExpanded(false);
    setCurrentDate(d => new Date(d.getTime() - 86_400_000));
  }

  function goToNextDay() {
    setGoalsExpanded(false);
    setCurrentDate(d => new Date(d.getTime() + 86_400_000));
  }

  const canGoForward = !isToday(currentDate);
  const visibleGoals = goalsExpanded ? goals : goals.slice(0, PINNED_GOALS_COLLAPSED_COUNT);
  const hiddenGoalCount = Math.max(0, goals.length - PINNED_GOALS_COLLAPSED_COUNT);
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
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader title="Entries" onLeft={onOpenMenu} leftIcon="hamburger" leftLabel="Menu" />

      <DateNavigator
        date={currentDate}
        onPrev={goToPrevDay}
        onNext={goToNextDay}
        formatLabel={formatDayHeader}
        disableNext={!canGoForward}
      />

      {loading ? (
        <View style={styles.centeredFull}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {goals.length > 0 && (
            <View style={styles.pinnedGoals}>
              <View style={styles.pinnedGoalsTop}>
                <Text style={styles.pinnedGoalsHeader}>🎯  ACTIVE GOALS</Text>
                {hiddenGoalCount > 0 && (
                  <TouchableOpacity onPress={() => setGoalsExpanded(prev => !prev)} style={styles.pinnedGoalsToggle}>
                    <Text style={styles.pinnedGoalsToggleText}>
                      {goalsExpanded ? 'Show less' : `Show ${hiddenGoalCount} more`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {visibleGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  asOf={endOfDay(currentDate).getTime()}
                  onPress={() => onOpenGoal?.(goal.id)}
                />
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.summaryDebugCard}
            onPress={() => onOpenDailySummary?.(currentDate)}
            activeOpacity={0.85}>
            <View style={styles.summaryDebugHeader}>
              <Text style={styles.summaryDebugTitle}>DAILY SUMMARY</Text>
              <Text style={styles.summaryDebugLink}>Open</Text>
            </View>
            <Text style={[styles.summaryReadOnly, !summary && styles.summaryPlaceholder]} numberOfLines={3}>
              {summary?.debrief || 'No summary yet'}
            </Text>
          </TouchableOpacity>
          {/* Plan section — always shown if plan exists */}
          {planBlocks.length > 0 && (() => {
            const coveredCount = planBlocks.filter(b => isCovered(b, entries)).length;
            return (
              <TouchableOpacity
                style={styles.planSection}
                onPress={() => onEditPlan?.(currentDate)}
                activeOpacity={0.85}>
                <Text style={styles.planHeader}>PLAN  ›</Text>
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
              </TouchableOpacity>
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
                  {entryContributions[entry.id] && entryContributions[entry.id].length > 0 && (
                    <View style={styles.goalTagRow}>
                      {entryContributions[entry.id].map((c, i) => (
                        <TouchableOpacity
                          key={i}
                          style={styles.goalTag}
                          onPress={event => {
                            event.stopPropagation();
                            onOpenGoal?.(c.goalId);
                          }}>
                          <Text style={styles.goalTagText} numberOfLines={1}>
                            🎯 {c.goalText}  +{c.contributionPct}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
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

    </KeyboardAvoidingView>
  );
}

function dateToStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function makeStyles(colors: ColorPalette, calendarColor: string) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    menuBtn: { padding: 3, width: 32 },
    menuIcon: { fontSize: 20, color: colors.accent },
    appTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    topBarSpacer: { width: 32 },
    dayNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 6,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    navBtn: { paddingHorizontal: 8, paddingVertical: 3 },
    navArrow: { fontSize: 24, color: colors.accent, fontWeight: '300' },
    navArrowDisabled: { color: colors.border },
    dayLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    centeredFull: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 16, color: colors.textSecondary },
    list: { paddingHorizontal: 16, paddingTop: 16, gap: 12, paddingBottom: 100 },
    summaryDebugCard: {
      backgroundColor: SUMMARY_COLOR + '18',
      borderRadius: 8,
      padding: 12,
      gap: 8,
      borderLeftWidth: 4,
      borderLeftColor: SUMMARY_COLOR,
    },
    summaryDebugHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    summaryDebugTitle: { fontSize: 11, fontWeight: '700', color: SUMMARY_COLOR, letterSpacing: 0.5 },
    summaryDebugLink: { fontSize: 13, color: SUMMARY_COLOR, fontWeight: '600' },
    summaryButton: {
      alignSelf: 'flex-start',
      backgroundColor: SUMMARY_COLOR,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    summaryButtonDisabled: { opacity: 0.65 },
    summaryButtonText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    summaryInput: {
      minHeight: 120,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: SUMMARY_COLOR + '70',
      padding: 10,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      textAlignVertical: 'top',
    },
    summaryReadOnly: { fontSize: 14, color: colors.text, lineHeight: 20 },
    summaryPlaceholder: { color: colors.placeholder, fontStyle: 'italic' },
    summaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    summarySaveButton: {
      alignSelf: 'flex-start',
      backgroundColor: SUMMARY_COLOR,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    summaryCancelButton: {
      alignSelf: 'flex-start',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    summaryCancelText: { fontSize: 14, color: colors.textSecondary, fontWeight: '700' },
    entryCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    entryId: { fontSize: 11, color: colors.border, fontWeight: '500' },
    entryCard: {
      backgroundColor: '#33B679' + '18',
      borderRadius: 8,
      padding: 12,
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
    pinnedGoals: {
      backgroundColor: GOAL_COLOR + '10',
      borderRadius: 8,
      padding: 12,
      gap: 8,
      borderLeftWidth: 4,
      borderLeftColor: GOAL_COLOR,
    },
    pinnedGoalsTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    pinnedGoalsHeader: {
      flex: 1,
      fontSize: 11,
      fontWeight: '700',
      color: GOAL_COLOR,
      letterSpacing: 0.8,
    },
    pinnedGoalsToggle: {
      minHeight: 22,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    pinnedGoalsToggleText: {
      fontSize: 12,
      color: GOAL_COLOR,
      fontWeight: '700',
    },
    pinnedGoalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 6,
      paddingHorizontal: 4,
      paddingVertical: 3,
    },
    pinnedGoalRowOverdue: { backgroundColor: OVERDUE_COLOR + '16' },
    pinnedGoalInfo: { flex: 1, gap: 2 },
    pinnedGoalText: { fontSize: 12, color: colors.text, fontWeight: '500', lineHeight: 16 },
    pinnedBarBg: { height: 3, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
    pinnedBarFill: { height: 3, backgroundColor: GOAL_COLOR, borderRadius: 2 },
    pinnedGoalDeadline: { fontSize: 9, color: colors.textSecondary, lineHeight: 12 },
    pinnedGoalOverdueText: { fontSize: 9, color: OVERDUE_COLOR, fontWeight: '700', lineHeight: 12 },
    pinnedGoalPct: { fontSize: 12, fontWeight: '700', color: GOAL_COLOR, minWidth: 34, textAlign: 'right' },
    planSection: {
      backgroundColor: '#039BE5' + '18',
      borderRadius: 8,
      padding: 12,
      gap: 8,
      borderLeftWidth: 4,
      borderLeftColor: '#039BE5',
    },
    planHeader: {
      fontSize: 11, fontWeight: '700', color: '#039BE5', letterSpacing: 0.5, marginBottom: 2,
    },
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
    goalTagRow: { flexDirection: 'column', gap: 4, marginTop: 6 },
    goalTag: {
      backgroundColor: GOAL_COLOR + '18',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: GOAL_COLOR + '50',
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    goalTagText: { fontSize: 12, color: GOAL_COLOR, fontWeight: '600' },
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
