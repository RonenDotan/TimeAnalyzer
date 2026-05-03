const NOTE_MARKER = /\bnote\s*[:–\-]/i;

export function parseTranscriptAndNotes(raw: string): {
  transcript: string;
  notes: string[];
} {
  const parts = raw.split(NOTE_MARKER);
  const transcript = parts[0].trim();
  const notes = parts.slice(1).map(n => n.trim()).filter(n => n.length > 0);
  return { transcript, notes };
}
