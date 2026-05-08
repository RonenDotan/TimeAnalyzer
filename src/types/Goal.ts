export interface Goal {
  id: number;        // INTEGER PRIMARY KEY AUTOINCREMENT
  date: string;      // 'YYYY-MM-DD'
  text: string;      // what the user wants to achieve
  done: boolean;     // tapped to check off
  sortOrder: number; // display order within the day
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms

  // Future: Google Tasks sync fields (issue #25)
  // taskId?: string;   // Google Tasks task ID
  // listId?: string;   // Google Tasks list ID
  // syncedAt?: number; // epoch ms of last successful sync
}
