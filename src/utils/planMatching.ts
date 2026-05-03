import { LogEntry } from '../types/LogEntry';
import { PlanBlock } from '../types/DayPlan';

export function toLocalMin(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

export function overlapMin(
  aStart: number, aEnd: number,
  bStart: number, bEnd: number,
): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

const MATCH_THRESHOLD = 30;

export function bestMatchingBlock(entry: LogEntry, blocks: PlanBlock[]): PlanBlock | null {
  const eStart = toLocalMin(entry.timestampStart);
  const eEnd = toLocalMin(entry.timestampEnd);
  let best: PlanBlock | null = null;
  let bestOverlap = MATCH_THRESHOLD;
  for (const block of blocks) {
    const overlap = overlapMin(eStart, eEnd, block.startMin, block.endMin);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = block;
    }
  }
  return best;
}

export function allMatchingBlocks(entry: LogEntry, blocks: PlanBlock[]): PlanBlock[] {
  const eStart = toLocalMin(entry.timestampStart);
  const eEnd = toLocalMin(entry.timestampEnd);
  return blocks.filter(b => overlapMin(eStart, eEnd, b.startMin, b.endMin) > 0);
}

export function isCovered(block: PlanBlock, entries: LogEntry[]): boolean {
  return entries.some(e =>
    overlapMin(toLocalMin(e.timestampStart), toLocalMin(e.timestampEnd), block.startMin, block.endMin) >= MATCH_THRESHOLD,
  );
}
