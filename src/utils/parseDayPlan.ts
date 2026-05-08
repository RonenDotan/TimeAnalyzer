import { ParsedBlock } from '../types/DayPlan';

// ─── Lookup tables ────────────────────────────────────────────────────────────

const WORD_NUMS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20,
  'twenty one': 21, 'twenty two': 22, 'twenty three': 23,
};

// Word forms for sub-hour minutes ("nine thirty" → 9:30)
const WORD_MINS: Record<string, number> = {
  'oh five': 5, ten: 10, fifteen: 15, twenty: 20, 'twenty five': 25,
  thirty: 30, 'thirty five': 35, forty: 40, 'forty five': 45,
  fifty: 50, 'fifty five': 55,
};

const NAMED_TIMES: Record<string, number> = {
  'early morning': 7 * 60,
  'after lunch':  13 * 60,
  'late afternoon': 16 * 60,
  'end of day':   17 * 60,
  midnight:        0,
  morning:         8 * 60,
  noon:           12 * 60,
  midday:         12 * 60,
  lunchtime:      12 * 60,
  lunch:          12 * 60,
  afternoon:      14 * 60,
  eod:            17 * 60,
  evening:        18 * 60,
  night:          21 * 60,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Parse just a bare hour (word or digit) — used during normalization. */
function parseHourWord(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (WORD_NUMS[t] !== undefined) return WORD_NUMS[t] <= 23 ? WORD_NUMS[t] : null;
  const m = t.match(/^(\d{1,2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  return h <= 23 ? h : null;
}

// ─── Input normalization ──────────────────────────────────────────────────────

/**
 * Convert natural-language time expressions to simple numeric forms
 * before the main regex matching runs.
 */
function normalizeInput(raw: string): string {
  let s = raw.toLowerCase();

  // "around X" → strip "around" (treat as approximate, ignore the qualifier)
  s = s.replace(/\baround\s+/g, '');

  // a.m. / p.m. (with dots) → am / pm
  s = s.replace(/\ba\.m\./g, 'am').replace(/\bp\.m\./g, 'pm');

  // "an hour" / "half an hour" → normalized duration strings
  s = s.replace(/\bhalf\s+an?\s+hours?\b/g, '0.5 hours');
  s = s.replace(/\ban?\s+hours?\b/g, '1 hour');

  // "quarter to X" → e.g. "quarter to ten" → "09:45"
  s = s.replace(/quarter\s+to\s+(\w+)/g, (orig, h) => {
    const hour = parseHourWord(h);
    return hour !== null ? formatMin(hour * 60 - 15) : orig;
  });

  // "quarter past X" → X:15
  s = s.replace(/quarter\s+past\s+(\w+)/g, (orig, h) => {
    const hour = parseHourWord(h);
    return hour !== null ? formatMin(hour * 60 + 15) : orig;
  });

  // "half past X" → X:30
  s = s.replace(/half\s+past\s+(\w+)/g, (orig, h) => {
    const hour = parseHourWord(h);
    return hour !== null ? formatMin(hour * 60 + 30) : orig;
  });

  // "X o'clock" / "X oclock" → bare number
  s = s.replace(/(\w+)\s+o'?clock/g, (orig, h) => {
    const hour = parseHourWord(h);
    return hour !== null ? String(hour) : orig;
  });

  // "X in the morning" → Xam
  s = s.replace(/(\d+(?:[.:]\d{2})?|\w+)\s+in\s+the\s+morning/g, (_, t) => `${t}am`);

  // "X in the afternoon/evening" → Xpm
  s = s.replace(/(\d+(?:[.:]\d{2})?|\w+)\s+in\s+the\s+(?:afternoon|evening)/g, (_, t) => `${t}pm`);

  // Word hour + word minute → "9:30"
  // Sort by minWord length descending so "twenty five" is tried before "twenty"
  const sortedMins = Object.entries(WORD_MINS).sort((a, b) => b[0].length - a[0].length);
  for (const [hourWord, hourVal] of Object.entries(WORD_NUMS)) {
    for (const [minWord, minVal] of sortedMins) {
      s = s.replace(
        new RegExp(`\\b${hourWord}\\s+${minWord}\\b`, 'g'),
        `${hourVal}:${String(minVal).padStart(2, '0')}`,
      );
    }
  }

  // European decimal notation "9.30" → "9:30"
  s = s.replace(/\b(\d{1,2})\.(\d{2})\b/g, '$1:$2');

  return s;
}

// ─── Regex components ─────────────────────────────────────────────────────────

function escapeForRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

const NAMED_PATTERN = Object.keys(NAMED_TIMES)
  .sort((a, b) => b.length - a.length)
  .map(escapeForRegex)
  .join('|');

// Sort word numbers by length desc so "twenty one" is tried before "twenty"
const WORD_PATTERN = Object.keys(WORD_NUMS)
  .sort((a, b) => b.length - a.length)
  .join('|');

const TIME_TOKEN = `(?:${NAMED_PATTERN}|${WORD_PATTERN}|\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)`;

const CONNECTOR = `(?:\\s+to\\s+|\\s+until\\s+|\\s+till\\s+|\\s*[-–]\\s*)`;

// "[from] TIME [to|until|-] TIME [activity]"  (standard time-first)
const RANGE_RE = new RegExp(
  `^(?:from\\s+)?(${TIME_TOKEN})${CONNECTOR}(${TIME_TOKEN})\\s*(.*)$`,
  'i',
);

// "activity [from] TIME [to|until|-] TIME"  (activity-first e.g. "standup 9 to 10")
const ACTIVITY_FIRST_RE = new RegExp(
  `^(.+?)\\s+(?:from\\s+)?(${TIME_TOKEN})${CONNECTOR}(${TIME_TOKEN})\\s*$`,
  'i',
);

// "[from] TIME for X hours [activity]"  (duration e.g. "from 9 for 2 hours coding")
const DURATION_RE = new RegExp(
  `^(?:from\\s+)?(${TIME_TOKEN})\\s+for\\s+(${WORD_PATTERN}|0\\.5|\\d+(?:\\.5)?)\\s+hours?\\s*(.*)$`,
  'i',
);

// ─── Time token parser ────────────────────────────────────────────────────────

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

// ─── Segment → block ─────────────────────────────────────────────────────────

function resolveEnd(startMin: number, endMin: number): number {
  // "10 to 2" → endMin(120) < startMin(600) and < noon → assume PM
  return endMin <= startMin && endMin < 12 * 60 ? endMin + 12 * 60 : endMin;
}

function parseSegment(segment: string): ParsedBlock | null {
  const trimmed = segment.trim();
  if (!trimmed) return null;

  // 1. Standard time-first: "9 to 11 work" / "from 9 to 11 work"
  const rf = trimmed.match(RANGE_RE);
  if (rf) {
    const startMin = parseTimeToken(rf[1]);
    const endMin   = parseTimeToken(rf[2]);
    if (startMin !== null && endMin !== null) {
      const resolved = resolveEnd(startMin, endMin);
      if (resolved > startMin) return { startMin, endMin: resolved, activity: rf[3].trim() };
    }
  }

  // 2. Duration: "from 9 for 2 hours coding"
  const rd = trimmed.match(DURATION_RE);
  if (rd) {
    const startMin  = parseTimeToken(rd[1]);
    const durStr    = rd[2].toLowerCase().trim();
    const durHours  = WORD_NUMS[durStr] ?? parseFloat(durStr);
    if (startMin !== null && !isNaN(durHours) && durHours > 0) {
      return { startMin, endMin: startMin + Math.round(durHours * 60), activity: rd[3].trim() };
    }
  }

  // 3. Activity-first: "standup 9 to 10" / "deep work from 9 to 11"
  const ra = trimmed.match(ACTIVITY_FIRST_RE);
  if (ra) {
    const activity  = ra[1].trim();
    const startMin  = parseTimeToken(ra[2]);
    const endMin    = parseTimeToken(ra[3]);
    if (startMin !== null && endMin !== null) {
      const resolved = resolveEnd(startMin, endMin);
      if (resolved > startMin) return { startMin, endMin: resolved, activity };
    }
  }

  return null;
}

// ─── Block separators ─────────────────────────────────────────────────────────

const BLOCK_SEPARATORS = /,\s*|\s+(?:and\s+then|after\s+that|then|and)\s+/i;

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseDayPlan(raw: string): ParsedBlock[] {
  const normalized = normalizeInput(raw);
  const blocks: ParsedBlock[] = [];

  for (const segment of normalized.split(BLOCK_SEPARATORS)) {
    const block = parseSegment(segment);
    if (block) blocks.push(block);
  }

  // Post-process: if a block's start time looks implausibly early (before 7am)
  // relative to the previous block, assume it was meant as PM.
  // Handles: "9 to 11 work, 2 to 4 meetings" → second block → 14:00–16:00
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1];
    const curr = blocks[i];
    if (curr.startMin < 7 * 60 && curr.startMin < prev.endMin) {
      const adjStart = curr.startMin + 12 * 60;
      const adjEnd   = curr.endMin   + 12 * 60;
      if (adjEnd <= 24 * 60 && adjStart > prev.endMin) {
        blocks[i] = { ...curr, startMin: adjStart, endMin: adjEnd };
      }
    }
  }

  return blocks;
}
