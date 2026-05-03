// Explicit separator: "note:" / "note," / "note-" / "note–"
const NOTE_MARKER = /\bnote\s*[,.:–\-]\s*/i;

export function parseTranscriptAndNotes(raw: string): {
  transcript: string;
  notes: string[];
} {
  // Speech recognition rarely outputs colons. Normalize "note" at the start of a
  // new sentence (after . ! ?) without an explicit separator, e.g.:
  //   "Worked on auth. Note check the PR" → "Worked on auth. Note: check the PR"
  const normalized = raw.replace(/([.!?]\s+)(note)(?!\s*[,.:–\-])\s/gi, '$1$2: ');

  const parts = normalized.split(NOTE_MARKER);
  const transcript = parts[0].trim();
  const notes = parts.slice(1).map(n => n.trim()).filter(n => n.length > 0);
  return { transcript, notes };
}
