import { parseDayPlan, formatMin } from '../src/utils/parseDayPlan';

describe('formatMin', () => {
  it('formats midnight', () => expect(formatMin(0)).toBe('00:00'));
  it('formats noon', () => expect(formatMin(720)).toBe('12:00'));
  it('formats 9:30', () => expect(formatMin(570)).toBe('09:30'));
  it('formats 23:59', () => expect(formatMin(1439)).toBe('23:59'));
});

describe('parseDayPlan', () => {
  it('parses basic 24h range', () => {
    const blocks = parseDayPlan('8:00-10:00 deep work');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ startMin: 480, endMin: 600, activity: 'deep work' });
  });

  it('parses word hours', () => {
    const blocks = parseDayPlan('eight to ten deep work');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].startMin).toBe(480);
    expect(blocks[0].endMin).toBe(600);
  });

  it('parses pm heuristic (10 to 2 = 10:00-14:00)', () => {
    const blocks = parseDayPlan('10 to 2 meetings');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].startMin).toBe(600);
    expect(blocks[0].endMin).toBe(840);
  });

  it('parses multiple blocks separated by comma', () => {
    const blocks = parseDayPlan('8-10 work, 10-12 meetings');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ startMin: 480, endMin: 600, activity: 'work' });
    expect(blocks[1]).toEqual({ startMin: 600, endMin: 720, activity: 'meetings' });
  });

  it('parses "and then" separator', () => {
    const blocks = parseDayPlan('8-10 coding and then 10-12 review');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].activity).toBe('coding');
    expect(blocks[1].activity).toBe('review');
  });

  it('parses "from X to Y" format', () => {
    const blocks = parseDayPlan('from 9 to 11 planning');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].startMin).toBe(540);
    expect(blocks[0].endMin).toBe(660);
  });

  it('parses named times', () => {
    const blocks = parseDayPlan('noon to 14:00 lunch break');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].startMin).toBe(720);
    expect(blocks[0].endMin).toBe(840);
  });

  it('returns empty array for unparseable input', () => {
    expect(parseDayPlan('')).toHaveLength(0);
    expect(parseDayPlan('no time blocks here')).toHaveLength(0);
  });

  it('parses time range with no activity label', () => {
    const blocks = parseDayPlan('14 to 16');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].startMin).toBe(840);
    expect(blocks[0].endMin).toBe(960);
    expect(blocks[0].activity).toBe('');
  });

  it('parses "and" as separator', () => {
    const blocks = parseDayPlan('8 to 10 coding and 10 to 12 meetings');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].activity).toBe('coding');
    expect(blocks[1].activity).toBe('meetings');
  });

  it('parses HH:MM format with dashes', () => {
    const blocks = parseDayPlan('09:00-11:30 deep work');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].startMin).toBe(540);
    expect(blocks[0].endMin).toBe(690);
  });
});
