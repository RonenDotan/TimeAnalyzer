import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DictateBar from '../components/DictateBar';
import TranscriptionService from '../services/TranscriptionService';
import GoalsService from '../services/GoalsService';
import { Goal } from '../types/Goal';
import { applyTranscription } from '../utils/parseTranscript';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  initialDate?: Date;
  onClose: () => void;
}

type RecordingTarget = { type: 'new' } | { type: 'edit'; id: number } | null;

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatHeader(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  const today = new Date();
  const todayStr = toDateString(today);
  const tomorrowStr = toDateString(new Date(today.getTime() + 86_400_000));
  const yesterdayStr = toDateString(new Date(today.getTime() - 86_400_000));
  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  if (dateStr === yesterdayStr) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function GoalsScreen({ initialDate, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate ?? new Date());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoalText, setNewGoalText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [recording, setRecording] = useState<RecordingTarget>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);

  const dateStr = toDateString(currentDate);

  useEffect(() => {
    load();
  }, [dateStr]);

  async function load() {
    setGoals([]);
    setEditingId(null);
    setNewGoalText('');
    try {
      const loaded = await GoalsService.getGoals(dateStr);
      setGoals(loaded);
    } catch (e: any) {
      Alert.alert('Load failed', String(e?.message ?? e));
    }
  }

  function goToPrevDay() {
    setCurrentDate(d => new Date(d.getTime() - 86_400_000));
  }

  function goToNextDay() {
    setCurrentDate(d => new Date(d.getTime() + 86_400_000));
  }

  // ─── Add ──────────────────────────────────────────────────────────────────

  async function addGoal() {
    const text = newGoalText.trim();
    if (!text) return;
    try {
      const now = Date.now();
      const saved = await GoalsService.saveGoal({
        date: dateStr, text, done: false,
        sortOrder: goals.length, createdAt: now, updatedAt: now,
      });
      setGoals(prev => [...prev, saved]);
      setNewGoalText('');
    } catch (e: any) {
      Alert.alert('Failed to add goal', String(e?.message ?? e));
    }
  }

  // ─── Toggle ───────────────────────────────────────────────────────────────

  async function toggleGoal(goal: Goal) {
    try {
      const updated = await GoalsService.toggleGoal(goal);
      setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
    } catch (e: any) {
      Alert.alert('Failed to update goal', String(e?.message ?? e));
    }
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setEditingText(goal.text);
  }

  async function commitEdit(goal: Goal) {
    const text = editingText.trim();
    if (!text) { setEditingId(null); return; }
    try {
      const updated = { ...goal, text, updatedAt: Date.now() };
      await GoalsService.updateGoal(updated);
      setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
    } catch (e: any) {
      Alert.alert('Failed to save goal', String(e?.message ?? e));
    } finally {
      setEditingId(null);
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function deleteGoal(id: number) {
    try {
      await GoalsService.deleteGoal(id);
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (e: any) {
      Alert.alert('Failed to delete goal', String(e?.message ?? e));
    }
  }

  // ─── Dictation ────────────────────────────────────────────────────────────

  async function startRecording(target: RecordingTarget) {
    try {
      await TranscriptionService.start(() => {});
      const start = Date.now();
      timerRef.current = setInterval(() => setRecordingMs(Date.now() - start), 100);
      setRecording(target);
      setRecordingMs(0);
    } catch (e: any) {
      Alert.alert('Recording failed', String(e?.message ?? e));
    }
  }

  async function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const target = recording;
    setRecording(null);
    try {
      const text = await TranscriptionService.stop();
      if (!text?.trim()) return;
      if (target?.type === 'new') {
        setNewGoalText(prev => applyTranscription(prev, text.trim()));
      } else if (target?.type === 'edit') {
        setEditingText(prev => applyTranscription(prev, text.trim()));
      }
    } catch (e: any) {
      Alert.alert('Transcription failed', String(e?.message ?? e));
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      TranscriptionService.stop().catch(() => {});
    };
  }, []);

  const isRecordingNew  = recording?.type === 'new';
  const isRecordingEdit = (id: number) => recording?.type === 'edit' && recording.id === id;

  const styles = makeStyles(colors);
  const doneCount = goals.filter(g => g.done).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Goals</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Day navigation */}
      <View style={styles.dayNav}>
        <TouchableOpacity onPress={goToPrevDay} style={styles.navBtn}>
          <Text style={styles.navArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.dayLabel}>{formatHeader(dateStr)}</Text>
        <TouchableOpacity onPress={goToNextDay} style={styles.navBtn}>
          <Text style={styles.navArrow}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        {/* Summary pill */}
        {goals.length > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {doneCount}/{goals.length} completed
            </Text>
            {doneCount === goals.length && goals.length > 0 && (
              <Text style={styles.summaryAll}>  🎉 All done!</Text>
            )}
          </View>
        )}

        {/* Goal rows */}
        {goals.map(goal => {
          const editing = editingId === goal.id;
          const recEdit = isRecordingEdit(goal.id);
          return (
            <View key={goal.id} style={styles.goalCard}>
              <TouchableOpacity onPress={() => toggleGoal(goal)} style={styles.checkbox}>
                <Text style={styles.checkboxIcon}>{goal.done ? '✅' : '⬜'}</Text>
              </TouchableOpacity>

              <View style={styles.goalBody}>
                {editing ? (
                  <>
                    <TextInput
                      style={styles.editInput}
                      value={editingText}
                      onChangeText={setEditingText}
                      autoFocus
                      multiline
                      textAlignVertical="top"
                      editable={!recEdit}
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity
                        style={[styles.micBtn, recEdit && styles.micBtnActive]}
                        onPress={() => recEdit ? stopRecording() : startRecording({ type: 'edit', id: goal.id })}>
                        <Text style={styles.micIcon}>{recEdit ? '⏹' : '🎙'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.saveEditBtn} onPress={() => commitEdit(goal)}>
                        <Text style={styles.saveEditText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setEditingId(null)}>
                        <Text style={styles.cancelEditText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                    {recEdit && (
                      <Text style={styles.recordingLabel}>
                        Recording… {(recordingMs / 1000).toFixed(1)}s — tap ⏹ to stop
                      </Text>
                    )}
                  </>
                ) : (
                  <TouchableOpacity onPress={() => startEdit(goal)} style={styles.goalTextBtn}>
                    <Text style={[styles.goalText, goal.done && styles.goalTextDone]}>
                      {goal.text}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {!editing && (
                <TouchableOpacity onPress={() => deleteGoal(goal.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Add new goal */}
        <View style={styles.addCard}>
          <TextInput
            style={styles.addInput}
            value={newGoalText}
            onChangeText={setNewGoalText}
            placeholder="Add a goal…"
            placeholderTextColor={colors.placeholder}
            onSubmitEditing={addGoal}
            returnKeyType="done"
            editable={!isRecordingNew}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.addActions}>
            <DictateBar onResult={raw => setNewGoalText(prev => applyTranscription(prev, raw))} />
            {newGoalText.trim().length > 0 && (
              <TouchableOpacity style={styles.addBtn} onPress={addGoal}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
          {isRecordingNew && (
            <Text style={styles.recordingLabel}>
              Recording… {(recordingMs / 1000).toFixed(1)}s — tap ⏹ to stop
            </Text>
          )}
        </View>

        {goals.length === 0 && (
          <Text style={styles.emptyHint}>No goals yet. Add one above or dictate with 🎙</Text>
        )}

      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    title:          { fontSize: 17, fontWeight: '600', color: colors.text },
    cancel:         { fontSize: 17, color: colors.textSecondary },
    headerSpacer:   { width: 50 },
    dayNav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 8, paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    navBtn:         { padding: 8 },
    navArrow:       { fontSize: 28, color: colors.accent, fontWeight: '300' },
    dayLabel:       { fontSize: 16, fontWeight: '600', color: colors.text },
    body:           { padding: 16, gap: 10, paddingBottom: 40 },
    summaryRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    summaryText:    { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
    summaryAll:     { fontSize: 13, color: colors.accent, fontWeight: '600' },
    goalCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    },
    checkbox:       { paddingTop: 2 },
    checkboxIcon:   { fontSize: 20 },
    goalBody:       { flex: 1, gap: 6 },
    goalTextBtn:    { flex: 1 },
    goalText:       { fontSize: 15, color: colors.text, lineHeight: 22 },
    goalTextDone:   { textDecorationLine: 'line-through', color: colors.textSecondary },
    deleteBtn:      { paddingHorizontal: 4, paddingTop: 2 },
    deleteIcon:     { fontSize: 14, color: colors.placeholder },
    editInput: {
      fontSize: 15, color: colors.text, lineHeight: 22,
      backgroundColor: colors.surfaceSecondary, borderRadius: 8,
      padding: 8, minHeight: 60,
    },
    editActions:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    micBtn:         { padding: 6, borderRadius: 8 },
    micBtnActive:   { backgroundColor: colors.recordBtn + '22' },
    micIcon:        { fontSize: 20 },
    saveEditBtn: {
      paddingHorizontal: 14, paddingVertical: 6,
      backgroundColor: colors.accent, borderRadius: 8,
    },
    saveEditText:   { fontSize: 14, color: '#fff', fontWeight: '600' },
    cancelEditBtn:  { paddingHorizontal: 8, paddingVertical: 6 },
    cancelEditText: { fontSize: 14, color: colors.textSecondary },
    recordingLabel: { fontSize: 12, color: colors.recordBtn, fontStyle: 'italic', marginTop: 4 },
    addCard: {
      backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 8,
    },
    addInput:       { fontSize: 15, color: colors.text, minHeight: 44, lineHeight: 22 },
    addActions:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
    addBtn: {
      paddingHorizontal: 14, paddingVertical: 6,
      backgroundColor: colors.accent, borderRadius: 8,
    },
    addBtnText:     { fontSize: 14, color: '#fff', fontWeight: '600' },
    emptyHint:      { textAlign: 'center', color: colors.placeholder, fontSize: 14, marginTop: 24 },
  });
}
