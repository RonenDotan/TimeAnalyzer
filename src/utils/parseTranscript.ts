/**
 * Apply a transcription result to existing text.
 * If the transcription starts with appendKeyword + space, the rest is appended.
 * Otherwise the existing text is replaced entirely.
 */
export function applyTranscription(existing: string, raw: string, appendKeyword = 'append'): string {
  const trimmed = raw.trim();
  const escaped = appendKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = trimmed.match(new RegExp(`^${escaped}\\s+([\\s\\S]+)`, 'i'));
  if (match) {
    const toAppend = match[1].trim();
    return existing.trim() ? `${existing.trim()} ${toAppend}` : toAppend;
  }
  return trimmed;
}

export function parseTranscriptAndNotes(raw: string, noteKeyword = 'note'): {
  transcript: string;
  notes: string[];
} {
  const escaped = noteKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const NOTE_MARKER = new RegExp(`\\b${escaped}\\s*[,.:–\\-]\\s*`, 'gi');
  // Speech recognition rarely outputs colons — normalize keyword after sentence
  // boundary without explicit separator, e.g. "Done. Note check PR" → "Done. Note: check PR"
  const normalized = raw.replace(
    new RegExp(`([.!?]\\s+)(${escaped})(?!\\s*[,.:–\\-])\\s`, 'gi'),
    '$1$2: ',
  );
  const parts = normalized.split(NOTE_MARKER);
  const transcript = parts[0].trim();
  const notes = parts.slice(1).map(n => n.trim()).filter(n => n.length > 0);
  return { transcript, notes };
}
