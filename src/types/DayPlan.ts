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
  status: 0 | 1;       // 1=active, 0=pending delete
  updatedAt: number;   // Unix epoch ms
  syncedAt: number | null; // Unix epoch ms, null = never synced
}

export type ParsedBlock = Pick<PlanBlock, 'startMin' | 'endMin' | 'activity'>;

export type PlanBlockWithDate = PlanBlock & { date: string };
