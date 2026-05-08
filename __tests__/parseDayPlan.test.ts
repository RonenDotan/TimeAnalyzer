import { parseDayPlan, formatMin } from '../src/utils/parseDayPlan';

// ─── formatMin ────────────────────────────────────────────────────────────────

describe('formatMin', () => {
  it('formats midnight',  () => expect(formatMin(0)).toBe('00:00'));
  it('formats noon',      () => expect(formatMin(720)).toBe('12:00'));
  it('formats 9:30',      () => expect(formatMin(570)).toBe('09:30'));
  it('formats 23:59',     () => expect(formatMin(1439)).toBe('23:59'));
});

// ─── Existing behaviour (must not regress) ────────────────────────────────────

describe('parseDayPlan — existing', () => {
  it('parses basic 24h range', () => {
    const [b] = parseDayPlan('8:00-10:00 deep work');
    expect(b).toEqual({ startMin: 480, endMin: 600, activity: 'deep work' });
  });

  it('parses word hours', () => {
    const [b] = parseDayPlan('eight to ten deep work');
    expect(b.startMin).toBe(480);
    expect(b.endMin).toBe(600);
  });

  it('parses pm heuristic (10 to 2 = 10:00–14:00)', () => {
    const [b] = parseDayPlan('10 to 2 meetings');
    expect(b.startMin).toBe(600);
    expect(b.endMin).toBe(840);
  });

  it('parses multiple blocks separated by comma', () => {
    const blocks = parseDayPlan('8-10 work, 10-12 meetings');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ startMin: 480, endMin: 600, activity: 'work' });
    expect(blocks[1]).toEqual({ startMin: 600, endMin: 720, activity: 'meetings' });
  });

  it('parses "and then" separator', () => {
    const blocks = parseDayPlan('8-10 coding and then 10-12 review');
    expect(blocks[0].activity).toBe('coding');
    expect(blocks[1].activity).toBe('review');
  });

  it('parses "from X to Y" format', () => {
    const [b] = parseDayPlan('from 9 to 11 planning');
    expect(b.startMin).toBe(540);
    expect(b.endMin).toBe(660);
  });

  it('parses named times', () => {
    const [b] = parseDayPlan('noon to 14:00 lunch break');
    expect(b.startMin).toBe(720);
    expect(b.endMin).toBe(840);
  });

  it('parses "till" connector', () => {
    const [b] = parseDayPlan('9 till 11 deep work');
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(11 * 60);
    expect(b.activity).toBe('deep work');
  });

  it('parses "until" connector', () => {
    const [b] = parseDayPlan('9 until 11 planning');
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(11 * 60);
  });

  it('returns empty array for unparseable input', () => {
    expect(parseDayPlan('')).toHaveLength(0);
    expect(parseDayPlan('no time blocks here')).toHaveLength(0);
  });

  it('parses time range with no activity label', () => {
    const [b] = parseDayPlan('14 to 16');
    expect(b.startMin).toBe(840);
    expect(b.endMin).toBe(960);
    expect(b.activity).toBe('');
  });

  it('parses "and" as separator', () => {
    const blocks = parseDayPlan('8 to 10 coding and 10 to 12 meetings');
    expect(blocks[0].activity).toBe('coding');
    expect(blocks[1].activity).toBe('meetings');
  });

  it('parses HH:MM format with dashes', () => {
    const [b] = parseDayPlan('09:00-11:30 deep work');
    expect(b.startMin).toBe(540);
    expect(b.endMin).toBe(690);
  });
});

// ─── Normalization: clock expressions ─────────────────────────────────────────

describe('parseDayPlan — normalization', () => {
  it('parses "half past nine"', () => {
    const [b] = parseDayPlan('half past nine to eleven standup');
    expect(b.startMin).toBe(9 * 60 + 30);  // 9:30
    expect(b.endMin).toBe(11 * 60);
    expect(b.activity).toBe('standup');
  });

  it('parses "quarter past nine"', () => {
    const [b] = parseDayPlan('quarter past nine to ten meeting');
    expect(b.startMin).toBe(9 * 60 + 15);  // 9:15
    expect(b.endMin).toBe(10 * 60);
  });

  it('parses "quarter to ten"', () => {
    const [b] = parseDayPlan('quarter to ten to eleven coding');
    expect(b.startMin).toBe(9 * 60 + 45);  // 9:45
    expect(b.endMin).toBe(11 * 60);
  });

  it('parses word hour + minute ("nine thirty")', () => {
    const [b] = parseDayPlan('nine thirty to eleven deep work');
    expect(b.startMin).toBe(9 * 60 + 30);  // 9:30
    expect(b.endMin).toBe(11 * 60);
  });

  it('parses word hour + minute ("eight fifteen")', () => {
    const [b] = parseDayPlan('eight fifteen to nine standup');
    expect(b.startMin).toBe(8 * 60 + 15);  // 8:15
    expect(b.endMin).toBe(9 * 60);
  });

  it('parses "nine o\'clock"', () => {
    const [b] = parseDayPlan("nine o'clock to ten standup");
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(10 * 60);
  });

  it('parses "nine oclock"', () => {
    const [b] = parseDayPlan('nine oclock to ten standup');
    expect(b.startMin).toBe(9 * 60);
  });

  it('parses "in the morning" qualifier', () => {
    const [b] = parseDayPlan('9 in the morning to 11 backend work');
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(11 * 60);
  });

  it('parses "in the afternoon" qualifier', () => {
    const [b] = parseDayPlan('3 in the afternoon to 5 code review');
    expect(b.startMin).toBe(15 * 60);  // 15:00
    expect(b.endMin).toBe(17 * 60);
  });

  it('parses decimal notation "9.30"', () => {
    const [b] = parseDayPlan('9.30 to 11 deep work');
    expect(b.startMin).toBe(9 * 60 + 30);  // 9:30
    expect(b.endMin).toBe(11 * 60);
  });

  it('parses "a.m." / "p.m." dot notation', () => {
    const [b] = parseDayPlan('9 a.m. to 11 a.m. work');
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(11 * 60);
  });

  it('strips "around" qualifier', () => {
    const [b] = parseDayPlan('morning till around eleven standup');
    expect(b.startMin).toBe(8 * 60);   // morning = 8:00
    expect(b.endMin).toBe(11 * 60);
  });
});

