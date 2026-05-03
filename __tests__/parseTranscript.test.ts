import { parseTranscriptAndNotes } from '../src/utils/parseTranscript';

test('no marker — returns full text as transcript, no notes', () => {
  const { transcript, notes } = parseTranscriptAndNotes('Worked on auth debugging.');
  expect(transcript).toBe('Worked on auth debugging.');
  expect(notes).toHaveLength(0);
});

test('single note: marker splits correctly', () => {
  const { transcript, notes } = parseTranscriptAndNotes(
    'Worked on auth debugging. Note: check token refresh.',
  );
  expect(transcript).toBe('Worked on auth debugging.');
  expect(notes).toEqual(['check token refresh.']);
});

test('multiple note: markers produce multiple notes', () => {
  const { transcript, notes } = parseTranscriptAndNotes(
    'Fixed the bug. Note: review PR. Note: ask John about rate limits.',
  );
  expect(transcript).toBe('Fixed the bug.');
  expect(notes).toEqual(['review PR.', 'ask John about rate limits.']);
});

test('note - marker (dash) also detected', () => {
  const { transcript, notes } = parseTranscriptAndNotes('Did standup. Note - follow up with Alice.');
  expect(transcript).toBe('Did standup.');
  expect(notes).toEqual(['follow up with Alice.']);
});

test('note, marker (comma) also detected', () => {
  const { transcript, notes } = parseTranscriptAndNotes('Reviewed code. Note, push the fix today.');
  expect(transcript).toBe('Reviewed code.');
  expect(notes).toEqual(['push the fix today.']);
});

test('case insensitive — NOTE: detected', () => {
  const { transcript, notes } = parseTranscriptAndNotes('Reviewed PRs. NOTE: update changelog.');
  expect(transcript).toBe('Reviewed PRs.');
  expect(notes).toEqual(['update changelog.']);
});

test('no separator — note after sentence boundary detected (speech recognition output)', () => {
  const { transcript, notes } = parseTranscriptAndNotes(
    'Worked on auth debugging. Note check token refresh.',
  );
  expect(transcript).toBe('Worked on auth debugging.');
  expect(notes).toEqual(['check token refresh.']);
});

test('no separator — multiple notes after sentence boundaries', () => {
  const { transcript, notes } = parseTranscriptAndNotes(
    'Fixed the bug. Note review PR. Note ask John about rate limits.',
  );
  expect(transcript).toBe('Fixed the bug.');
  expect(notes).toEqual(['review PR.', 'ask John about rate limits.']);
});

test('note mid-sentence without boundary — not split (avoids false positives)', () => {
  const { transcript, notes } = parseTranscriptAndNotes('I made a note of that.');
  expect(transcript).toBe('I made a note of that.');
  expect(notes).toHaveLength(0);
});

test('empty string — returns empty transcript and no notes', () => {
  const { transcript, notes } = parseTranscriptAndNotes('');
  expect(transcript).toBe('');
  expect(notes).toHaveLength(0);
});
