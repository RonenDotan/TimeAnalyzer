export interface DayPlan {
  id: number;
  date: string;     // "YYYY-MM-DD"
  createdAt: number;
}

export type BlockSource = 'app' | 'calendar';

export interface PlanBlock {
  id: number;
  planId: number;
  startMin: number; // minutes from midnight (480 = 08:00)
  endMin: number;
  activity: string;
  calendarEventId: string | null;
  source: BlockSource;
}

export type ParsedBlock = Pick<PlanBlock, 'startMin' | 'endMin' | 'activity'>;
