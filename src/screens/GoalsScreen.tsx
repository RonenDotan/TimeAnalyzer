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
import { Goal, GoalStatus } from '../types/Goal';
import { applyTranscription } from '../utils/parseTranscript';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  onClose: () => void;
}

type RecordingTarget = { type: 'new' } | { type: 'edit'; id: number } | null;

/** Parse "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" into epoch ms. Returns null if invalid. */
function parseDateInput(s: string): number | null {
  const trimmed = s.trim();
  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  const withTime = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (withTime) {
    const d = new Date(
      Number(withTime[1]), Number(withTime[2]) - 1, Number(withTime[3]),
      Number(withTime[4]), Number(withTime[5]),
    );
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

function formatTs(ts: number | null): string {
  if (ts === null) return '';
  const d = new Date(ts);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (!hasTime) return date;
  return `${date} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <View style={{ height: 6, backgroundColor: color + '30', borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ height: 6, width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

const GOAL_COLOR = '#E53935';

const STATUS_COLORS: Record<GoalStatus, string> = {
  active:   GOAL_COLOR,
  done:     '#43A047',
  canceled: '#9E9E9E',
};

const STATUS_LABELS: Record<GoalStatus, string> = {
  active:   'Active',
  done:     'Done',
  canceled: 'Canceled',
};

export default function GoalsScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editStartAt, setEditStartAt] = useState('');
  const [editTargetAt, setEditTargetAt] = useState('');
  const [editProgress, setEditProgress] = useState('');
  const [newText, setNewText] = useState('');
  const [newTargetAt, setNewTargetAt] = useState('');
  const [recording, setRecording] = useState<RecordingTarget>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [filter, setFilter] = useState<GoalStatus | 'all'>('active');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const all = await GoalsService.getAllGoals();
      setGoals(all);
    } catch (e: any) {
      Alert.alert('Load failed', String(e?.message ?? e));
    }
  }

  // ─── Filtered list ────────────────────────────────────────────────────────

  const filtered = filter === 'all' ? goals : goals.filter(g => g.status === filter);

  // ─── Create ───────────────────────────────────────────────────────────────

  async function addGoal() {
    const text = newText.trim();
    if (!text) return;
    const now = Date.now();
    const targetAt = newTargetAt.trim() ? parseDateInput(newTargetAt) : null;
    if (newTargetAt.trim() && targetAt === null) {
      Alert.alert('Invalid date', 'Use format YYYY-MM-DD or YYYY-MM-DD HH:MM');
      return;
    }
    try {
      const saved = await GoalsService.saveGoal({
        text, startAt: now, targetAt, progress: 0,
        status: 'active', createdAt: now, updatedAt: now,
      });
      setGoals(prev => [saved, ...prev]);
      setNewText('');
      setNewTargetAt('');
    } catch (e: any) {
      Alert.alert('Failed to add goal', String(e?.message ?? e));
    }
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setEditText(goal.text);
    setEditStartAt(formatTs(goal.startAt));
    setEditTargetAt(formatTs(goal.targetAt));
    setEditProgress(String(goal.progress));
  }

  async function commitEdit(goal: Goal) {
    const text = editText.trim();
    if (!text) { setEditingId(null); return; }
    const startAt = parseDateInput(editStartAt) ?? goal.startAt;
    const targetAt = editTargetAt.trim() ? (parseDateInput(editTargetAt) ?? goal.targetAt) : null;
    const progress = Math.max(0, Math.min(100, parseInt(editProgress, 10) || goal.progress));
    const status: GoalStatus = progress >= 100 ? 'done' : goal.status === 'done' && progress < 100 ? 'active' : goal.status;
    const updated: Goal = { ...goal, text, startAt, targetAt, progress, status, updatedAt: Date.now() };
    try {
      await GoalsService.updateGoal(updated);
      setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
    } catch (e: any) {
      Alert.alert('Failed to save', String(e?.message ?? e));
    } finally {
      setEditingId(null);
    }
  }

  async function setStatus(goal: Goal, status: GoalStatus) {
    const progress = status === 'done' ? 100 : goal.progress;
    const updated: Goal = { ...goal, status, progress, updatedAt: Date.now() };
    try {
      await GoalsService.updateGoal(updated);
      setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
    } catch (e: any) {
      Alert.alert('Failed to update', String(e?.message ?? e));
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function deleteGoal(id: number) {
    Alert.alert('Delete goal', 'This will also delete all contribution history. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await GoalsService.deleteGoal(id);
          setGoals(prev => prev.filter(g => g.id !== id));
        } catch (e: any) {
          Alert.alert('Failed to delete', String(e?.message ?? e));
        }
      }},
    ]);
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
        setNewText(prev => applyTranscription(prev, text.trim()));
      } else if (target?.type === 'edit') {
        setEditText(prev => applyTranscription(prev, text.trim()));
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

  const styles = makeStyles(colors);

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

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['active', 'done', 'canceled', 'all'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}>
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'All' : STATUS_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        {/* Goal rows */}
        {filtered.map(goal => {
          const isEditing = editingId === goal.id;
          const color = STATUS_COLORS[goal.status];
          const recEdit = recording?.type === 'edit' && (recording as any).id === goal.id;
          return (
            <View key={goal.id} style={[styles.goalCard, { borderLeftColor: color }]}>
              {isEditing ? (
                <>
                  <TextInput
                    style={styles.editInput}
                    value={editText}
                    onChangeText={setEditText}
                    multiline
                    textAlignVertical="top"
                    editable={!recEdit}
                    autoFocus
                  />
                  <View style={styles.editFieldRow}>
                    <Text style={styles.editFieldLabel}>Start</Text>
                    <TextInput
                      style={styles.editFieldInput}
                      value={editStartAt}
                      onChangeText={setEditStartAt}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                  <View style={styles.editFieldRow}>
                    <Text style={styles.editFieldLabel}>Target</Text>
                    <TextInput
                      style={styles.editFieldInput}
                      value={editTargetAt}
                      onChangeText={setEditTargetAt}
                      placeholder="YYYY-MM-DD HH:MM (optional)"
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                  <View style={styles.editFieldRow}>
                    <Text style={styles.editFieldLabel}>Progress</Text>
                    <TextInput
                      style={[styles.editFieldInput, { width: 60 }]}
                      value={editProgress}
                      onChangeText={setEditProgress}
                      keyboardType="numeric"
                      maxLength={3}
                      placeholder="0"
                      placeholderTextColor={colors.placeholder}
                    />
                    <Text style={styles.editFieldLabel}>%</Text>
                  </View>
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
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteGoal(goal.id)}>
                      <Text style={styles.deleteText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                  {recEdit && (
                    <Text style={styles.recordingLabel}>
                      Recording… {(recordingMs / 1000).toFixed(1)}s — tap ⏹ to stop
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => startEdit(goal)} style={styles.goalMain}>
                    <Text style={styles.goalText}>{goal.text}</Text>
                    <ProgressBar progress={goal.progress} color={color} />
                    <View style={styles.goalMeta}>
                      <Text style={[styles.goalStatus, { color }]}>{STATUS_LABELS[goal.status]} · {goal.progress}%</Text>
                      {goal.targetAt !== null && (
                        <Text style={styles.goalTarget}>📅 {formatTs(goal.targetAt)}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  {/* Status quick-actions */}
                  {goal.status === 'active' && (
                    <View style={styles.quickActions}>
                      <TouchableOpacity style={styles.quickBtn} onPress={() => setStatus(goal, 'done')}>
                        <Text style={styles.quickBtnText}>✅ Done</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.quickBtn} onPress={() => setStatus(goal, 'canceled')}>
                        <Text style={styles.quickBtnText}>✕ Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {goal.status !== 'active' && (
                    <TouchableOpacity style={styles.quickBtn} onPress={() => setStatus(goal, 'active')}>
                      <Text style={styles.quickBtnText}>↩ Reactivate</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          );
        })}

        {filtered.length === 0 && (
          <Text style={styles.emptyHint}>
            {filter === 'active' ? 'No active goals. Add one below.' : 'No goals in this category.'}
          </Text>
        )}

        {/* Add new goal */}
        <View style={styles.addCard}>
          <Text style={styles.addCardLabel}>NEW GOAL</Text>
          <TextInput
            style={styles.addInput}
            value={newText}
            onChangeText={setNewText}
            placeholder="What do you want to achieve?"
            placeholderTextColor={colors.placeholder}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.addFieldRow}>
            <Text style={styles.editFieldLabel}>Target date</Text>
            <TextInput
              style={styles.editFieldInput}
              value={newTargetAt}
              onChangeText={setNewTargetAt}
              placeholder={`${todayString()} (optional)`}
              placeholderTextColor={colors.placeholder}
            />
          </View>
          <View style={styles.addActions}>
            <DictateBar onResult={raw => setNewText(prev => applyTranscription(prev, raw))} />
            {newText.trim().length > 0 && (
              <TouchableOpacity style={styles.addBtn} onPress={addGoal}>
                <Text style={styles.addBtnText}>Add goal</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

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
    filterRow: {
      flexDirection: 'row', backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    filterTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
    filterTabActive: { borderBottomWidth: 2, borderBottomColor: GOAL_COLOR },
    filterTabText: { fontSize: 13, color: colors.textSecondary },
    filterTabTextActive: { color: GOAL_COLOR, fontWeight: '600' },
    body:           { padding: 16, gap: 10, paddingBottom: 40 },
    goalCard: {
      backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 8,
      borderLeftWidth: 4,
    },
    goalMain:       { gap: 6 },
    goalText:       { fontSize: 15, color: colors.text, lineHeight: 22 },
    goalMeta:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    goalStatus:     { fontSize: 12, fontWeight: '600' },
    goalTarget:     { fontSize: 12, color: colors.textSecondary },
    quickActions:   { flexDirection: 'row', gap: 8 },
    quickBtn: {
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 6, borderWidth: 1, borderColor: colors.border,
    },
    quickBtnText:   { fontSize: 12, color: colors.textSecondary },
    editInput: {
      fontSize: 15, color: colors.text, lineHeight: 22,
      backgroundColor: colors.surfaceSecondary, borderRadius: 8,
      padding: 8, minHeight: 60,
    },
    editFieldRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    editFieldLabel: { fontSize: 13, color: colors.textSecondary, width: 60 },
    editFieldInput: {
      flex: 1, fontSize: 14, color: colors.text,
      borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 3,
    },
    editActions:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    micBtn:         { padding: 6, borderRadius: 8 },
    micBtnActive:   { backgroundColor: colors.recordBtn + '22' },
    micIcon:        { fontSize: 20 },
    saveEditBtn: {
      paddingHorizontal: 14, paddingVertical: 6, backgroundColor: GOAL_COLOR, borderRadius: 8,
    },
    saveEditText:   { fontSize: 14, color: '#fff', fontWeight: '600' },
    cancelEditBtn:  { paddingHorizontal: 8, paddingVertical: 6 },
    cancelEditText: { fontSize: 14, color: colors.textSecondary },
    deleteBtn:      { paddingHorizontal: 8, paddingVertical: 6, marginLeft: 'auto' },
    deleteText:     { fontSize: 14, color: '#FF5252' },
    recordingLabel: { fontSize: 12, color: colors.recordBtn, fontStyle: 'italic' },
    emptyHint:      { textAlign: 'center', color: colors.placeholder, fontSize: 14, marginTop: 24 },
    addCard: {
      backgroundColor: GOAL_COLOR + '0c', borderRadius: 12, padding: 14, gap: 10,
      borderStyle: 'dashed', borderWidth: 1, borderColor: GOAL_COLOR + '60',
    },
    addCardLabel: {
      fontSize: 11, fontWeight: '700', color: GOAL_COLOR, letterSpacing: 0.5,
    },
    addInput: { fontSize: 15, color: colors.text, minHeight: 60, lineHeight: 22 },
    addFieldRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
    addActions:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
    addBtn: {
      paddingHorizontal: 14, paddingVertical: 6, backgroundColor: GOAL_COLOR, borderRadius: 8,
    },
    addBtnText:     { fontSize: 14, color: '#fff', fontWeight: '600' },
  });
}
