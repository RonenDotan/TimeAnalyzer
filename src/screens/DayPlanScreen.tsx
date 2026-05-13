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
import StorageService from '../services/StorageService';
import GoalsService from '../services/GoalsService';
import CalendarSyncService from '../services/CalendarSyncService';
import { ParsedBlock, PlanBlock } from '../types/DayPlan';
import { Goal, isGoalOverdue } from '../types/Goal';
import { applyTranscription } from '../utils/parseTranscript';
import { formatMin, parseDayPlan } from '../utils/parseDayPlan';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

const GOAL_COLOR = '#F97316';
const OVERDUE_COLOR = '#DC2626';
const GOALS_COLLAPSED_COUNT = 2;

interface Props {
  initialDate?: Date;
  onClose: () => void;
  debugMode?: boolean;
  calendarColor?: string;
}

interface EditBlock {
  id?: number;     // undefined for newly added blocks
  startText: string;
  endText: string;
  activity: string;
  syncedAt?: number | null;
  updatedAt?: number;
  status?: 0 | 1;
}

type RecordingState = { index: number; ms: number } | null;
type ActiveTimePicker = { index: number; field: 'start' | 'end' } | null;

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parsedToEdit(b: ParsedBlock): EditBlock {
  return { startText: formatMin(b.startMin), endText: formatMin(b.endMin), activity: b.activity };
}

function planBlockToEdit(b: PlanBlock): EditBlock {
  return {
    id: b.id,
    startText: formatMin(b.startMin),
    endText: formatMin(b.endMin),
    activity: b.activity,
    syncedAt: b.syncedAt,
    updatedAt: b.updatedAt,
    status: b.status,
  };
}

function parseTimeText(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2] ?? '0', 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function normalizeTimeText(text: string): string {
  const min = parseTimeText(text);
  if (min === null) return text;
  return formatMin(min);
}

function minToDate(min: number): Date {
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return d;
}

