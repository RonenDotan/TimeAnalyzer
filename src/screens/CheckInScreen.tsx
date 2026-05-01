import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AudioRecorderPlayer, { PlayBackType, RecordBackType } from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StorageService from '../services/StorageService';
import TranscriptionService from '../services/TranscriptionService';
import { AudioFile } from '../types/AudioFile';

type Phase = 'idle' | 'recording' | 'transcribing' | 'confirming';

interface Props {
  periodStart: number;
  periodEnd: number;
  onDone: (transcript: string) => void;
  onCancel: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatHour(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function CheckInScreen({ periodStart, periodEnd, onDone, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [recordingMs, setRecordingMs] = useState(0);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMs, setPlaybackMs] = useState(0);

  useEffect(() => {
    return () => {
      AudioRecorderPlayer.stopRecorder().catch(() => {});
      AudioRecorderPlayer.removeRecordBackListener();
      AudioRecorderPlayer.stopPlayer().catch(() => {});
      AudioRecorderPlayer.removePlayBackListener();
    };
  }, []);

  async function requestMicPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'TimeAnalyzer needs the microphone to record your check-in.',
        buttonPositive: 'Allow',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  async function startRecording() {
    const ok = await requestMicPermission();
    if (!ok) {
      Alert.alert('Permission denied', 'Microphone access is required to record a check-in.');
      return;
    }

    const path = `${RNFS.CachesDirectoryPath}/checkin_${Date.now()}.mp4`;
    setAudioPath(path);
    setRecordingMs(0);
    setPhase('recording');

    await AudioRecorderPlayer.startRecorder(path);
    AudioRecorderPlayer.addRecordBackListener((e: RecordBackType) => {
      setRecordingMs(e.currentPosition);
    });
  }

  async function stopRecording() {
    const result = await AudioRecorderPlayer.stopRecorder();
    AudioRecorderPlayer.removeRecordBackListener();
    const ms = recordingMs;
    setDurationMs(ms);
    setPhase('transcribing');

    const path = result === 'Already stopped' ? audioPath! : result;
    setAudioPath(path);
    const audio: AudioFile = { path, durationMs: ms };

    try {
      const text = await TranscriptionService.transcribe(audio);
      setTranscript(text);
      setPhase('confirming');
    } catch (e) {
      Alert.alert('Transcription failed', 'Could not transcribe the recording. Please try again.');
      RNFS.unlink(path).catch(() => {});
      setPhase('idle');
    }
    // File intentionally kept alive here — deleted on confirm or re-record
  }

  async function togglePlayback() {
    if (!audioPath) return;

    if (isPlaying) {
      await AudioRecorderPlayer.stopPlayer();
      AudioRecorderPlayer.removePlayBackListener();
      setIsPlaying(false);
      setPlaybackMs(0);
    } else {
      setIsPlaying(true);
      setPlaybackMs(0);
      await AudioRecorderPlayer.startPlayer(audioPath);
      AudioRecorderPlayer.addPlayBackListener((e: PlayBackType) => {
        setPlaybackMs(e.currentPosition);
        if (e.currentPosition >= e.duration) {
          AudioRecorderPlayer.stopPlayer().catch(() => {});
          AudioRecorderPlayer.removePlayBackListener();
          setIsPlaying(false);
          setPlaybackMs(0);
        }
      });
    }
  }

  async function handleReRecord() {
    await AudioRecorderPlayer.stopPlayer().catch(() => {});
    AudioRecorderPlayer.removePlayBackListener();
    if (audioPath) RNFS.unlink(audioPath).catch(() => {});
    setTranscript('');
    setRecordingMs(0);
    setDurationMs(0);
    setAudioPath(null);
    setIsPlaying(false);
    setPlaybackMs(0);
    setPhase('idle');
  }

  async function handleConfirm() {
    if (audioPath) RNFS.unlink(audioPath).catch(() => {});
    await StorageService.save({
      id: `${periodStart}-${periodEnd}`,
      timestampStart: periodStart,
      timestampEnd: periodEnd,
      transcript,
    });
    onDone(transcript);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Check-in</Text>
        <View style={styles.cancelPlaceholder} />
      </View>

      <View style={styles.periodBadge}>
        <Text style={styles.periodText}>
          {formatHour(periodStart)} – {formatHour(periodEnd)}
        </Text>
        <Text style={styles.periodSub}>What did you work on?</Text>
      </View>

      <View style={styles.body}>
        {(phase === 'idle' || phase === 'recording') && (
          <>
            <View style={styles.timerBox}>
              <Text style={styles.timer}>{formatDuration(recordingMs)}</Text>
              {phase === 'recording' && <View style={styles.recDot} />}
            </View>

            {phase === 'idle' ? (
              <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
                <Text style={styles.recordBtnText}>Record</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.recordBtn, styles.stopBtn]} onPress={stopRecording}>
                <Text style={styles.recordBtnText}>Stop</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.hint}>
              Briefly describe what you worked on in the last period.
            </Text>
          </>
        )}

        {phase === 'transcribing' && (
          <View style={styles.transcribingBox}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.transcribingText}>Transcribing…</Text>
          </View>
        )}

        {phase === 'confirming' && (
          <>
            {/* Playback bar */}
            <TouchableOpacity style={styles.playbackRow} onPress={togglePlayback}>
              <View style={[styles.playBtn, isPlaying && styles.playBtnActive]}>
                <Text style={styles.playBtnIcon}>{isPlaying ? '■' : '▶'}</Text>
              </View>
              <View style={styles.playbackTrack}>
                <View
                  style={[
                    styles.playbackProgress,
                    { width: durationMs > 0 ? `${(playbackMs / durationMs) * 100}%` : '0%' },
                  ]}
                />
              </View>
              <Text style={styles.playbackTime}>
                {isPlaying ? formatDuration(playbackMs) : formatDuration(durationMs)}
              </Text>
            </TouchableOpacity>

            <Text style={styles.confirmLabel}>Did we get that right?</Text>
            <ScrollView style={styles.transcriptBox} contentContainerStyle={styles.transcriptContent}>
              <Text style={styles.transcriptText}>{transcript}</Text>
            </ScrollView>
            <View style={styles.confirmRow}>
              <TouchableOpacity style={styles.rerecordBtn} onPress={handleReRecord}>
                <Text style={styles.rerecordText}>Re-record</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                <Text style={styles.confirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  title: { fontSize: 17, fontWeight: '600' },
  cancel: { fontSize: 17, color: '#666' },
  cancelPlaceholder: { width: 50 },
  periodBadge: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  periodText: { fontSize: 22, fontWeight: '700', color: '#000' },
  periodSub: { fontSize: 14, color: '#6d6d72', marginTop: 4 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 24,
  },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timer: { fontSize: 48, fontWeight: '200', color: '#000', fontVariant: ['tabular-nums'] },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff3b30' },
  recordBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  stopBtn: { backgroundColor: '#ff3b30', shadowColor: '#ff3b30' },
  recordBtnText: { fontSize: 22, fontWeight: '600', color: '#fff' },
  hint: { fontSize: 14, color: '#6d6d72', textAlign: 'center' },
  transcribingBox: { alignItems: 'center', gap: 16 },
  transcribingText: { fontSize: 16, color: '#6d6d72' },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: { backgroundColor: '#ff3b30' },
  playBtnIcon: { fontSize: 14, color: '#fff' },
  playbackTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  playbackProgress: { height: '100%', backgroundColor: '#007AFF', borderRadius: 2 },
  playbackTime: { fontSize: 13, color: '#6d6d72', width: 40, textAlign: 'right' },
  confirmLabel: { fontSize: 18, fontWeight: '600', color: '#000', alignSelf: 'flex-start' },
  transcriptBox: {
    width: '100%',
    maxHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  transcriptContent: { padding: 16 },
  transcriptText: { fontSize: 16, color: '#000', lineHeight: 24 },
  confirmRow: { flexDirection: 'row', gap: 12, width: '100%' },
  rerecordBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  rerecordText: { fontSize: 16, color: '#333', fontWeight: '500' },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  confirmText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});
