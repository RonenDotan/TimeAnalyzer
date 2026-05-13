import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DictateBar from '../components/DictateBar';
import TranscriptionService from '../services/TranscriptionService';
import GoalsService from '../services/GoalsService';
import { Goal, GoalStatus, isGoalOverdue } from '../types/Goal';
import { applyTranscription } from '../utils/parseTranscript';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  onClose: () => void;
  initialGoalId?: number;
}

type RecordingTarget = { type: 'new' } | { type: 'edit'; id: number } | null;
type DateFieldKey = 'newStart' | 'newTarget' | 'editStart' | 'editTarget';
type ActiveDatePicker = { field: DateFieldKey; mode: 'date' | 'time' } | null;

function currentHourTs(): number {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

function setTodayKeepingTime(ts: number): number {
  const current = new Date();
  const d = new Date(ts);
  d.setFullYear(current.getFullYear(), current.getMonth(), current.getDate());
  return d.getTime();
}

function replaceDatePart(ts: number, picked: Date): number {
  const d = new Date(ts);
  d.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return d.getTime();
}

function replaceTimePart(ts: number, picked: Date): number {
  const d = new Date(ts);
  d.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return d.getTime();
}

function formatGoalDateTime(ts: number | null): string {
  if (ts === null) return 'not set';
  const d = new Date(ts);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
}

function formatDateLabel(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTimeLabel(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <View style={{ height: 6, backgroundColor: color + '30', borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ height: 6, width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

function DateTimeField({
  label,
  value,
  onPressDate,
  onPressTime,
  onToday,
  styles,
}: {
  label: string;
  value: number;
  onPressDate: () => void;
  onPressTime: () => void;
  onToday: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.dateField}>
      <View style={styles.dateFieldTop}>
        <Text style={styles.dateFieldLabel}>{label}</Text>
        <TouchableOpacity onPress={onToday}>
          <Text style={styles.dateFieldToday}>Today</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.dateFieldActions}>
        <TouchableOpacity style={styles.dateValueBtn} onPress={onPressDate}>
          <Text style={styles.dateValueText}>{formatDateLabel(value)}</Text>
          <Text style={styles.dateChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.timeValueBtn} onPress={onPressTime}>
          <Text style={styles.timeValueText}>{formatTimeLabel(value)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DateRangeFields({
  startValue,
  targetValue,
  onStartDate,
  onStartTime,
  onStartToday,
  onTargetDate,
  onTargetTime,
  onTargetToday,
  styles,
}: {
  startValue: number;
  targetValue: number;
  onStartDate: () => void;
  onStartTime: () => void;
  onStartToday: () => void;
  onTargetDate: () => void;
  onTargetTime: () => void;
  onTargetToday: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.dateRangeRow}>
      <DateTimeField
        label="Start"
        value={startValue}
        onPressDate={onStartDate}
        onPressTime={onStartTime}
        onToday={onStartToday}
        styles={styles}
      />
      <DateTimeField
        label="Finish"
        value={targetValue}
        onPressDate={onTargetDate}
        onPressTime={onTargetTime}
        onToday={onTargetToday}
        styles={styles}
      />
    </View>
  );
}

const GOAL_COLOR = '#F97316';
const OVERDUE_COLOR = '#DC2626';

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

export default function GoalsScreen({ onClose, initialGoalId }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editStartAt, setEditStartAt] = useState(currentHourTs);
  const [editTargetAt, setEditTargetAt] = useState(currentHourTs);
  const [editProgress, setEditProgress] = useState('');
  const [newText, setNewText] = useState('');
  const [newStartAt, setNewStartAt] = useState(currentHourTs);
  const [newTargetAt, setNewTargetAt] = useState(currentHourTs);
  const [recording, setRecording] = useState<RecordingTarget>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const [activeDatePicker, setActiveDatePicker] = useState<ActiveDatePicker>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [filter, setFilter] = useState<GoalStatus | 'all'>('active');

  useEffect(() => { load(); }, [initialGoalId]);

  async function load() {
    try {
      const all = await GoalsService.getAllGoals();
      setGoals(all);
      if (initialGoalId !== undefined) {
        const focused = all.find(goal => goal.id === initialGoalId);
        if (focused) {
          setFilter('all');
          startEdit(focused);
        }
      }
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
    if (newTargetAt < newStartAt) {
      Alert.alert('Invalid dates', 'Finish must be the same as or later than Start.');
      return;
    }
    const now = Date.now();
    try {
      const saved = await GoalsService.saveGoal({
        text, startAt: newStartAt, targetAt: newTargetAt, progress: 0,
        status: 'active', createdAt: now, updatedAt: now,
      });
      setGoals(prev => [saved, ...prev]);
      setNewText('');
      const nextDefault = currentHourTs();
      setNewStartAt(nextDefault);
      setNewTargetAt(nextDefault);
    } catch (e: any) {
      Alert.alert('Failed to add goal', String(e?.message ?? e));
    }
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setEditText(goal.text);
    setEditStartAt(goal.startAt);
    setEditTargetAt(goal.targetAt ?? currentHourTs());
    setEditProgress(String(goal.progress));
  }

  async function commitEdit(goal: Goal) {
    const text = editText.trim();
    if (!text) { setEditingId(null); return; }
    if (editTargetAt < editStartAt) {
      Alert.alert('Invalid dates', 'Finish must be the same as or later than Start.');
      return;
    }
    const parsedProgress = editProgress.trim() === '' ? goal.progress : Number(editProgress);
    if (!Number.isFinite(parsedProgress)) {
      Alert.alert('Invalid progress', 'Progress must be a number from 0 to 100.');
      return;
    }
    const progress = Math.max(0, Math.min(100, Math.round(parsedProgress)));
    const status: GoalStatus = progress >= 100 ? 'done' : goal.status === 'done' ? 'active' : goal.status;
    const updated: Goal = { ...goal, text, startAt: editStartAt, targetAt: editTargetAt, status, updatedAt: Date.now() };
    try {
      await GoalsService.updateGoal(updated);
      const saved = await GoalsService.setProgress(updated, progress);
      setGoals(prev => prev.map(g => g.id === saved.id ? saved : g));
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

  function getPickerValue(field: DateFieldKey): number {
    switch (field) {
      case 'newStart': return newStartAt;
      case 'newTarget': return newTargetAt;
      case 'editStart': return editStartAt;
      case 'editTarget': return editTargetAt;
    }
  }

  function updatePickerValue(field: DateFieldKey, value: number) {
    switch (field) {
      case 'newStart': setNewStartAt(value); break;
      case 'newTarget': setNewTargetAt(value); break;
      case 'editStart': setEditStartAt(value); break;
      case 'editTarget': setEditTargetAt(value); break;
    }
  }

  function handleDateTimeChange(event: DateTimePickerEvent, picked?: Date) {
    if (!activeDatePicker) return;
    const picker = activeDatePicker;
    setActiveDatePicker(null);
    if (event.type === 'dismissed' || !picked) return;
    const current = getPickerValue(picker.field);
    updatePickerValue(
      picker.field,
      picker.mode === 'date' ? replaceDatePart(current, picked) : replaceTimePart(current, picked),
    );
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
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

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
          const overdue = isGoalOverdue(goal);
          const color = overdue ? OVERDUE_COLOR : STATUS_COLORS[goal.status];
          const recEdit = recording?.type === 'edit' && (recording as any).id === goal.id;
          return (
            <View
              key={goal.id}
              style={[
                styles.goalCard,
                { borderLeftColor: color },
                overdue && styles.goalCardOverdue,
              ]}>
              {isEditing ? (
                <>
                  <DateRangeFields
                    startValue={editStartAt}
                    targetValue={editTargetAt}
                    onStartDate={() => setActiveDatePicker({ field: 'editStart', mode: 'date' })}
                    onStartTime={() => setActiveDatePicker({ field: 'editStart', mode: 'time' })}
                    onStartToday={() => setEditStartAt(setTodayKeepingTime(editStartAt))}
                    onTargetDate={() => setActiveDatePicker({ field: 'editTarget', mode: 'date' })}
                    onTargetTime={() => setActiveDatePicker({ field: 'editTarget', mode: 'time' })}
                    onTargetToday={() => setEditTargetAt(setTodayKeepingTime(editTargetAt))}
                    styles={styles}
                  />
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
                    <View style={styles.goalDates}>
                      <Text style={styles.goalDateText}>Start {formatGoalDateTime(goal.startAt)}</Text>
                      <Text style={[styles.goalDateText, overdue && styles.goalOverdueText]}>Finish {formatGoalDateTime(goal.targetAt)}</Text>
                    </View>
                    <View style={styles.goalMeta}>
                      <Text style={[styles.goalStatus, { color }]}>
                        {overdue ? 'Overdue' : STATUS_LABELS[goal.status]} · {goal.progress}%
                      </Text>
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
          <DateRangeFields
            startValue={newStartAt}
            targetValue={newTargetAt}
            onStartDate={() => setActiveDatePicker({ field: 'newStart', mode: 'date' })}
            onStartTime={() => setActiveDatePicker({ field: 'newStart', mode: 'time' })}
            onStartToday={() => setNewStartAt(setTodayKeepingTime(newStartAt))}
            onTargetDate={() => setActiveDatePicker({ field: 'newTarget', mode: 'date' })}
            onTargetTime={() => setActiveDatePicker({ field: 'newTarget', mode: 'time' })}
            onTargetToday={() => setNewTargetAt(setTodayKeepingTime(newTargetAt))}
            styles={styles}
          />
          <TextInput
            style={styles.addInput}
            value={newText}
            onChangeText={setNewText}
            placeholder="What do you want to achieve?"
            placeholderTextColor={colors.placeholder}
            multiline
            textAlignVertical="top"
          />
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

      {activeDatePicker && (
        <DateTimePicker
          value={new Date(getPickerValue(activeDatePicker.field))}
          mode={activeDatePicker.mode}
          display="default"
          onChange={handleDateTimeChange}
        />
      )}
    </KeyboardAvoidingView>
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
      backgroundColor: GOAL_COLOR + '0c', borderRadius: 12, padding: 14, gap: 8,
      borderLeftWidth: 4,
      borderWidth: 1,
      borderColor: GOAL_COLOR + '60',
    },
    goalCardOverdue: {
      backgroundColor: OVERDUE_COLOR + '16',
      borderColor: OVERDUE_COLOR + '60',
    },
    goalMain:       { gap: 6 },
    goalText:       { fontSize: 15, color: colors.text, lineHeight: 22 },
    goalMeta:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    goalStatus:     { fontSize: 12, fontWeight: '600' },
    goalDates:      { gap: 2 },
    goalDateText:   { fontSize: 11, color: colors.textSecondary },
    goalOverdueText: { color: OVERDUE_COLOR, fontWeight: '700' },
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
    addActions:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
    addBtn: {
      paddingHorizontal: 14, paddingVertical: 6, backgroundColor: GOAL_COLOR, borderRadius: 8,
    },
    addBtnText:     { fontSize: 14, color: '#fff', fontWeight: '600' },
    dateRangeRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'stretch',
    },
    dateField: {
      flex: 1,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 8,
      padding: 8,
      gap: 6,
    },
    dateFieldTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateFieldLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
    dateFieldToday: { fontSize: 11, color: GOAL_COLOR, fontWeight: '600' },
    dateFieldActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    dateValueBtn: {
      flex: 1,
      minHeight: 30,
      borderRadius: 7,
      paddingHorizontal: 7,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateValueText: {
      flex: 1,
      fontSize: 12,
      color: colors.text,
      fontWeight: '500',
    },
    dateChevron: { fontSize: 16, color: colors.textSecondary, marginLeft: 3 },
    timeValueBtn: {
      minHeight: 30,
      minWidth: 52,
      borderRadius: 7,
      paddingHorizontal: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: GOAL_COLOR + '14',
      borderWidth: 1,
      borderColor: GOAL_COLOR + '50',
    },
    timeValueText: { fontSize: 12, color: GOAL_COLOR, fontWeight: '700' },
  });
}
