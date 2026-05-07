import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { PermissionsAndroid } from 'react-native';
import CheckInScreen from '../src/screens/CheckInScreen';
import SchedulerService from '../src/services/SchedulerService';
import StorageService from '../src/services/StorageService';
import TranscriptionService from '../src/services/TranscriptionService';

const PERIOD_START    = new Date('2026-01-01T10:00:00').getTime();
const PERIOD_END      = new Date('2026-01-01T12:00:00').getTime();
const FAKE_TRANSCRIPT = 'I worked on the scheduler.';

async function renderScreen(onDone = jest.fn(), onCancel = jest.fn()) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CheckInScreen
        periodStart={PERIOD_START}
        periodEnd={PERIOD_END}
        onDone={onDone}
        onCancel={onCancel}
      />,
    );
  });
  return renderer;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(TranscriptionService, 'start').mockResolvedValue(undefined);
  jest.spyOn(TranscriptionService, 'stop').mockResolvedValue(FAKE_TRANSCRIPT);
  jest.spyOn(StorageService, 'save').mockResolvedValue({ id: 1, timestampStart: PERIOD_START, timestampEnd: PERIOD_END, transcript: FAKE_TRANSCRIPT, calendarEventId: null, source: 'app' as const });
  jest.spyOn(SchedulerService, 'hasMoreCheckInsToday').mockResolvedValue(true);
  jest.spyOn(SchedulerService, 'fireEndOfDayReport').mockResolvedValue(undefined);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(
    PermissionsAndroid.RESULTS.GRANTED,
  );
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── helpers ──────────────────────────────────────────────────────────────────

async function tapText(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  await ReactTestRenderer.act(async () => {
    let node = renderer.root
      .findAll(el => (el.type as string) === 'Text' && el.props.children === label)[0];
    while (node && typeof node.props.onPress !== 'function') {
      node = node.parent!;
    }
    node.props.onPress();
  });
}

async function reachConfirmScreen(renderer: ReactTestRenderer.ReactTestRenderer) {
  await tapText(renderer, 'Record');
  await tapText(renderer, 'Stop');
}

// ─── phase transitions ────────────────────────────────────────────────────────

test('starts in idle phase showing Record button', async () => {
  const tree = JSON.stringify((await renderScreen()).toJSON());
  expect(tree).toContain('Record');
  expect(tree).not.toContain('Stop');
  expect(tree).not.toContain('Did we get that right');
});

test('tapping Record calls TranscriptionService.start and switches to recording phase', async () => {
  const renderer = await renderScreen();
  await tapText(renderer, 'Record');
  expect(TranscriptionService.start).toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain('Stop');
});

test('tapping Stop calls TranscriptionService.stop then shows confirm screen with transcript', async () => {
  const renderer = await renderScreen();
  await reachConfirmScreen(renderer);
  expect(TranscriptionService.stop).toHaveBeenCalled();
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('Review your check-in');
  expect(tree).toContain(FAKE_TRANSCRIPT);
});

// ─── live partial results ─────────────────────────────────────────────────────

test('partial results update the displayed text during recording', async () => {
  let partialCb: ((text: string) => void) | null = null;
  jest.spyOn(TranscriptionService, 'start').mockImplementation(async (onPartial) => {
    partialCb = onPartial;
  });

  const renderer = await renderScreen();
  await tapText(renderer, 'Record');

  await ReactTestRenderer.act(async () => {
    partialCb?.('I worked on');
  });

  expect(JSON.stringify(renderer.toJSON())).toContain('I worked on');
});

// ─── re-record ────────────────────────────────────────────────────────────────

test('Re-record resets to idle phase', async () => {
  const renderer = await renderScreen();
  await reachConfirmScreen(renderer);
  await tapText(renderer, 'Re-record');
  expect(JSON.stringify(renderer.toJSON())).toContain('Record');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Did we get that right');
});

// ─── confirm ──────────────────────────────────────────────────────────────────

test('Confirm saves to StorageService and calls onDone', async () => {
  const onDone = jest.fn();
  const renderer = await renderScreen(onDone);
  await reachConfirmScreen(renderer);
  await tapText(renderer, 'Confirm');

  expect(StorageService.save).toHaveBeenCalledWith(
    expect.objectContaining({
      timestampStart: PERIOD_START,
      timestampEnd: PERIOD_END,
      transcript: FAKE_TRANSCRIPT,
    }),
  );
  expect(onDone).toHaveBeenCalledWith(FAKE_TRANSCRIPT);
});