// ─── New named times ──────────────────────────────────────────────────────────

describe('parseDayPlan — extended named times', () => {
  it('parses "midday"', () => {
    const [b] = parseDayPlan('midday to 13:00 lunch');
    expect(b.startMin).toBe(12 * 60);
  });

  it('parses "eod"', () => {
    const [b] = parseDayPlan('16 to eod wrap up');
    expect(b.endMin).toBe(17 * 60);
  });

  it('parses "end of day"', () => {
    const [b] = parseDayPlan('16 to end of day wrap up');
    expect(b.endMin).toBe(17 * 60);
  });

  it('parses "early morning"', () => {
    const [b] = parseDayPlan('early morning to 9 prep');
    expect(b.startMin).toBe(7 * 60);
  });

  it('parses "morning" as 8:00', () => {
    const [b] = parseDayPlan('morning to noon deep work');
    expect(b.startMin).toBe(8 * 60);
    expect(b.endMin).toBe(12 * 60);
  });
});

// ─── Activity-first pattern ───────────────────────────────────────────────────

describe('parseDayPlan — activity-first', () => {
  it('parses "standup 9 to 10"', () => {
    const [b] = parseDayPlan('standup 9 to 10');
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(10 * 60);
    expect(b.activity).toBe('standup');
  });

  it('parses "deep work from 9 to 11"', () => {
    const [b] = parseDayPlan('deep work from 9 to 11');
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(11 * 60);
    expect(b.activity).toBe('deep work');
  });

  it('parses multi-word activity-first', () => {
    const [b] = parseDayPlan('backend development 9 to 11');
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(11 * 60);
    expect(b.activity).toBe('backend development');
  });

  it('parses activity-first mixed with time-first in same input', () => {
    const blocks = parseDayPlan('standup 9 to 10, from 10 to 12 coding');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].activity).toBe('standup');
    expect(blocks[1].activity).toBe('coding');
  });
});

// ─── Duration pattern ─────────────────────────────────────────────────────────

describe('parseDayPlan — duration', () => {
  it('parses "from 9 for 2 hours coding"', () => {
    const [b] = parseDayPlan('from 9 for 2 hours coding');
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(11 * 60);
    expect(b.activity).toBe('coding');
  });

  it('parses "from 9 for two hours"', () => {
    const [b] = parseDayPlan('from 9 for two hours backend');
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(11 * 60);
  });

  it('parses "9 for 1.5 hours"', () => {
    const [b] = parseDayPlan('9 for 1.5 hours meeting');
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(9 * 60 + 90);  // 10:30
  });

  it('parses "9 for half an hour standup"', () => {
    const [b] = parseDayPlan('9 for half an hour standup');
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(9 * 60 + 30);  // 9:30
  });

  it('parses "9 for an hour"', () => {
    const [b] = parseDayPlan('9 for an hour standup');
    expect(b.startMin).toBe(9 * 60);
    expect(b.endMin).toBe(10 * 60);
  });
});

// ─── PM carryover between blocks ─────────────────────────────────────────────

describe('parseDayPlan — PM carryover', () => {
  it('auto-shifts early-hour block after afternoon block', () => {
    const blocks = parseDayPlan('9 to 11 work, 2 to 4 meetings');
    expect(blocks).toHaveLength(2);
    expect(blocks[1].startMin).toBe(14 * 60);  // 14:00
    expect(blocks[1].endMin).toBe(16 * 60);    // 16:00
  });

  it('auto-shifts "1 to 2 lunch" after morning block', () => {
    const blocks = parseDayPlan('9 to 11 work, 1 to 2 lunch');
    expect(blocks[1].startMin).toBe(13 * 60);  // 13:00
    expect(blocks[1].endMin).toBe(14 * 60);
  });

  it('does not shift a block that starts after 7am', () => {
    // 10:00 after 9–11 should stay as 10:00 (overlap is possible)
    const blocks = parseDayPlan('9 to 11 work, 10 to 12 review');
    expect(blocks[1].startMin).toBe(10 * 60);
  });

  it('does not shift when no previous block', () => {
    const [b] = parseDayPlan('2 to 4 work');
    expect(b.startMin).toBe(2 * 60);  // stays at 2:00 — no context
  });
});
