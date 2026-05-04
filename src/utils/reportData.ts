import { LogEntry } from '../types/LogEntry';
import { PlanBlock } from '../types/DayPlan';
import { allMatchingBlocks, overlapMin, toLocalMin } from './planMatching';
import { formatMin } from './parseDayPlan';

export interface PlanRow {
  block: PlanBlock;
  matchedEntries: LogEntry[];
  coveredMinutes: number;
  plannedMinutes: number;
}

export interface UnplannedRow {
  entry: LogEntry;
  durationMinutes: number;
}

export interface PieSlice {
  label: string;
  minutes: number;
  percentage: number;
  color: string;
}

export interface ReportData {
  planRows: PlanRow[];
  unplannedRows: UnplannedRow[];
  pieSlices: PieSlice[];
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  adherencePercent: number;
  coveredBlockCount: number;
  totalBlockCount: number;
}

const SLICE_COLORS = [
  '#4F8EF7', '#34C759', '#FF9500', '#FF2D55', '#AF52DE',
  '#5AC8FA', '#FFCC00', '#FF6B35', '#32ADE6', '#30B0C7',
];

function entryDurationMin(entry: LogEntry): number {
  return Math.round((entry.timestampEnd - entry.timestampStart) / 60000);
}

const MATCH_THRESHOLD = 30;

export function computeReportData(entries: LogEntry[], planBlocks: PlanBlock[]): ReportData {
  const totalActualMinutes = entries.reduce((sum, e) => sum + entryDurationMin(e), 0);

  // Build plan rows
  const planRows: PlanRow[] = planBlocks.map(block => {
    const matchedEntries = entries.filter(e => {
      const eStart = toLocalMin(e.timestampStart);
      const eEnd = toLocalMin(e.timestampEnd);
      return overlapMin(eStart, eEnd, block.startMin, block.endMin) > 0;
    });
    const coveredMinutes = matchedEntries.reduce((sum, e) => {
      const eStart = toLocalMin(e.timestampStart);
      const eEnd = toLocalMin(e.timestampEnd);
      return sum + overlapMin(eStart, eEnd, block.startMin, block.endMin);
    }, 0);
    return {
      block,
      matchedEntries,
      coveredMinutes,
      plannedMinutes: block.endMin - block.startMin,
    };
  });

  // Unplanned entries: those with no plan block overlap
  const unplannedRows: UnplannedRow[] = entries
    .filter(e => planBlocks.length === 0 || allMatchingBlocks(e, planBlocks).length === 0)
    .map(e => ({ entry: e, durationMinutes: entryDurationMin(e) }));

  // Pie slices: group actual time by plan block activity
  const activityMap = new Map<string, number>();
  for (const entry of entries) {
    const matched = allMatchingBlocks(entry, planBlocks);
    const label = matched.length > 0 ? matched[0].activity : 'Unplanned';
    activityMap.set(label, (activityMap.get(label) ?? 0) + entryDurationMin(entry));
  }

  const pieSlices: PieSlice[] = Array.from(activityMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, minutes], i) => ({
      label,
      minutes,
      percentage: totalActualMinutes > 0 ? Math.round((minutes / totalActualMinutes) * 100) : 0,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
    }));

  // Adherence
  const totalPlannedMinutes = planBlocks.reduce((s, b) => s + (b.endMin - b.startMin), 0);
  const coveredBlockCount = planRows.filter(r => r.coveredMinutes >= MATCH_THRESHOLD).length;
  const totalBlockCount = planBlocks.length;
  const adherencePercent = totalBlockCount > 0
    ? Math.round((coveredBlockCount / totalBlockCount) * 100)
    : 0;

  return {
    planRows,
    unplannedRows,
    pieSlices,
    totalPlannedMinutes,
    totalActualMinutes,
    adherencePercent,
    coveredBlockCount,
    totalBlockCount,
  };
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function dateRangeLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
