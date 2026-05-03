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

test('case insensitive — NOTE: detected', () => {
  const { transcript, notes } = parseTranscriptAndNotes('Reviewed PRs. NOTE: update changelog.');
  expect(transcript).toBe('Reviewed PRs.');
  expect(notes).toEqual(['update changelog.']);
});

test('empty string — returns empty transcript and no notes', () => {
  const { transcript, notes } = parseTranscriptAndNotes('');
  expect(transcript).toBe('');
  expect(notes).toHaveLength(0);
});
