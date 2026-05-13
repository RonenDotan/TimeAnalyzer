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
import DateNavigator from '../components/DateNavigator';
import PieChart from '../components/PieChart';
import ScreenHeader from '../components/ScreenHeader';
import StorageService from '../services/StorageService';
import { LogEntry } from '../types/LogEntry';
import { PlanBlock } from '../types/DayPlan';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';
import { computeReportData, dateRangeLabel, formatDuration, ReportData } from '../utils/reportData';
import { formatMin } from '../utils/parseDayPlan';

interface Props {
  onOpenMenu: () => void;
}

type RangeMode = 'today' | 'week';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ReportsScreen({ onOpenMenu }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [mode, setMode] = useState<RangeMode>('today');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const loadData = useCallback(async (date: Date, rangeMode: RangeMode) => {
    setLoading(true);
    let start: Date, end: Date;
    if (rangeMode === 'today') {
      start = startOfDay(date);
      end = endOfDay(date);
    } else {
      const day = date.getDay();
      const monday = new Date(date.getTime() - day * 86_400_000);
      start = startOfDay(monday);
      end = endOfDay(new Date(monday.getTime() + 6 * 86_400_000));
    }

    const allEntries = await StorageService.getByDateRange(start, end);
    let allBlocks: PlanBlock[] = [];

    if (rangeMode === 'today') {
      const plan = await StorageService.getDayPlan(toDateStr(date));
      if (plan) allBlocks = await StorageService.getPlanBlocks(plan.id);
    } else {
      for (let i = 0; i < 7; i++) {
        const d = new Date(start.getTime() + i * 86_400_000);
        const plan = await StorageService.getDayPlan(toDateStr(d));
        if (plan) {
          const blocks = await StorageService.getPlanBlocks(plan.id);
          allBlocks = [...allBlocks, ...blocks];
        }
      }
    }

    setEntries(allEntries);
    setPlanBlocks(allBlocks);
    setReportData(computeReportData(allEntries, allBlocks));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(currentDate, mode);
  }, [currentDate, mode, loadData]);

  function goToPrev() {
    const delta = mode === 'today' ? 86_400_000 : 7 * 86_400_000;
    setCurrentDate(d => new Date(d.getTime() - delta));
  }

  function goToNext() {
    const delta = mode === 'today' ? 86_400_000 : 7 * 86_400_000;
    setCurrentDate(d => new Date(d.getTime() + delta));
  }

  const styles = makeStyles(colors);

  function renderRangeLabel(): string {
    if (mode === 'today') return dateRangeLabel(currentDate);
    const day = currentDate.getDay();
    const monday = new Date(currentDate.getTime() - day * 86_400_000);
    const sunday = new Date(monday.getTime() + 6 * 86_400_000);
    return `${dateRangeLabel(monday)} – ${dateRangeLabel(sunday)}`;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Reports" onLeft={onOpenMenu} leftIcon="hamburger" leftLabel="Menu" />

      {/* Range toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'today' && styles.modeBtnActive]}
          onPress={() => setMode('today')}>
          <Text style={[styles.modeBtnText, mode === 'today' && styles.modeBtnTextActive]}>Day</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'week' && styles.modeBtnActive]}
          onPress={() => setMode('week')}>
          <Text style={[styles.modeBtnText, mode === 'week' && styles.modeBtnTextActive]}>Week</Text>
        </TouchableOpacity>
      </View>
      <DateNavigator
        date={currentDate}
        onPrev={goToPrev}
        onNext={goToNext}
        formatLabel={renderRangeLabel}
      />

      {loading ? (
        <View style={styles.centeredFull}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : !reportData || (entries.length === 0 && planBlocks.length === 0) ? (
        <View style={styles.centeredFull}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>No data for this period</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>

          {/* ── PLAN vs ACTUAL TABLE ─────────────────────────── */}
          <Text style={styles.sectionTitle}>PLAN VS ACTUAL</Text>
          <View style={styles.card}>
            {/* Header row */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.col1, styles.tableHeaderText]}>Time</Text>
              <Text style={[styles.col2, styles.tableHeaderText]}>Planned</Text>
              <Text style={[styles.col3, styles.tableHeaderText]}>Actual</Text>
            </View>

            {reportData.planRows.map((row, i) => (
              <View key={row.block.id} style={[styles.tableRow, i > 0 && styles.rowBorder]}>
                <Text style={[styles.col1, styles.timeText]}>
                  {formatMin(row.block.startMin)}–{formatMin(row.block.endMin)}
                </Text>
                <View style={styles.col2}>
                  <Text style={styles.activityText}>{row.block.activity}</Text>
                  <Text style={styles.durationText}>{formatDuration(row.plannedMinutes)}</Text>
                </View>
                <View style={styles.col3}>
                  {row.matchedEntries.length === 0 ? (
                    <Text style={styles.missedText}>—</Text>
                  ) : (
                    <>
                      <Text style={styles.activityText} numberOfLines={2}>
                        {row.matchedEntries[0].transcript}
                      </Text>
                      <Text style={styles.durationText}>{formatDuration(row.coveredMinutes)}</Text>
                    </>
                  )}
                </View>
              </View>
            ))}

            {reportData.unplannedRows.length > 0 && (
              <>
                {reportData.planRows.length > 0 && <View style={styles.sectionDivider} />}
                <View style={[styles.tableRow, styles.rowBorder]}>
                  <Text style={[styles.col1, styles.timeText]} />
                  <View style={styles.col2}>
                    <Text style={[styles.activityText, { color: colors.textSecondary }]}>Unplanned</Text>
                  </View>
                  <View style={styles.col3}>
                    <Text style={styles.activityText} numberOfLines={2}>
                      {reportData.unplannedRows[0].entry.transcript}
                    </Text>
                    {reportData.unplannedRows.length > 1 && (
                      <Text style={styles.durationText}>+{reportData.unplannedRows.length - 1} more</Text>
                    )}
                  </View>
                </View>
              </>
            )}
          </View>

          {/* ── PIE CHART ────────────────────────────────────── */}
          {reportData.pieSlices.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>TIME DISTRIBUTION</Text>
              <View style={[styles.card, styles.pieCard]}>
                <PieChart slices={reportData.pieSlices} colors={colors} />
                <Text style={styles.pieTotal}>
                  Total: {formatDuration(reportData.totalActualMinutes)}
                </Text>
              </View>
            </>
          )}

          {/* ── PLAN ADHERENCE ───────────────────────────────── */}
          {reportData.totalBlockCount > 0 && (
            <>
              <Text style={styles.sectionTitle}>PLAN ADHERENCE</Text>
              <View style={styles.card}>
                <View style={styles.adherenceRow}>
                  <Text style={styles.adherencePct}>{reportData.adherencePercent}%</Text>
                  <View style={styles.adherenceRight}>
                    <Text style={styles.adherenceLabel}>
                      {reportData.coveredBlockCount} of {reportData.totalBlockCount} blocks covered
                    </Text>
                    <View style={styles.adherenceBar}>
                      <View
                        style={[
                          styles.adherenceBarFill,
                          { width: `${reportData.adherencePercent}%` as any },
                        ]}
                      />
                    </View>
                    <View style={styles.adherenceStats}>
                      <Text style={styles.adherenceStatText}>
                        Planned: {formatDuration(reportData.totalPlannedMinutes)}
                      </Text>
                      <Text style={styles.adherenceStatText}>
                        Actual: {formatDuration(reportData.totalActualMinutes)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}

        </ScrollView>
      )}
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
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    menuBtn: { padding: 3, width: 32 },
    menuIcon: { fontSize: 20, color: colors.accent },
    title: { fontSize: 16, fontWeight: '600', color: colors.text },
    modeRow: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 5,
      gap: 6,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modeBtn: {
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: colors.background,
    },
    modeBtnActive: { backgroundColor: colors.accent },
    modeBtnText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
    modeBtnTextActive: { color: '#fff' },
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
    dayLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
    centeredFull: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyIcon: { fontSize: 48 },
    emptyText: { fontSize: 16, color: colors.textSecondary },
    body: { padding: 16, gap: 8, paddingBottom: 40 },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.accent,
      letterSpacing: 0.5,
      marginTop: 12,
      marginBottom: 4,
      marginLeft: 2,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    pieCard: { padding: 16, gap: 10 },
    tableRow: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignItems: 'flex-start',
    },
    tableHeader: {
      backgroundColor: colors.surfaceSecondary,
      paddingVertical: 8,
    },
    tableHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.3,
    },
    rowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    sectionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.accent,
      opacity: 0.3,
      marginVertical: 4,
    },
    col1: { width: 80 },
    col2: { flex: 1, paddingRight: 8 },
    col3: { flex: 1 },
    timeText: { fontSize: 12, fontWeight: '600', color: colors.accent, paddingTop: 2 },
    activityText: { fontSize: 13, color: colors.text, lineHeight: 18 },
    durationText: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    missedText: { fontSize: 16, color: colors.border },
    pieTotal: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'right',
    },
    adherenceRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
    adherencePct: { fontSize: 42, fontWeight: '700', color: colors.accent, width: 80 },
    adherenceRight: { flex: 1, gap: 6 },
    adherenceLabel: { fontSize: 14, color: colors.text },
    adherenceBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    adherenceBarFill: {
      height: 8,
      backgroundColor: colors.accent,
      borderRadius: 4,
    },
    adherenceStats: { flexDirection: 'row', justifyContent: 'space-between' },
    adherenceStatText: { fontSize: 12, color: colors.textSecondary },
  });
}
