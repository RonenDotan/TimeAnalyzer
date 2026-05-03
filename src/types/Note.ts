export interface Note {
  id: number;        // INTEGER PRIMARY KEY AUTOINCREMENT
  entryId: number;   // FK → log_entries.id
  text: string;
  createdAt: number; // epoch ms
}
