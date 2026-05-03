export interface DayPlan {
  id: number;
  date: string;     // "YYYY-MM-DD"
  createdAt: number;
}

export interface PlanBlock {
  id: number;
  planId: number;
  startMin: number; // minutes from midnight (480 = 08:00)
  endMin: number;
  activity: string;
}

export type ParsedBlock = Pick<PlanBlock, 'startMin' | 'endMin' | 'activity'>;
