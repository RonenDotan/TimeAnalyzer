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
import CalendarSyncService from '../services/CalendarSyncService';
import GoalsService from '../services/GoalsService';
import TranscriptionService from '../services/TranscriptionService';
import AnalysisService from '../services/AnalysisService';
import { parseTranscriptAndNotes } from '../utils/parseTranscript';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';
import GoalCard from '../components/GoalCard';
import PlanHintBar from '../components/PlanHintBar';
import ScreenHeader from '../components/ScreenHeader';
import { Goal, isGoalOverdue } from '../types/Goal';

const GOAL_COLOR = '#F97316';
const OVERDUE_COLOR = '#DC2626';

type Phase = 'idle' | 'recording' | 'transcribing' | 'confirming' | 'summary';

interface GoalMove {
  goalText: string;
  before: number;
  after: number;
  delta: number;
  status: 'active' | 'done' | 'canceled';
}

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
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [contributions, setContributions] = useState<Record<number, string>>({}); // goalId → input string
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiProviderLabel, setAiProviderLabel] = useState('AI');
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestionReasons, setAiSuggestionReasons] = useState<Record<number, string>>({});
  const [aiSuggestionMessage, setAiSuggestionMessage] = useState('');
  const [goalMoves, setGoalMoves] = useState<GoalMove[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    SettingsService.load().then(s => setNoteKeyword(s.noteKeyword));
    AnalysisService.getProviderLabel().then(setAiProviderLabel).catch(() => setAiProviderLabel('AI'));
    AnalysisService.isConfigured().then(setAiAvailable).catch(() => setAiAvailable(false));
    // Pre-load goals so they're visible even before recording starts
    GoalsService.getActiveGoals(periodEnd).then(setActiveGoals);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      TranscriptionService.stop().catch(() => {});
    };
  }, [periodEnd]);

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
      const goals = await GoalsService.getActiveGoals(periodEnd);
      setActiveGoals(goals);
      setContributions({});
      setAiSuggestionReasons({});
      setAiSuggestionMessage('');
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
    setAiSuggestionReasons({});
    setAiSuggestionMessage('');
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
      calendarEventId: null,
      source: 'app',
    });
    const now = Date.now();
    await Promise.all(
      notes
        .filter(n => n.trim().length > 0)
        .map(text => StorageService.saveNote({ entryId: entry.id, text: text.trim(), createdAt: now })),
    );
    // Apply goal contributions and collect move summary
    const moves: GoalMove[] = [];
    for (const goal of activeGoals) {
      const pctStr = contributions[goal.id];
      if (!pctStr) continue;
      const pct = parseInt(pctStr, 10);
      if (!isNaN(pct) && pct > 0) {
        const before = goal.progress;
        const updated = await GoalsService.applyContribution(goal, pct, entry.id, aiSuggestionReasons[goal.id] ?? null);
        moves.push({
          goalText: goal.text,
          before,
          after: updated.progress,
          delta: updated.progress - before,
          status: updated.status,
        });
      }
    }
    setGoalMoves(moves);
    const moreToday = await SchedulerService.hasMoreCheckInsToday();
    if (!moreToday) {
      await SchedulerService.fireEndOfDayReport();
    }
    CalendarSyncService.syncChanged().catch(() => {});
    setPhase('summary');
  }

  const canSubmitTyped = transcript.trim().length > 0;

  async function handleTypedSubmit() {
    const { transcript: parsed, notes: detectedNotes } = parseTranscriptAndNotes(transcript, noteKeyword);
    setTranscript(parsed);
    if (detectedNotes.length > 0) setNotes(prev => [...prev, ...detectedNotes]);
    const goals = await GoalsService.getActiveGoals(periodEnd);
    setActiveGoals(goals);
    setContributions({});
    setAiSuggestionReasons({});
    setAiSuggestionMessage('');
    setPhase('confirming');
  }

  async function handleSuggestWithAI() {
    if (aiSuggesting || activeGoals.length === 0 || transcript.trim().length === 0) return;

    setAiSuggesting(true);
    setAiSuggestionReasons({});
    setAiSuggestionMessage('');

    try {
      const result = await AnalysisService.suggestGoalContributions(transcript, activeGoals);
      if (result.suggestions.length === 0) {
        setAiSuggestionMessage('No clear goal progress found in this check-in.');
        return;
      }

      const nextContributions: Record<number, string> = {};
      const nextReasons: Record<number, string> = {};
      for (const suggestion of result.suggestions) {
        nextContributions[suggestion.goalId] = String(suggestion.contributionPct);
        nextReasons[suggestion.goalId] = suggestion.reason;
      }

      setContributions(prev => ({ ...prev, ...nextContributions }));
      setAiSuggestionReasons(nextReasons);
      setAiSuggestionMessage(
        `${aiProviderLabel} suggested ${result.suggestions.length} contribution${result.suggestions.length === 1 ? '' : 's'}.`,
      );
    } catch (e: any) {
      setAiSuggestionMessage(String(e?.message ?? e));
    } finally {
      setAiSuggesting(false);
    }
  }

  const styles = makeStyles(colors);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader title="Check-in" onLeft={onCancel} leftLabel="Cancel" />

      <View style={styles.periodBadge}>
        <Text style={styles.periodText}>
          {formatHour(periodStart)} – {formatHour(periodEnd)}
        </Text>
        <Text style={styles.periodSub}>What did you work on?</Text>
      </View>
      <View style={styles.hintRow}>
        <PlanHintBar periodStart={periodStart} periodEnd={periodEnd} />
      </View>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled">
        {phase === 'idle' && (
          <>
            {/* Active goals reminder — shown before recording so user knows what to think about */}
            {activeGoals.length > 0 && (
              <View style={styles.idleGoalsSection}>
                <Text style={styles.idleGoalsLabel}>🎯  Goals in scope</Text>
                {activeGoals.map(goal => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </View>
            )}
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

            {/* Active goals — contribution input per goal */}
            {activeGoals.length > 0 && (
              <View style={styles.goalsSection}>
                <Text style={styles.goalsSectionLabel}>🎯  HOW MUCH DID YOU ADVANCE EACH GOAL?</Text>
                {aiAvailable && (
                  <View style={styles.aiSuggestBox}>
                    <TouchableOpacity
                      style={[styles.aiSuggestBtn, aiSuggesting && styles.aiSuggestBtnDisabled]}
                      onPress={handleSuggestWithAI}
                      disabled={aiSuggesting}>
                      {aiSuggesting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.aiSuggestBtnText}>✨ Suggest with AI</Text>
                      )}
                    </TouchableOpacity>
                    {!!aiSuggestionMessage && (
                      <Text style={styles.aiSuggestMessage}>{aiSuggestionMessage}</Text>
                    )}
                  </View>
                )}
                {activeGoals.map(goal => {
                  const overdue = isGoalOverdue(goal);
                  const goalColor = overdue ? OVERDUE_COLOR : GOAL_COLOR;
                  return (
                  <View key={goal.id} style={[styles.goalContribCard, overdue && styles.goalContribCardOverdue]}>
                    {/* Goal name — prominent, full width */}
                    <Text style={styles.goalContribName}>{goal.text}</Text>
                    {overdue && <Text style={styles.overdueLabel}>Overdue</Text>}
                    {/* Progress bar + current % */}
                    <View style={styles.goalContribBarRow}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${goal.progress}%` as any, backgroundColor: goalColor }]} />
                      </View>
                      <Text style={styles.goalProgressLabel}>{goal.progress}% done</Text>
                    </View>
                    {/* Advance-by input — clearly labeled */}
                    <View style={styles.goalContribInputRow}>
                      <Text style={styles.goalContribInputLabel}>Advance by</Text>
                      <TextInput
                        style={styles.pctInput}
                        value={contributions[goal.id] ?? ''}
                        onChangeText={v => setContributions(prev => ({ ...prev, [goal.id]: v }))}
                        placeholder="0"
                        placeholderTextColor={colors.placeholder}
                        keyboardType="numeric"
                        maxLength={3}
                      />
                      <Text style={styles.pctLabel}>%</Text>
                    </View>
                    {!!aiSuggestionReasons[goal.id] && (
                      <Text style={[styles.aiReasonText, overdue && styles.aiReasonTextOverdue]}>{aiSuggestionReasons[goal.id]}</Text>
                    )}
                  </View>
                  );
                })}
              </View>
            )}

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

        {phase === 'summary' && (
          <>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryCheck}>✓</Text>
              <Text style={styles.summaryTitle}>Check-in saved</Text>
            </View>

            {goalMoves.length > 0 ? (
              <View style={styles.summaryGoals}>
                <Text style={styles.summaryGoalsLabel}>GOAL PROGRESS THIS SESSION</Text>
                {goalMoves.map((move, i) => (
                  <View key={i} style={styles.summaryGoalCard}>
                    <View style={styles.summaryGoalTop}>
                      <Text style={styles.summaryGoalText} numberOfLines={2}>{move.goalText}</Text>
                      <Text style={[
                        styles.summaryDelta,
                        move.status === 'done' && styles.summaryDeltaDone,
                      ]}>
                        +{move.delta}%
                      </Text>
                    </View>
                    <View style={styles.summaryBarBg}>
                      <View style={[styles.summaryBarFill, { width: `${move.after}%` as any }]} />
                    </View>
                    <Text style={styles.summaryBarLabel}>
                      {move.before}% → {move.after}%
                      {move.status === 'done' ? '  🎉 Complete!' : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.summaryNoMoves}>No goal contributions this session.</Text>
            )}

            <TouchableOpacity style={styles.doneBtn} onPress={() => onDone(transcript)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    bodyScroll: { flex: 1 },
    periodBadge: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    periodText: { fontSize: 22, fontWeight: '700', color: colors.text },
    periodSub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    hintRow: { paddingHorizontal: 24, width: '100%' },
    body: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 32,
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
    // Idle phase — goals reminder
    idleGoalsSection: {
      width: '100%',
      backgroundColor: GOAL_COLOR + '12',
      borderRadius: 12,
      padding: 12,
      gap: 8,
      borderLeftWidth: 3,
      borderLeftColor: GOAL_COLOR,
    },
    idleGoalsLabel: { fontSize: 11, fontWeight: '700', color: GOAL_COLOR, letterSpacing: 0.5 },
    overdueLabel: { fontSize: 11, color: OVERDUE_COLOR, fontWeight: '700' },
    // Confirming phase — contribution cards
    goalsSection: { width: '100%', gap: 10 },
    goalsSectionLabel: {
      fontSize: 11, fontWeight: '700', color: GOAL_COLOR, letterSpacing: 0.5,
    },
    aiSuggestBox: { gap: 6 },
    aiSuggestBtn: {
      alignSelf: 'flex-start',
      minHeight: 36,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: GOAL_COLOR,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiSuggestBtnDisabled: { opacity: 0.65 },
    aiSuggestBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    aiSuggestMessage: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
    goalContribCard: {
      backgroundColor: GOAL_COLOR + '0e',
      borderRadius: 12,
      padding: 14,
      gap: 8,
      borderLeftWidth: 3,
      borderLeftColor: GOAL_COLOR,
    },
    goalContribCardOverdue: {
      backgroundColor: OVERDUE_COLOR + '16',
      borderLeftColor: OVERDUE_COLOR,
    },
    goalContribName: {
      fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 22,
    },
    goalContribBarRow: { gap: 4 },
    progressBarBg: {
      height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden',
    },
    progressBarFill: {
      height: 5, backgroundColor: GOAL_COLOR, borderRadius: 3,
    },
    goalProgressLabel: { fontSize: 11, color: colors.textSecondary },
    goalContribInputRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
    },
    goalContribInputLabel: { fontSize: 14, color: colors.textSecondary, flex: 1 },
    pctInput: {
      width: 56, textAlign: 'center', fontSize: 18, fontWeight: '700',
      color: colors.text, borderBottomWidth: 2, borderBottomColor: GOAL_COLOR,
      paddingVertical: 2,
    },
    pctLabel: { fontSize: 16, color: colors.textSecondary },
    aiReasonText: { fontSize: 12, color: GOAL_COLOR, lineHeight: 17 },
    aiReasonTextOverdue: { color: OVERDUE_COLOR },
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
    // Summary phase
    summaryHeader: { alignItems: 'center', gap: 8, marginTop: 20 },
    summaryCheck: { fontSize: 56, color: colors.accent },
    summaryTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
    summaryGoals: { width: '100%', gap: 8 },
    summaryGoalsLabel: {
      fontSize: 11, fontWeight: '600', color: GOAL_COLOR, letterSpacing: 0.5,
    },
    summaryGoalCard: {
      backgroundColor: GOAL_COLOR + '0e', borderRadius: 12, padding: 14, gap: 6,
      borderLeftWidth: 3, borderLeftColor: GOAL_COLOR,
    },
    summaryGoalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    summaryGoalText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
    summaryDelta: { fontSize: 16, fontWeight: '700', color: GOAL_COLOR },
    summaryDeltaDone: { color: '#4CAF50' },
    summaryBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
    summaryBarFill: { height: 6, backgroundColor: GOAL_COLOR, borderRadius: 3 },
    summaryBarLabel: { fontSize: 12, color: colors.textSecondary },
    summaryNoMoves: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginVertical: 16 },
    doneBtn: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: colors.accent,
      alignItems: 'center',
      marginTop: 8,
    },
    doneBtnText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  });
}