function dateToMin(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
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

export default function DayPlanScreen({ initialDate, onClose, debugMode = false, calendarColor = '#7986CB' }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate ?? new Date());
  const [rawInput, setRawInput] = useState('');
  const [blocks, setBlocks] = useState<EditBlock[]>([]);
  const [calendarBlocks, setCalendarBlocks] = useState<PlanBlock[]>([]);
  const [deletedBlockIds, setDeletedBlockIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState<RecordingState>(null);
  const [activeTimePicker, setActiveTimePicker] = useState<ActiveTimePicker>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsExpanded, setGoalsExpanded] = useState(false);
  const [newGoalText, setNewGoalText] = useState('');
  const [addingGoal, setAddingGoal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dateStr = toDateString(currentDate);

  async function loadGoals() {
    const active = await GoalsService.getActiveGoals(Date.now());
    setGoals(active);
  }

  useEffect(() => {
    async function load() {
      setBlocks([]);
      setCalendarBlocks([]);
      setDeletedBlockIds([]);
      setRawInput('');
      try {
        const [plan, calBlocks] = await Promise.all([
          StorageService.getDayPlan(dateStr),
          StorageService.getCalendarPlanBlocksByDate(dateStr),
        ]);
        setCalendarBlocks(calBlocks);
        if (!plan) return;
        const existing = await StorageService.getPlanBlocks(plan.id);
        setBlocks(existing.map(b => planBlockToEdit(b)));
      } catch (e: any) {
        Alert.alert('Load failed', String(e?.message ?? e));
      }
    }
    load();
    loadGoals();
    setGoalsExpanded(false);
  }, [dateStr]);

  function goToPrevDay() {
    setCurrentDate(d => new Date(d.getTime() - 86_400_000));
  }

  function goToNextDay() {
    setCurrentDate(d => new Date(d.getTime() + 86_400_000));
  }

  function handleParse() {
    const parsed = parseDayPlan(rawInput);
    if (parsed.length === 0) {
      Alert.alert('Nothing parsed', 'Try: "from 8 to 10 backend work, 10 to 12 meetings"');
      return;
    }
    setBlocks(parsed.map(parsedToEdit));
    setRawInput('');
  }

  function updateBlock(index: number, patch: Partial<EditBlock>) {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, ...patch } : b));
  }

  function removeBlock(index: number) {
    setBlocks(prev => {
      const block = prev[index];
      if (block.id !== undefined) {
        setDeletedBlockIds(ids => [...ids, block.id!]);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function addBlock() {
    setBlocks(prev => [...prev, { startText: '', endText: '', activity: '' }]);
  }

  function pickerDateFor(block: EditBlock, field: 'start' | 'end'): Date {
    const raw = field === 'start' ? block.startText : block.endText;
    return minToDate(parseTimeText(raw) ?? 9 * 60);
  }

  function handleTimePicked(event: DateTimePickerEvent, picked?: Date) {
    if (!activeTimePicker) return;
    const picker = activeTimePicker;
    setActiveTimePicker(null);
    if (event.type === 'dismissed' || !picked) return;
    updateBlock(picker.index, {
      [picker.field === 'start' ? 'startText' : 'endText']: formatMin(dateToMin(picked)),
    });
  }

  async function startBlockDictation(index: number) {
    try {
      await TranscriptionService.start(() => {});
      const start = Date.now();
      timerRef.current = setInterval(
        () => setRecording(r => r ? { ...r, ms: Date.now() - start } : null),
        100,
      );
      setRecording({ index, ms: 0 });
    } catch (e: any) {
      Alert.alert('Recording failed', String(e?.message ?? e));
    }
  }

  async function stopBlockDictation(index: number) {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(null);
    try {
      const text = await TranscriptionService.stop();
      if (text?.trim()) {
        updateBlock(index, { activity: text.trim() });
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

  async function handleAddGoal() {
    const text = newGoalText.trim();
    if (!text) return;
    const now = Date.now();
    await GoalsService.saveGoal({
      text,
      startAt: now,
      targetAt: null,
      progress: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    setNewGoalText('');
    setAddingGoal(false);
    await loadGoals();
  }

  async function handleSave() {
    let currentBlocks = blocks;
    if (rawInput.trim().length > 0) {
      const autoParsed = parseDayPlan(rawInput);
      if (autoParsed.length > 0) {
        currentBlocks = [...currentBlocks, ...autoParsed.map(parsedToEdit)];
        setBlocks(currentBlocks);
        setRawInput('');
      }
    }

    const parsed: Array<ParsedBlock & { id?: number }> = [];
    for (const b of currentBlocks) {
      const startMin = parseTimeText(b.startText);
      const endMin = parseTimeText(b.endText);
      if (startMin === null) {
        Alert.alert('Invalid time', `"${b.startText}" is not a valid time (use HH:MM).`);
        return;
      }
      if (endMin === null) {
        Alert.alert('Invalid time', `"${b.endText}" is not a valid time (use HH:MM).`);
        return;
      }
      if (endMin <= startMin) {
        Alert.alert('Invalid range', `End time must be after start time for "${b.activity}".`);
        return;
      }
      if (!b.activity.trim()) {
        Alert.alert('Missing activity', 'Every block needs an activity description.');
        return;
      }
      parsed.push({ startMin, endMin, activity: b.activity.trim(), id: b.id });
    }

    if (parsed.length === 0 && deletedBlockIds.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const plan = await StorageService.upsertDayPlan(dateStr);
      await StorageService.upsertPlanBlocks(plan.id, parsed, deletedBlockIds);
      setDeletedBlockIds([]);
      CalendarSyncService.syncChanged().catch(() => {});
      onClose();
    } catch (e: any) {
      Alert.alert('Save failed', String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  const styles = makeStyles(colors, calendarColor);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Plans</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.save, saving && styles.saveDim]}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dayNav}>
        <TouchableOpacity onPress={goToPrevDay} style={styles.navBtn}>
          <Text style={styles.navArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.dayLabel}>{formatHeader(dateStr)}</Text>
        <TouchableOpacity onPress={goToNextDay} style={styles.navBtn}>
          <Text style={styles.navArrow}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      {(goals.length > 0 || addingGoal) && (
        <View style={styles.goalsSectionCard}>
          <View style={styles.goalsSectionHeader}>
            <Text style={styles.goalsSectionTitle}>{'\u{1F3AF}  ACTIVE GOALS'}</Text>
            <TouchableOpacity onPress={() => setAddingGoal(v => !v)}>
              <Text style={styles.goalsSectionAdd}>{addingGoal ? '\u{2715}' : '+ New goal'}</Text>
            </TouchableOpacity>
          </View>

          {(goalsExpanded ? goals : goals.slice(0, GOALS_COLLAPSED_COUNT)).map(goal => {
            const overdue = isGoalOverdue(goal);
            const goalColor = overdue ? OVERDUE_COLOR : GOAL_COLOR;
            return (
            <View key={goal.id} style={[styles.goalRow, overdue && styles.goalRowOverdue]}>
              <View style={styles.goalRowTop}>
                <Text style={styles.goalText} numberOfLines={1}>{goal.text}</Text>
                <Text style={[styles.goalPct, { color: goalColor }]}>{goal.progress}%</Text>
              </View>
              <View style={styles.goalProgressBg}>
                <View style={[styles.goalProgressFill, { width: `${goal.progress}%` as any, backgroundColor: goalColor }]} />
              </View>
              {goal.targetAt !== null && (
                <Text style={[styles.goalTarget, overdue && styles.goalOverdueText]}>
                  {'\u{1F4C5} '}{new Date(goal.targetAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              )}
              {overdue && <Text style={styles.goalOverdueText}>Overdue</Text>}
            </View>
            );
          })}

          {goals.length > GOALS_COLLAPSED_COUNT && (
            <TouchableOpacity
              style={styles.goalsToggle}
              onPress={() => setGoalsExpanded(prev => !prev)}>
              <Text style={styles.goalsToggleText}>
                {goalsExpanded ? 'Show less' : `Show ${goals.length - GOALS_COLLAPSED_COUNT} more`}
              </Text>
            </TouchableOpacity>
          )}

          {addingGoal && (
            <View style={styles.addGoalRow}>
              <TextInput
                style={styles.addGoalInput}
                value={newGoalText}
                onChangeText={setNewGoalText}
                placeholder="Describe your goal..."
                placeholderTextColor={colors.placeholder}
                multiline
                textAlignVertical="top"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.addGoalBtn, !newGoalText.trim() && styles.addGoalBtnDisabled]}
                onPress={handleAddGoal}
                disabled={!newGoalText.trim()}>
                <Text style={styles.addGoalBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Voice / text input area */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.rawInput}
            value={rawInput}
            onChangeText={setRawInput}
            placeholder={'e.g. "from 8 to 10 backend work, 10 to 12 meetings"'}
            placeholderTextColor={colors.placeholder}
            multiline
            textAlignVertical="top"
          />
          <DictateBar onResult={raw => setRawInput(prev => applyTranscription(prev, raw))} />
          {rawInput.trim().length > 0 && (
            <TouchableOpacity style={styles.parseBtn} onPress={handleParse}>
              <Text style={styles.parseBtnText}>Parse into blocks</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Block list */}
        {(blocks.length > 0 || calendarBlocks.length > 0) && (
          <Text style={styles.sectionLabel}>PLAN BLOCKS</Text>
        )}
        {blocks.map((block, i) => {
          const isRecording = recording?.index === i;
          return (
            <View key={i} style={styles.blockCard}>
              <View style={styles.blockTimes}>
                <TouchableOpacity style={styles.timeInput} onPress={() => setActiveTimePicker({ index: i, field: 'start' })}>
                  <Text style={styles.timeInputText}>{normalizeTimeText(block.startText) || 'Start'}</Text>
                </TouchableOpacity>
                <Text style={styles.timeDash}>–</Text>
                <TouchableOpacity style={styles.timeInput} onPress={() => setActiveTimePicker({ index: i, field: 'end' })}>
                  <Text style={styles.timeInputText}>{normalizeTimeText(block.endText) || 'End'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeBlock(i)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.activityRow}>
                <TextInput
                  style={styles.activityInput}
                  value={block.activity}
                  onChangeText={v => updateBlock(i, { activity: v })}
                  placeholder="Activity description…"
                  placeholderTextColor={colors.placeholder}
                  editable={!isRecording}
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.micBtn, isRecording && styles.micBtnActive]}
                  onPress={() => isRecording ? stopBlockDictation(i) : startBlockDictation(i)}>
                  <Text style={styles.micIcon}>{isRecording ? '⏹' : '🎙'}</Text>
                </TouchableOpacity>
              </View>
              {isRecording && (
                <Text style={styles.recordingLabel}>
                  Recording… {(recording!.ms / 1000).toFixed(1)}s — tap ⏹ to stop
                </Text>
              )}
              {debugMode && block.id !== undefined && (
                <View style={styles.debugRow}>
                  <Text style={styles.debugText}>
                    synced: {block.syncedAt !== null && block.syncedAt !== undefined && block.updatedAt !== undefined && block.syncedAt >= block.updatedAt ? 'yes' : 'no'}
                  </Text>
                  {block.updatedAt !== undefined && (
                    <Text style={styles.debugText}>
                      upd: {new Date(block.updatedAt).toLocaleTimeString()}
                    </Text>
                  )}
                  {block.syncedAt != null && (
                    <Text style={styles.debugText}>
                      sync_at: {new Date(block.syncedAt).toLocaleTimeString()}
                    </Text>
                  )}
                  <Text style={styles.debugText}>
                    status: {block.status === 1 ? 'active' : block.status === 0 ? 'del' : 'new'}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Calendar-imported blocks (read-only, sorted by start time) */}
        {[...calendarBlocks]
          .sort((a, b) => a.startMin - b.startMin)
          .map(block => (
            <View key={`cal-${block.id}`} style={styles.calendarBlockCard}>
              <View style={styles.blockTimes}>
                <Text style={styles.calendarBlockTime}>
                  {formatMin(block.startMin)} – {formatMin(block.endMin)}
                </Text>
                <Text style={styles.calendarBadge}>🗓 G</Text>
              </View>
              <Text style={styles.calendarBlockActivity}>{block.activity}</Text>
              {debugMode && (
                <View style={styles.debugRow}>
                  <Text style={styles.debugText}>
                    synced: {block.syncedAt !== null && block.syncedAt >= block.updatedAt ? 'yes' : 'no'}
                  </Text>
                  {block.updatedAt !== undefined && (
                    <Text style={styles.debugText}>
                      upd: {new Date(block.updatedAt).toLocaleTimeString()}
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}

        <TouchableOpacity style={styles.addBtn} onPress={addBlock}>
          <Text style={styles.addBtnText}>+ Add block manually</Text>
        </TouchableOpacity>

      </ScrollView>

      {activeTimePicker && blocks[activeTimePicker.index] && (
        <DateTimePicker
          value={pickerDateFor(blocks[activeTimePicker.index], activeTimePicker.field)}
          mode="time"
          display="default"
          onChange={handleTimePicked}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ColorPalette, calendarColor: string) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 16, fontWeight: '600', color: colors.text },
    cancel: { fontSize: 15, color: colors.textSecondary },
    save: { fontSize: 15, color: colors.accent, fontWeight: '600' },
    saveDim: { opacity: 0.4 },
    dayNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 6,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    navBtn: { paddingHorizontal: 8, paddingVertical: 3 },
    navArrow: { fontSize: 24, color: colors.accent, fontWeight: '300' },
    dayLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    body: { padding: 16, gap: 12, paddingBottom: 40 },
    inputCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      gap: 10,
    },
    rawInput: {
      fontSize: 15,
      color: colors.text,
      minHeight: 80,
      textAlignVertical: 'top',
      lineHeight: 22,
    },
    parseBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.accent,
      borderRadius: 8,
    },
    parseBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginTop: 4,
    },
    blockCard: {
      backgroundColor: '#039BE5' + '18',
      borderRadius: 12,
      padding: 14,
      gap: 10,
      borderLeftWidth: 4,
      borderLeftColor: '#039BE5',
    },
    blockTimes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeInput: {
      borderBottomWidth: 1.5,
      borderBottomColor: '#039BE5',
      paddingVertical: 4,
      minWidth: 60,
      alignItems: 'center',
    },
    timeInputText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    timeDash: { fontSize: 16, color: colors.textSecondary },
    removeBtn: { marginLeft: 'auto', paddingHorizontal: 4 },
    removeBtnText: { fontSize: 16, color: colors.placeholder },
    activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    activityInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface + 'cc',
      borderRadius: 8,
      padding: 10,
      minHeight: 64,
      lineHeight: 22,
    },
    micBtn: {
      padding: 6,
      borderRadius: 8,
      marginTop: 4,
    },
    micBtnActive: {
      backgroundColor: colors.recordBtn + '22',
    },
    micIcon: { fontSize: 20 },
    recordingLabel: {
      fontSize: 12,
      color: colors.recordBtn,
      fontStyle: 'italic',
    },
    addBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
    addBtnText: { fontSize: 15, color: colors.accent, fontWeight: '500' },
    calendarBlockCard: {
      backgroundColor: calendarColor + '18',
      borderRadius: 12,
      padding: 14,
      gap: 6,
      borderLeftWidth: 4,
      borderLeftColor: calendarColor,
      borderStyle: 'dashed',
    },
    calendarBlockTime: {
      fontSize: 15,
      fontWeight: '600',
      color: calendarColor,
      flex: 1,
    },
    calendarBlockActivity: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
    },
    calendarBadge: {
      fontSize: 12,
      color: calendarColor,
      fontWeight: '600',
    },
    debugRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 4,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    debugText: { fontSize: 11, color: colors.textSecondary, fontFamily: 'monospace' },
    goalsSectionCard: {
      backgroundColor: GOAL_COLOR + '10',
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: GOAL_COLOR + '40',
    },
    goalsSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    goalsSectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: GOAL_COLOR,
      letterSpacing: 0.5,
    },
    goalsSectionAdd: {
      fontSize: 13,
      color: GOAL_COLOR,
      fontWeight: '500',
    },
    goalsToggle: {
      alignSelf: 'flex-start',
      minHeight: 22,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    goalsToggleText: {
      fontSize: 12,
      color: GOAL_COLOR,
      fontWeight: '700',
    },
    goalsEmpty: {
      fontSize: 14,
      color: colors.placeholder,
      fontStyle: 'italic',
    },
    goalRow: { gap: 2, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 3 },
    goalRowOverdue: { backgroundColor: OVERDUE_COLOR + '16' },
    goalRowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    goalText: { fontSize: 12, color: colors.text, flex: 1, lineHeight: 16 },
    goalPct: { fontSize: 12, fontWeight: '700', color: GOAL_COLOR, marginLeft: 6 },
    goalProgressBg: { height: 3, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
    goalProgressFill: { height: 3, backgroundColor: GOAL_COLOR, borderRadius: 2 },
    goalTarget: { fontSize: 10, color: colors.textSecondary, lineHeight: 13 },
    goalOverdueText: { fontSize: 10, color: OVERDUE_COLOR, fontWeight: '700', lineHeight: 13 },
    addGoalRow: { gap: 8 },
    addGoalInput: {
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 10,
      minHeight: 64,
      lineHeight: 22,
      borderWidth: 1,
      borderColor: GOAL_COLOR,
    },
    addGoalBtn: {
      alignSelf: 'flex-end',
      paddingHorizontal: 20,
      paddingVertical: 8,
      backgroundColor: GOAL_COLOR,
      borderRadius: 8,
    },
    addGoalBtnDisabled: { backgroundColor: colors.placeholder },
    addGoalBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  });
}
