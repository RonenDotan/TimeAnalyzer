import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { PermissionsAndroid } from 'react-native';
import CheckInScreen from '../src/screens/CheckInScreen';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import TranscriptionService from '../src/services/TranscriptionService';
import StorageService from '../src/services/StorageService';

const mockRecorder = AudioRecorderPlayer as jest.Mocked<typeof AudioRecorderPlayer>;

const PERIOD_START    = new Date('2026-01-01T10:00:00').getTime();
const PERIOD_END      = new Date('2026-01-01T12:00:00').getTime();
const FAKE_PATH       = '/tmp/checkin_123.mp4';
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
  jest.clearAllMocks();
  mockRecorder.startRecorder.mockResolvedValue(FAKE_PATH);
  mockRecorder.stopRecorder.mockResolvedValue(FAKE_PATH);
  mockRecorder.startPlayer.mockResolvedValue('');
  mockRecorder.stopPlayer.mockResolvedValue('');
  jest.spyOn(TranscriptionService, 'transcribe').mockResolvedValue(FAKE_TRANSCRIPT);
  jest.spyOn(StorageService, 'save').mockResolvedValue(undefined);
  jest.spyOn(RNFS, 'unlink').mockResolvedValue(undefined);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(
    PermissionsAndroid.RESULTS.GRANTED,
  );
});

// ─── helpers ──────────────────────────────────────────────────────────────────

async function tapText(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  await ReactTestRenderer.act(async () => {
    let node = renderer.root
      .findAll(el => (el.type as string) === 'Text' && el.props.children === label)[0];
    // Walk up until we find the pressable ancestor
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

test('tapping Record calls startRecorder and switches to recording phase', async () => {
  const renderer = await renderScreen();
  await tapText(renderer, 'Record');
  expect(mockRecorder.startRecorder).toHaveBeenCalledWith(expect.stringContaining('.mp4'));
  expect(JSON.stringify(renderer.toJSON())).toContain('Stop');
});

test('tapping Stop calls stopRecorder, transcribes, then shows confirm screen', async () => {
  const renderer = await renderScreen();
  await reachConfirmScreen(renderer);
  expect(mockRecorder.stopRecorder).toHaveBeenCalled();
  expect(TranscriptionService.transcribe).toHaveBeenCalled();
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('Did we get that right');
  expect(tree).toContain(FAKE_TRANSCRIPT);
});

// ─── playback ─────────────────────────────────────────────────────────────────

test('tapping play calls startPlayer with the recorded file path', async () => {
  const renderer = await renderScreen();
  await reachConfirmScreen(renderer);
  await tapText(renderer, '▶');
  expect(mockRecorder.startPlayer).toHaveBeenCalledWith(FAKE_PATH);
});

test('playback auto-stops when listener fires with currentPosition >= duration', async () => {
  let playbackCb: ((e: { currentPosition: number; duration: number }) => void) | null = null;
  mockRecorder.addPlayBackListener.mockImplementation(cb => { playbackCb = cb; });

  const renderer = await renderScreen();
  await reachConfirmScreen(renderer);
  await tapText(renderer, '▶');

  await ReactTestRenderer.act(async () => {
    playbackCb!({ currentPosition: 5000, duration: 5000 });
  });

  expect(mockRecorder.stopPlayer).toHaveBeenCalled();
  expect(mockRecorder.removePlayBackListener).toHaveBeenCalled();
});

// ─── cleanup ──────────────────────────────────────────────────────────────────

test('Re-record stops player and deletes the audio file', async () => {
  const renderer = await renderScreen();
  await reachConfirmScreen(renderer);
  await tapText(renderer, 'Re-record');

  expect(mockRecorder.stopPlayer).toHaveBeenCalled();
  expect(RNFS.unlink).toHaveBeenCalledWith(FAKE_PATH);
  expect(JSON.stringify(renderer.toJSON())).toContain('Record');
});

test('Confirm saves to StorageService, deletes audio file, and calls onDone', async () => {
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
  expect(RNFS.unlink).toHaveBeenCalledWith(FAKE_PATH);
  expect(onDone).toHaveBeenCalledWith(FAKE_TRANSCRIPT);
});
