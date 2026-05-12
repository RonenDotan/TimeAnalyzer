import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { LogEntry } from '../types/LogEntry';
import { Goal, GoalEntryContribution, isGoalOverdue } from '../types/Goal';
import { DailySummaryResult } from '../types/DailySummary';

const GOAL_COLOR = '#F97316';
const OVERDUE_COLOR = '#DC2626';
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
  const [entryContributions, setEntryContributions] = useState<Record<number, GoalEntryContribution[]>>({});
  const [summary, setSummary] = useState<DailySummaryResult | null>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryGenerating, setSummaryGenerating] = useState(false);

  const loadEntries = useCallback(async (date: Date) => {
    setLoading(true);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
    setSummary(DailySummaryService.parseSummary(savedSummary));
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

  async function handleGenerateSummary() {
    if (summaryGenerating) return;
    setSummaryGenerating(true);
    try {
      const saved = await DailySummaryService.generateSummary(currentDate);
      setSummary(DailySummaryService.parseSummary(saved));
      setSummaryVisible(true);
    } catch (e: any) {
      Alert.alert('Summary failed', String(e?.message ?? e));
    } finally {
      setSummaryGenerating(false);
    }
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

      {/* Pinned active goals — always visible above plan/entries */}
      {!loading && goals.length > 0 && (
        <View style={styles.pinnedGoals}>
          <Text style={styles.pinnedGoalsHeader}>🎯  ACTIVE GOALS</Text>
          {goals.map(goal => {
            const overdue = isGoalOverdue(goal, endOfDay(currentDate).getTime());
            const goalColor = overdue ? OVERDUE_COLOR : GOAL_COLOR;
            return (
            <View key={goal.id} style={[styles.pinnedGoalRow, overdue && styles.pinnedGoalRowOverdue]}>
              <View style={styles.pinnedGoalInfo}>
                <Text style={styles.pinnedGoalText} numberOfLines={1}>{goal.text}</Text>
                <View style={styles.pinnedBarBg}>
                  <View style={[styles.pinnedBarFill, { width: `${goal.progress}%` as any, backgroundColor: goalColor }]} />
                </View>
                {goal.targetAt !== null && (
                  <Text style={[styles.pinnedGoalDeadline, overdue && styles.pinnedGoalOverdueText]}>
                    📅 {new Date(goal.targetAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                )}
                {overdue && <Text style={styles.pinnedGoalOverdueText}>Overdue</Text>}
              </View>
              <Text style={[styles.pinnedGoalPct, { color: goalColor }]}>{goal.progress}%</Text>
            </View>
            );
          })}
        </View>
      )}


      {loading ? (
        <View style={styles.centeredFull}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {debugMode && (
            <View style={styles.summaryDebugCard}>
              <View style={styles.summaryDebugHeader}>
                <Text style={styles.summaryDebugTitle}>DAILY SUMMARY</Text>
                {summary && (
                  <TouchableOpacity onPress={() => setSummaryVisible(true)}>
                    <Text style={styles.summaryDebugLink}>View saved</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.summaryButton, summaryGenerating && styles.summaryButtonDisabled]}
                onPress={handleGenerateSummary}
                disabled={summaryGenerating}>
                <Text style={styles.summaryButtonText}>
                  {summaryGenerating ? 'Generating...' : '✨ Generate Summary'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
                        <View key={i} style={styles.goalTag}>
                          <Text style={styles.goalTagText} numberOfLines={1}>
                            🎯 {c.goalText}  +{c.contributionPct}%
                          </Text>
                        </View>
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

      <Modal visible={summaryVisible} transparent animationType="fade" onRequestClose={() => setSummaryVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.summaryModal}>
            <View style={styles.summaryModalHeader}>
              <Text style={styles.summaryModalTitle}>Daily Summary</Text>
              <TouchableOpacity onPress={() => setSummaryVisible(false)}>
                <Text style={styles.summaryModalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.summaryModalBody}>
              {summary ? (
                <>
                  <Text style={styles.summaryDebrief}>{summary.debrief}</Text>
                  {!!summary.momentum && (
                    <>
                      <Text style={styles.summarySectionTitle}>MOMENTUM</Text>
                      <Text style={styles.summaryText}>{summary.momentum}</Text>
                    </>
                  )}
                  {summary.keyInsights && summary.keyInsights.length > 0 && (
                    <>
                      <Text style={styles.summarySectionTitle}>KEY INSIGHTS</Text>
                      {summary.keyInsights.map((insight, i) => (
                        <Text key={i} style={styles.summaryBullet}>
                          • {insight.text}{insight.confidence ? ` (${insight.confidence})` : ''}
                        </Text>
                      ))}
                    </>
                  )}
                  {summary.gaps && summary.gaps.length > 0 && (
                    <>
                      <Text style={styles.summarySectionTitle}>GAPS</Text>
                      {summary.gaps.map((gap, i) => (
                        <Text key={i} style={styles.summaryBullet}>• {gap}</Text>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <Text style={styles.summaryText}>No saved summary for this day.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    summaryDebugCard: {
      backgroundColor: GOAL_COLOR + '12',
      borderRadius: 12,
      padding: 12,
      gap: 10,
      borderLeftWidth: 4,
      borderLeftColor: GOAL_COLOR,
    },
    summaryDebugHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    summaryDebugTitle: { fontSize: 11, fontWeight: '700', color: GOAL_COLOR, letterSpacing: 0.5 },
    summaryDebugLink: { fontSize: 13, color: GOAL_COLOR, fontWeight: '600' },
    summaryButton: {
      alignSelf: 'flex-start',
      backgroundColor: GOAL_COLOR,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    summaryButtonDisabled: { opacity: 0.65 },
    summaryButtonText: { fontSize: 14, color: '#fff', fontWeight: '700' },
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
    // Pinned goals strip — sits between dayNav and scroll content
    pinnedGoals: {
      backgroundColor: GOAL_COLOR + '12',
      borderBottomWidth: 2,
      borderBottomColor: GOAL_COLOR + '40',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    pinnedGoalsHeader: {
      fontSize: 11,
      fontWeight: '700',
      color: GOAL_COLOR,
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    pinnedGoalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 8,
      padding: 6,
    },
    pinnedGoalRowOverdue: { backgroundColor: OVERDUE_COLOR + '16' },
    pinnedGoalInfo: { flex: 1, gap: 3 },
    pinnedGoalText: { fontSize: 13, color: colors.text, fontWeight: '500' },
    pinnedBarBg: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
    pinnedBarFill: { height: 4, backgroundColor: GOAL_COLOR, borderRadius: 2 },
    pinnedGoalDeadline: { fontSize: 10, color: colors.textSecondary },
    pinnedGoalOverdueText: { fontSize: 10, color: OVERDUE_COLOR, fontWeight: '700' },
    pinnedGoalPct: { fontSize: 14, fontWeight: '700', color: GOAL_COLOR, minWidth: 38, textAlign: 'right' },
    planSection: {
      backgroundColor: '#039BE5' + '18',
      borderRadius: 12,
      padding: 14,
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
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: 20,
    },
    summaryModal: {
      maxHeight: '82%',
      backgroundColor: colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    summaryModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    summaryModalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    summaryModalClose: { fontSize: 15, color: GOAL_COLOR, fontWeight: '600' },
    summaryModalBody: { padding: 16, gap: 10 },
    summaryDebrief: { fontSize: 15, color: colors.text, lineHeight: 22 },
    summaryText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    summarySectionTitle: { fontSize: 11, color: GOAL_COLOR, fontWeight: '700', letterSpacing: 0.5, marginTop: 6 },
    summaryBullet: { fontSize: 14, color: colors.text, lineHeight: 20 },
  });
}
