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
import { useTranslation } from '../i18n/LanguageContext';

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
  const { t, direction } = useTranslation();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate ?? new Date());
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [goalsExpanded, setGoalsExpanded] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [entriesOpen, setEntriesOpen] = useState(false);
  const [entriesExpanded, setEntriesExpanded] = useState(false);
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
    setGoalsOpen(false); setGoalsExpanded(false);
    setPlanOpen(false); setPlanExpanded(false);
    setEntriesOpen(false); setEntriesExpanded(false);
    setCurrentDate(d => new Date(d.getTime() - 86_400_000));
  }

  function goToNextDay() {
    setGoalsOpen(false); setGoalsExpanded(false);
    setPlanOpen(false); setPlanExpanded(false);
    setEntriesOpen(false); setEntriesExpanded(false);
    setCurrentDate(d => new Date(d.getTime() + 86_400_000));
  }

  const ENTRIES_COLLAPSED_COUNT = 2;
  const PLAN_COLLAPSED_COUNT = 2;
  const coveredCount = planBlocks.filter(b => isCovered(b, entries)).length;
  const canGoForward = !isToday(currentDate);
  const visibleGoals = goalsExpanded ? goals : goals.slice(0, PINNED_GOALS_COLLAPSED_COUNT);
  const hiddenGoalCount = Math.max(0, goals.length - PINNED_GOALS_COLLAPSED_COUNT);
  const visiblePlanBlocks = planExpanded ? planBlocks : planBlocks.slice(0, PLAN_COLLAPSED_COUNT);
  const hiddenPlanCount = Math.max(0, planBlocks.length - PLAN_COLLAPSED_COUNT);
  const visibleEntries = entriesExpanded ? entries : entries.slice(0, ENTRIES_COLLAPSED_COUNT);
  const hiddenEntryCount = Math.max(0, entries.length - ENTRIES_COLLAPSED_COUNT);
  const styles = makeStyles(colors, calendarColor, direction);
  const isRTL = direction === 'rtl';
  const expandChevron = isRTL ? '‹' : '›'; // closed-state strip indicator

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
        debugMode={debugMode}
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
        formatLabel={date => t(formatDayHeader(date))}
        disableNext={!canGoForward}
      />

      {loading ? (
        <View style={styles.centeredFull}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {/* Active Goals */}
          {goals.length > 0 && (
            <View style={styles.pinnedGoals}>
              <TouchableOpacity style={styles.sectionStripRow} onPress={() => setGoalsOpen(prev => !prev)} activeOpacity={0.85}>
                <Text style={styles.pinnedGoalsHeader}>{t('🎯  ACTIVE GOALS')}</Text>
                <Text style={styles.goalsStripCount}>{goals.length}</Text>
                <Text style={styles.goalsStripChevron}>{goalsOpen ? '⌄' : expandChevron}</Text>
              </TouchableOpacity>
              {goalsOpen && (
                <>
                  {visibleGoals.map((goal, index) => (
                    <GoalCard
                      key={goal.id ?? `goal-${index}-${goal.text}`}
                      goal={goal}
                      asOf={endOfDay(currentDate).getTime()}
                      onPress={() => onOpenGoal?.(goal.id)}
                    />
                  ))}
                  {hiddenGoalCount > 0 && (
                    <TouchableOpacity onPress={() => setGoalsExpanded(prev => !prev)} style={styles.pinnedGoalsToggle}>
                      <Text style={styles.pinnedGoalsToggleText}>
                        {goalsExpanded ? t('Show less') : t('Show {n} more', { n: hiddenGoalCount })}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}

          {/* Plan section */}
          {planBlocks.length > 0 && (
            <View style={styles.planSection}>
              <TouchableOpacity style={styles.sectionStripRow} onPress={() => setPlanOpen(prev => !prev)} activeOpacity={0.85}>
                <Text style={styles.planHeader}>{t('📅  PLAN')}</Text>
                <Text style={styles.planStripCount}>{coveredCount}/{planBlocks.length}</Text>
                <Text style={styles.planStripChevron}>{planOpen ? '⌄' : expandChevron}</Text>
              </TouchableOpacity>
              {planOpen && (
                <TouchableOpacity onPress={() => onEditPlan?.(currentDate)} activeOpacity={0.85}>
                  {visiblePlanBlocks.map((block, index) => {
                    const covered = isCovered(block, entries);
                    const isCalendar = block.source === 'calendar';
                    const blockKey = block.id ?? `${block.source}-${block.startMin}-${block.endMin}-${block.activity}`;
                    return (
                      <React.Fragment key={blockKey}>
                        <View style={styles.planBlock}>
                          <Text style={styles.planTime}>{formatMin(block.startMin)}–{formatMin(block.endMin)}</Text>
                          <Text style={[styles.planActivity, !covered && styles.planActivityMissed]}>
                            {block.activity}{isCalendar ? ' 🗓' : ''}
                          </Text>
                        </View>
                        {index < visiblePlanBlocks.length - 1 && <View style={styles.itemSeparator} />}
                      </React.Fragment>
                    );
                  })}
                  {hiddenPlanCount > 0 && (
                    <TouchableOpacity onPress={e => { e.stopPropagation?.(); setPlanExpanded(prev => !prev); }} style={styles.pinnedGoalsToggle}>
                      <Text style={styles.planToggleText}>
                        {planExpanded ? t('Show less') : t('Show {n} more', { n: hiddenPlanCount })}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.planCoverage}>
                    {t('{covered}/{total} blocks covered', { covered: coveredCount, total: planBlocks.length })}
                    {coveredCount < planBlocks.length ? `  ·  ${t('{n} missed', { n: planBlocks.length - coveredCount })}` : '  ✓'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Check-in Entries */}
          {entries.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>{t('No entries for this day')}</Text>
            </View>
          ) : (
            <View style={styles.entriesSection}>
              <TouchableOpacity style={styles.sectionStripRow} onPress={() => setEntriesOpen(prev => !prev)} activeOpacity={0.85}>
                <Text style={styles.entriesHeader}>{t('📋  ENTRIES')}</Text>
                <Text style={styles.entriesStripCount}>{entries.length}</Text>
                <Text style={styles.entriesStripChevron}>{entriesOpen ? '⌄' : expandChevron}</Text>
              </TouchableOpacity>
              {entriesOpen && (
                <>
                  {visibleEntries.map((entry, index) => {
                    const matched = planBlocks.length > 0 ? allMatchingBlocks(entry, planBlocks) : [];
                    const entryKey = entry.id ?? `entry-${index}-${entry.timestampStart}-${entry.timestampEnd}`;
                    return (
                      <React.Fragment key={entryKey}>
                      <TouchableOpacity
                        style={styles.entryCard}
                        onPress={() => setSelectedEntry(entry)}>
                        <View style={styles.entryCardHeader}>
                          <Text style={styles.timeRange}>
                            {formatTime(entry.timestampStart)} – {formatTime(entry.timestampEnd)}
                          </Text>
                          {debugMode && <Text style={styles.entryId}>#{entry.id}</Text>}
                        </View>
                        <Text style={styles.transcript}>{entry.transcript}</Text>
                        {matched.length > 0 && (
                          <Text style={styles.planTag}>{t('→ {activities}', { activities: matched.map(b => b.activity).join(', ') })}</Text>
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
                      {index < visibleEntries.length - 1 && <View style={styles.itemSeparator} />}
                      </React.Fragment>
                    );
                  })}
                  {hiddenEntryCount > 0 && (
                    <TouchableOpacity onPress={() => setEntriesExpanded(prev => !prev)} style={styles.entriesToggle}>
                      <Text style={styles.entriesToggleText}>
                        {entriesExpanded ? t('Show less') : t('Show {n} more', { n: hiddenEntryCount })}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}

          {/* Daily Summary — bottom */}
          <TouchableOpacity
            style={styles.summaryDebugCard}
            onPress={() => onOpenDailySummary?.(currentDate)}
            activeOpacity={0.85}>
            <View style={styles.summaryDebugHeader}>
              <Text style={styles.summaryDebugTitle}>{t('DAILY SUMMARY')}</Text>
              <Text style={styles.summaryDebugLink}>{t('Open')}</Text>
            </View>
            <Text style={[styles.summaryReadOnly, !summary && styles.summaryPlaceholder]} numberOfLines={3}>
              {summary?.debrief || t('No summary yet')}
            </Text>
          </TouchableOpacity>

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

function makeStyles(colors: ColorPalette, calendarColor: string, direction: 'ltr' | 'rtl') {
  const isRTL = direction === 'rtl';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
      borderLeftWidth: isRTL ? 0 : 4,
      borderRightWidth: isRTL ? 4 : 0,
      borderLeftColor: isRTL ? 'transparent' : SUMMARY_COLOR,
      borderRightColor: isRTL ? SUMMARY_COLOR : 'transparent',
    },
    summaryDebugHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    summaryDebugTitle: { fontSize: 11, fontWeight: '700', color: SUMMARY_COLOR, letterSpacing: 0.5, textAlign: isRTL ? 'right' : 'left' },
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
    summaryReadOnly: { fontSize: 14, color: colors.text, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' },
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
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    entryId: { fontSize: 11, color: colors.border, fontWeight: '500' },
    entryCard: {
      paddingVertical: 10,
    },
    timeRange: { fontSize: 13, fontWeight: '600', color: '#33B679', textAlign: isRTL ? 'right' : 'left' },
    transcript: { fontSize: 14, color: colors.text, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' },
    fab: {
      position: 'absolute',
      right: isRTL ? undefined : 24,
      left: isRTL ? 24 : undefined,
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
    sectionStripRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
    },
    goalsStripCount: { fontSize: 12, fontWeight: '700', color: GOAL_COLOR },
    goalsStripChevron: { fontSize: 20, color: GOAL_COLOR, lineHeight: 22 },
    planStripCount: { fontSize: 12, fontWeight: '700', color: '#039BE5' },
    planStripChevron: { fontSize: 20, color: '#039BE5', lineHeight: 22 },
    entriesSection: {
      backgroundColor: '#33B679' + '18',
      borderRadius: 8,
      padding: 12,
      gap: 8,
      borderLeftWidth: isRTL ? 0 : 4,
      borderRightWidth: isRTL ? 4 : 0,
      borderLeftColor: isRTL ? 'transparent' : '#33B679',
      borderRightColor: isRTL ? '#33B679' : 'transparent',
    },
    entriesHeader: {
      flex: 1,
      fontSize: 11,
      fontWeight: '700',
      color: '#33B679',
      letterSpacing: 0.8,
      textAlign: isRTL ? 'right' : 'left',
    },
    entriesStripCount: { fontSize: 12, fontWeight: '700', color: '#33B679' },
    entriesStripChevron: { fontSize: 20, color: '#33B679', lineHeight: 22 },
    pinnedGoals: {
      backgroundColor: GOAL_COLOR + '10',
      borderRadius: 8,
      padding: 12,
      gap: 8,
      borderLeftWidth: isRTL ? 0 : 4,
      borderRightWidth: isRTL ? 4 : 0,
      borderLeftColor: isRTL ? 'transparent' : GOAL_COLOR,
      borderRightColor: isRTL ? GOAL_COLOR : 'transparent',
    },
    pinnedGoalsHeader: {
      flex: 1,
      fontSize: 11,
      fontWeight: '700',
      color: GOAL_COLOR,
      letterSpacing: 0.8,
      textAlign: isRTL ? 'right' : 'left',
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
    planToggleText: {
      fontSize: 12,
      color: '#039BE5',
      fontWeight: '700',
    },
    pinnedGoalRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
    pinnedGoalPct: { fontSize: 12, fontWeight: '700', color: GOAL_COLOR, minWidth: 34, textAlign: isRTL ? 'left' : 'right' },
    planSection: {
      backgroundColor: '#039BE5' + '18',
      borderRadius: 8,
      padding: 12,
      gap: 8,
      borderLeftWidth: isRTL ? 0 : 4,
      borderRightWidth: isRTL ? 4 : 0,
      borderLeftColor: isRTL ? 'transparent' : '#039BE5',
      borderRightColor: isRTL ? '#039BE5' : 'transparent',
    },
    planHeader: {
      flex: 1,
      fontSize: 11, fontWeight: '700', color: '#039BE5', letterSpacing: 0.5,
      textAlign: isRTL ? 'right' : 'left',
    },
    planBlock: {
      paddingVertical: 10,
      gap: 2,
    },
    planTime: { fontSize: 13, fontWeight: '600', color: '#039BE5', textAlign: isRTL ? 'right' : 'left' },
    planActivity: { fontSize: 14, color: colors.text, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' },
    planActivityMissed: { color: colors.textSecondary },
    planCoverage: {
      fontSize: 12, color: colors.textSecondary, marginTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
      paddingTop: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    planTag: { fontSize: 12, color: '#039BE5', marginTop: 6, fontWeight: '500', textAlign: isRTL ? 'right' : 'left' },
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
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 12,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    debugText: { fontSize: 11, color: colors.textSecondary, fontFamily: 'monospace' },
    entriesToggle: {
      alignSelf: 'flex-start',
      minHeight: 22,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    entriesToggleText: {
      fontSize: 12,
      color: '#33B679',
      fontWeight: '700',
    },
    itemSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
  });
}
