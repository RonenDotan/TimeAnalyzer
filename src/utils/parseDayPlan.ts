import { ParsedBlock } from '../types/DayPlan';

const WORD_NUMS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20,
};

const NAMED_TIMES: Record<string, number> = {
  'after lunch': 13 * 60,
  'midnight':     0,
  'morning':      9 * 60,
  'noon':        12 * 60,
  'lunch':       12 * 60,
  'afternoon':   14 * 60,
  'evening':     18 * 60,
  'night':       21 * 60,
};

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

const NAMED_PATTERN = Object.keys(NAMED_TIMES)
  .sort((a, b) => b.length - a.length)
  .map(escapeForRegex)
  .join('|');

const WORD_PATTERN = Object.keys(WORD_NUMS).join('|');

const TIME_TOKEN = `(?:${NAMED_PATTERN}|${WORD_PATTERN}|\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)`;

const RANGE_RE = new RegExp(
  `(?:from\\s+)?(${TIME_TOKEN})(?:\\s+to\\s+|\\s+until\\s+|\\s*[-–]\\s*)(${TIME_TOKEN})\\s*(.*)`,
  'i',
);

function parseTimeToken(token: string): number | null {
  const t = token.trim().toLowerCase().replace(/\s+/g, ' ');
  if (NAMED_TIMES[t] !== undefined) return NAMED_TIMES[t];
  if (WORD_NUMS[t] !== undefined) {
    const h = WORD_NUMS[t];
    return h <= 23 ? h * 60 : null;
  }
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] ?? '0', 10);
  const ampm = m[3];
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h <= 23 ? h * 60 + min : null;
}

const BLOCK_SEPARATORS = /,\s*|\s+(?:and\s+then|after\s+that|then)\s+/i;

export function parseDayPlan(raw: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const segments = raw.split(BLOCK_SEPARATORS);

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const match = trimmed.match(RANGE_RE);
    if (!match) continue;

    const startMin = parseTimeToken(match[1]);
    const endMin = parseTimeToken(match[2]);
    const activity = match[3].trim();

    if (startMin === null || endMin === null) continue;
    // If end <= start, try interpreting end as pm (e.g. "10 to 2" → 10:00–14:00)
    const resolvedEnd = endMin <= startMin && endMin < 12 * 60
      ? endMin + 12 * 60
      : endMin;
    if (resolvedEnd <= startMin) continue;
    if (!activity) continue;

    blocks.push({ startMin, endMin: resolvedEnd, activity });
  }

  return blocks;
}

export function formatMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
