import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StorageService from '../services/StorageService';
import TranscriptionService from '../services/TranscriptionService';

type Phase = 'idle' | 'recording' | 'confirming';

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
  const [partialTranscript, setPartialTranscript] = useState('');
  const [transcript, setTranscript] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      TranscriptionService.stop().catch(() => {});
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

    setRecordingMs(0);
    setPartialTranscript('');
    setPhase('recording');

    const start = Date.now();
    timerRef.current = setInterval(() => setRecordingMs(Date.now() - start), 100);

    try {
      await TranscriptionService.start((partial) => setPartialTranscript(partial));
    } catch (e: any) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      Alert.alert('Speech start failed', String(e?.message ?? e));
      setPhase('idle');
    }
  }

  async function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const finalText = await TranscriptionService.stop();
      setTranscript(finalText || partialTranscript);
      setPhase('confirming');
    } catch {
      Alert.alert('Transcription failed', 'Could not transcribe. Please try again.');
      setPhase('idle');
    }
  }

  function handleReRecord() {
    setTranscript('');
    setPartialTranscript('');
    setRecordingMs(0);
    setPhase('idle');
  }

  async function handleConfirm() {
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
        {phase === 'idle' && (
          <>
            <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
              <Text style={styles.recordBtnText}>Record</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>
              Briefly describe what you worked on in the last period.
            </Text>
          </>
        )}

        {phase === 'recording' && (
          <>
            <View style={styles.timerBox}>
              <Text style={styles.timer}>{formatDuration(recordingMs)}</Text>
              <View style={styles.recDot} />
            </View>

            {partialTranscript.length > 0 && (
              <ScrollView style={styles.liveBox} contentContainerStyle={styles.liveContent}>
                <Text style={styles.liveText}>{partialTranscript}</Text>
              </ScrollView>
            )}

            <TouchableOpacity style={[styles.recordBtn, styles.stopBtn]} onPress={stopRecording}>
              <Text style={styles.recordBtnText}>Stop</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'confirming' && (
          <>
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
  liveBox: {
    width: '100%',
    maxHeight: 120,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  liveContent: { padding: 16 },
  liveText: { fontSize: 15, color: '#333', lineHeight: 22, fontStyle: 'italic' },
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
