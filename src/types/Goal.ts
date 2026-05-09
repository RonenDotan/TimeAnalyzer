export type GoalStatus = 'active' | 'done' | 'canceled';

export interface Goal {
  id: number;
  text: string;
  startAt: number;        // epoch ms — when goal becomes active
  targetAt: number | null; // epoch ms — optional deadline (includes time)
  progress: number;       // 0–100
  status: GoalStatus;
  createdAt: number;      // epoch ms
  updatedAt: number;      // epoch ms

  // Future: Google Tasks sync fields (issue #25)
  // taskId?: string;
  // listId?: string;
  // syncedAt?: number;
}

export interface GoalContribution {
  id: number;
  goalId: number;
  entryId: number | null;  // null = manual update not tied to a check-in
  contributionPct: number; // delta added in this session (e.g. 15 = +15%)
  createdAt: number;       // epoch ms
}

/** Lightweight summary used when showing what a single entry contributed to each goal. */
export interface GoalEntryContribution {
  goalId: number;
  goalText: string;
  contributionPct: number; // delta (e.g. +15)
}
