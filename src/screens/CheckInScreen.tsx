import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SchedulerService from '../services/SchedulerService';
import SettingsService from '../services/SettingsService';
import StorageService from '../services/StorageService';
import TranscriptionService from '../services/TranscriptionService';
import { parseTranscriptAndNotes } from '../utils/parseTranscript';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

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
  const { colors } = useTheme();
  const [phase, setPhase] = useState<Phase>('idle');
  const [recordingMs, setRecordingMs] = useState(0);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [noteKeyword, setNoteKeyword] = useState('note');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    SettingsService.load().then(s => setNoteKeyword(s.noteKeyword));
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
    setPhase('transcribing');

    try {
      const finalText = await TranscriptionService.stop();
      const { transcript: parsed, notes: detectedNotes } = parseTranscriptAndNotes(finalText || partialTranscript, noteKeyword);
      setTranscript(parsed);
      if (detectedNotes.length > 0) setNotes(detectedNotes);
      setPhase('confirming');
    } catch (e: any) {
      Alert.alert('Transcription failed', String(e?.message ?? e));
      setPhase('idle');
    }
  }

  function handleReRecord() {
    setTranscript('');
    setPartialTranscript('');
    setRecordingMs(0);
    setNotes([]);
    setPhase('idle');
  }

  function addNote() {
    setNotes(prev => [...prev, '']);
  }

  function updateNote(index: number, text: string) {
    setNotes(prev => prev.map((n, i) => i === index ? text : n));
  }

  function removeNote(index: number) {
    setNotes(prev => prev.filter((_, i) => i !== index));
  }

  async function handleConfirm() {
    const entry = await StorageService.save({
      timestampStart: periodStart,
      timestampEnd: periodEnd,
      transcript,
    });
    const now = Date.now();
    await Promise.all(
      notes
        .filter(n => n.trim().length > 0)
        .map(text => StorageService.saveNote({ entryId: entry.id, text: text.trim(), createdAt: now })),
    );
    const moreToday = await SchedulerService.hasMoreCheckInsToday();
    if (!moreToday) {
      await SchedulerService.fireEndOfDayReport();
    }
    onDone(transcript);
  }

  const canSubmitTyped = transcript.trim().length > 0;

  function handleTypedSubmit() {
    const { transcript: parsed, notes: detectedNotes } = parseTranscriptAndNotes(transcript, noteKeyword);
    setTranscript(parsed);
    if (detectedNotes.length > 0) setNotes(prev => [...prev, ...detectedNotes]);
    setPhase('confirming');
  }

  const styles = makeStyles(colors);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
            <TextInput
              style={styles.typeInput}
              value={transcript}
              onChangeText={setTranscript}
              placeholder="Type what you worked on..."
              placeholderTextColor={colors.placeholder}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmitTyped && styles.submitBtnDisabled]}
              onPress={handleTypedSubmit}
              disabled={!canSubmitTyped}>
              <Text style={styles.submitBtnText}>Submit</Text>
            </TouchableOpacity>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or speak</Text>
              <View style={styles.orLine} />
            </View>
            <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
              <Text style={styles.recordBtnText}>Record</Text>
            </TouchableOpacity>
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

        {phase === 'transcribing' && (
          <>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.transcribingLabel}>Transcribing…</Text>
          </>
        )}

        {phase === 'confirming' && (
          <>
            <Text style={styles.confirmLabel}>Review your check-in</Text>
            <TextInput
              style={styles.typeInput}
              value={transcript}
              onChangeText={setTranscript}
              multiline
              textAlignVertical="top"
              autoFocus
            />

            {notes.map((note, i) => (
              <View key={i} style={styles.noteRow}>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={t => updateNote(i, t)}
                  placeholder="Add a note…"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity onPress={() => removeNote(i)} style={styles.noteRemove}>
                  <Text style={styles.noteRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addNoteBtn} onPress={addNote}>
              <Text style={styles.addNoteBtnText}>+ Add note</Text>
            </TouchableOpacity>

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
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 17, fontWeight: '600', color: colors.text },
    cancel: { fontSize: 17, color: colors.textSecondary },
    cancelPlaceholder: { width: 50 },
    periodBadge: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    periodText: { fontSize: 22, fontWeight: '700', color: colors.text },
    periodSub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingHorizontal: 24,
      paddingTop: 24,
      gap: 20,
    },
    typeInput: {
      width: '100%',
      minHeight: 140,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: colors.text,
      lineHeight: 24,
      borderWidth: 1.5,
      borderColor: colors.accent,
    },
    submitBtn: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: colors.accent,
      alignItems: 'center',
    },
    submitBtnDisabled: { backgroundColor: colors.placeholder },
    submitBtnText: { fontSize: 16, color: '#fff', fontWeight: '600' },
    orRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      gap: 10,
    },
    orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    orText: { fontSize: 13, color: colors.textSecondary },
    timerBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 40 },
    timer: { fontSize: 48, fontWeight: '200', color: colors.text, fontVariant: ['tabular-nums'] },
    recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.recordBtn },
    recordBtn: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.recordBtn,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.recordBtn,
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    stopBtn: { backgroundColor: colors.recordBtn, shadowColor: colors.recordBtn },
    recordBtnText: { fontSize: 22, fontWeight: '600', color: '#fff' },
    transcribingLabel: { fontSize: 16, color: colors.textSecondary, marginTop: 16 },
    liveBox: {
      width: '100%',
      maxHeight: 120,
      backgroundColor: colors.surface,
      borderRadius: 10,
    },
    liveContent: { padding: 16 },
    liveText: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, fontStyle: 'italic' },
    confirmLabel: { fontSize: 18, fontWeight: '600', color: colors.text, alignSelf: 'flex-start' },
    noteRow: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', gap: 8 },
    noteInput: {
      flex: 1,
      minHeight: 60,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
      borderWidth: 1,
      borderColor: colors.border,
      textAlignVertical: 'top',
    },
    noteRemove: { paddingTop: 14, paddingHorizontal: 4 },
    noteRemoveText: { fontSize: 16, color: colors.placeholder },
    addNoteBtn: { alignSelf: 'flex-start' },
    addNoteBtnText: { fontSize: 15, color: colors.accent, fontWeight: '500' },
    confirmRow: { flexDirection: 'row', gap: 12, width: '100%' },
    rerecordBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: colors.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    rerecordText: { fontSize: 16, color: colors.text, fontWeight: '500' },
    confirmBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: colors.accent,
      alignItems: 'center',
    },
    confirmText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  });
}
