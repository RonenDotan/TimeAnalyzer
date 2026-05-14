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
import DateNavigator from '../components/DateNavigator';
import DictateBar from '../components/DictateBar';
import GoalCard from '../components/GoalCard';
import ScreenHeader from '../components/ScreenHeader';
import TranscriptionService from '../services/TranscriptionService';
import StorageService from '../services/StorageService';
import GoalsService from '../services/GoalsService';
import CalendarSyncService from '../services/CalendarSyncService';
import { ParsedBlock, PlanBlock } from '../types/DayPlan';
import { Goal } from '../types/Goal';
import { applyTranscription } from '../utils/parseTranscript';
import { formatMin, parseDayPlan } from '../utils/parseDayPlan';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n/LanguageContext';

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
  const { t, direction } = useTranslation();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate ?? new Date());
  const [rawInput, setRawInput] = useState('');
  const [blocks, setBlocks] = useState<EditBlock[]>([]);
  const [calendarBlocks, setCalendarBlocks] = useState<PlanBlock[]>([]);
  const [deletedBlockIds, setDeletedBlockIds] = useState<number[]>([]);
  const [recording, setRecording] = useState<RecordingState>(null);
  const [activeTimePicker, setActiveTimePicker] = useState<ActiveTimePicker>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsExpanded, setGoalsExpanded] = useState(false);
  const [newGoalText, setNewGoalText] = useState('');
  const [addingGoal, setAddingGoal] = useState(false);
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editingBlockDraft, setEditingBlockDraft] = useState<EditBlock | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressAutosaveRef = useRef(true);
  const autosavingRef = useRef(false);

  const dateStr = toDateString(currentDate);

  async function loadGoals() {
    const active = await GoalsService.getActiveGoals(Date.now());
    setGoals(active);
  }

  useEffect(() => {
    async function load() {
      suppressAutosaveRef.current = true;
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
        Alert.alert(t('Load failed'), String(e?.message ?? e));
      } finally {
        setTimeout(() => { suppressAutosaveRef.current = false; }, 0);
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
      Alert.alert(t('Nothing parsed'), t('Try: "from 8 to 10 backend work, 10 to 12 meetings"'));
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

  function pickerDateFor(index: number, field: 'start' | 'end'): Date {
    const block = (editingBlockIndex === index && editingBlockDraft) ? editingBlockDraft : blocks[index];
    const raw = field === 'start' ? block.startText : block.endText;
    return minToDate(parseTimeText(raw) ?? 9 * 60);
  }

  function handleTimePicked(event: DateTimePickerEvent, picked?: Date) {
    if (!activeTimePicker) return;
    const picker = activeTimePicker;
    setActiveTimePicker(null);
    if (event.type === 'dismissed' || !picked) return;
    const field = picker.field === 'start' ? 'startText' : 'endText';
    const value = formatMin(dateToMin(picked));
    // If we're in inline-edit mode for this block, update the draft instead
    if (editingBlockIndex === picker.index && editingBlockDraft) {
      setEditingBlockDraft(prev => prev ? { ...prev, [field]: value } : prev);
    } else {
      updateBlock(picker.index, { [field]: value });
    }
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
      Alert.alert(t('Recording failed'), String(e?.message ?? e));
    }
  }

  async function stopBlockDictation(index: number) {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(null);
    try {
      const text = await TranscriptionService.stop();
      if (text?.trim()) {
        if (editingBlockIndex === index && editingBlockDraft) {
          setEditingBlockDraft(prev => prev ? { ...prev, activity: text!.trim() } : prev);
        } else {
          updateBlock(index, { activity: text.trim() });
        }
      }
    } catch (e: any) {
      Alert.alert(t('Transcription failed'), String(e?.message ?? e));
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

  function parseBlocksForAutosave(currentBlocks: EditBlock[]): Array<ParsedBlock & { id?: number }> | null {
    const parsed: Array<ParsedBlock & { id?: number }> = [];
    for (const b of currentBlocks) {
      const startMin = parseTimeText(b.startText);
      const endMin = parseTimeText(b.endText);
      if (startMin === null || endMin === null || endMin <= startMin || !b.activity.trim()) return null;
      parsed.push({ startMin, endMin, activity: b.activity.trim(), id: b.id });
    }
    return parsed;
  }

  useEffect(() => {
    if (suppressAutosaveRef.current) return;
    const parsed = parseBlocksForAutosave(blocks);
    if (parsed === null) return;
    if (parsed.length === 0 && deletedBlockIds.length === 0) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      if (autosavingRef.current) return;
      autosavingRef.current = true;
      try {
        const plan = await StorageService.upsertDayPlan(dateStr);
        const saved = await StorageService.upsertPlanBlocks(plan.id, parsed, deletedBlockIds);
        suppressAutosaveRef.current = true;
        setBlocks(saved.map(b => planBlockToEdit(b)));
        setDeletedBlockIds([]);
        CalendarSyncService.syncChanged().catch(() => {});
        setTimeout(() => { suppressAutosaveRef.current = false; }, 0);
      } catch (e: any) {
        Alert.alert(t('Autosave failed'), String(e?.message ?? e));
      } finally {
        autosavingRef.current = false;
      }
    }, 700);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [blocks, deletedBlockIds, dateStr]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
  }, []);

  const styles = makeStyles(colors, calendarColor, direction);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader
        title="Plans"
        onLeft={onClose}
        leftLabel="Cancel"
      />

      <DateNavigator
        date={currentDate}
        onPrev={goToPrevDay}
        onNext={goToNextDay}
        formatLabel={() => t(formatHeader(dateStr))}
      />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {(goals.length > 0 || addingGoal) && (
          <View style={styles.goalsSectionCard}>
            <View style={styles.goalsSectionHeader}>
              <Text style={styles.goalsSectionTitle}>{t('🎯  ACTIVE GOALS')}</Text>
              <TouchableOpacity onPress={() => setAddingGoal(v => !v)}>
                <Text style={styles.goalsSectionAdd}>{addingGoal ? '\u{2715}' : t('+ New goal')}</Text>
              </TouchableOpacity>
            </View>

            {(goalsExpanded ? goals : goals.slice(0, GOALS_COLLAPSED_COUNT)).map(goal => (
              <GoalCard key={goal.id} goal={goal} />
            ))}

            {goals.length > GOALS_COLLAPSED_COUNT && (
              <TouchableOpacity
                style={styles.goalsToggle}
                onPress={() => setGoalsExpanded(prev => !prev)}>
                <Text style={styles.goalsToggleText}>
                  {goalsExpanded ? t('Show less') : t('Show {n} more', { n: goals.length - GOALS_COLLAPSED_COUNT })}
                </Text>
              </TouchableOpacity>
            )}

            {addingGoal && (
              <View style={styles.addGoalRow}>
                <TextInput
                  style={styles.addGoalInput}
                  value={newGoalText}
                  onChangeText={setNewGoalText}
                  placeholder={t('Describe your goal...')}
                  placeholderTextColor={colors.placeholder}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.addGoalBtn, !newGoalText.trim() && styles.addGoalBtnDisabled]}
                  onPress={handleAddGoal}
                  disabled={!newGoalText.trim()}>
                  <Text style={styles.addGoalBtnText}>{t('Add')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Voice / text input area — debug only */}
        {debugMode && (
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
                <Text style={styles.parseBtnText}>{t('Parse into blocks')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Block list */}
        {(blocks.length > 0 || calendarBlocks.length > 0) && (
          <Text style={styles.sectionLabel}>{t('PLAN BLOCKS')}</Text>
        )}
        {blocks.map((block, i) => {
          const isEditing = editingBlockIndex === i;
          const isRecording = recording?.index === i;

          if (isEditing && editingBlockDraft) {
            // Inline edit mode
            return (
              <View key={i} style={styles.blockCard}>
                <View style={styles.blockTimes}>
                  <TouchableOpacity style={styles.timeInput} onPress={() => setActiveTimePicker({ index: i, field: 'start' })}>
                    <Text style={styles.timeInputText}>{normalizeTimeText(editingBlockDraft.startText) || t('Start')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeDash}>–</Text>
                  <TouchableOpacity style={styles.timeInput} onPress={() => setActiveTimePicker({ index: i, field: 'end' })}>
                    <Text style={styles.timeInputText}>{normalizeTimeText(editingBlockDraft.endText) || t('End')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.activityRow}>
                  <TextInput
                    style={styles.activityInput}
                    value={editingBlockDraft.activity}
                    onChangeText={v => setEditingBlockDraft(prev => prev ? { ...prev, activity: v } : prev)}
                    placeholder={t('Activity description…')}
                    placeholderTextColor={colors.placeholder}
                    editable={!isRecording}
                    multiline
                    textAlignVertical="top"
                    autoFocus
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
                <View style={styles.blockEditActions}>
                  <TouchableOpacity
                    style={styles.blockSaveBtn}
                    onPress={() => {
                      updateBlock(i, editingBlockDraft);
                      setEditingBlockIndex(null);
                      setEditingBlockDraft(null);
                    }}>
                    <Text style={styles.blockSaveBtnText}>{t('Save')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.blockCancelBtn}
                    onPress={() => {
                      setEditingBlockIndex(null);
                      setEditingBlockDraft(null);
                    }}>
                    <Text style={styles.blockCancelBtnText}>{t('Cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.blockDeleteBtn}
                    onPress={() => {
                      removeBlock(i);
                      setEditingBlockIndex(null);
                      setEditingBlockDraft(null);
                    }}>
                    <Text style={styles.blockDeleteBtnText}>{t('Delete')}</Text>
                  </TouchableOpacity>
                </View>
                {debugMode && block.id !== undefined && (
                  <View style={styles.debugRow}>
                    <Text style={styles.debugText}>
                      synced: {block.syncedAt !== null && block.syncedAt !== undefined && block.updatedAt !== undefined && block.syncedAt >= block.updatedAt ? 'yes' : 'no'}
                    </Text>
                    {block.updatedAt !== undefined && (
                      <Text style={styles.debugText}>upd: {new Date(block.updatedAt).toLocaleTimeString()}</Text>
                    )}
                    {block.syncedAt != null && (
                      <Text style={styles.debugText}>sync_at: {new Date(block.syncedAt).toLocaleTimeString()}</Text>
                    )}
                    <Text style={styles.debugText}>status: {block.status === 1 ? 'active' : block.status === 0 ? 'del' : 'new'}</Text>
                  </View>
                )}
              </View>
            );
          }

          // Collapsed card view (goal-card style)
          return (
            <TouchableOpacity
              key={i}
              style={styles.blockCard}
              onPress={() => {
                setEditingBlockIndex(i);
                setEditingBlockDraft({ ...block });
              }}
              activeOpacity={0.75}>
              <View style={styles.blockCardRow}>
                <Text style={styles.blockCardTime}>
                  {normalizeTimeText(block.startText) || '??'} – {normalizeTimeText(block.endText) || '??'}
                </Text>
                <Text style={styles.blockCardEdit}>{t('Edit')}</Text>
              </View>
              <Text style={styles.blockCardActivity}>{block.activity || t('No activity set')}</Text>
              {debugMode && block.id !== undefined && (
                <View style={styles.debugRow}>
                  <Text style={styles.debugText}>
                    synced: {block.syncedAt !== null && block.syncedAt !== undefined && block.updatedAt !== undefined && block.syncedAt >= block.updatedAt ? 'yes' : 'no'}
                  </Text>
                  {block.updatedAt !== undefined && (
                    <Text style={styles.debugText}>upd: {new Date(block.updatedAt).toLocaleTimeString()}</Text>
                  )}
                  {block.syncedAt != null && (
                    <Text style={styles.debugText}>sync_at: {new Date(block.syncedAt).toLocaleTimeString()}</Text>
                  )}
                  <Text style={styles.debugText}>status: {block.status === 1 ? 'active' : block.status === 0 ? 'del' : 'new'}</Text>
                </View>
              )}
            </TouchableOpacity>
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
          <Text style={styles.addBtnText}>{t('+ Add block manually')}</Text>
        </TouchableOpacity>

      </ScrollView>

      {activeTimePicker && blocks[activeTimePicker.index] && (
        <DateTimePicker
          value={pickerDateFor(activeTimePicker.index, activeTimePicker.field)}
          mode="time"
          display="default"
          onChange={handleTimePicked}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ColorPalette, calendarColor: string, direction: 'ltr' | 'rtl') {
  const isRTL = direction === 'rtl';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
    body: { paddingHorizontal: 16, paddingTop: 16, gap: 12, paddingBottom: 40 },
    inputCard: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      gap: 8,
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
      borderRadius: 8,
      padding: 12,
      gap: 8,
      borderLeftWidth: isRTL ? 0 : 4,
      borderRightWidth: isRTL ? 4 : 0,
      borderLeftColor: isRTL ? 'transparent' : '#039BE5',
      borderRightColor: isRTL ? '#039BE5' : 'transparent',
    },
    blockTimes: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 },
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
    activityRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 8 },
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
      borderRadius: 8,
      padding: 12,
      gap: 6,
      borderLeftWidth: isRTL ? 0 : 4,
      borderRightWidth: isRTL ? 4 : 0,
      borderLeftColor: isRTL ? 'transparent' : calendarColor,
      borderRightColor: isRTL ? calendarColor : 'transparent',
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
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
      borderRadius: 8,
      padding: 12,
      gap: 8,
      borderLeftWidth: isRTL ? 0 : 4,
      borderRightWidth: isRTL ? 4 : 0,
      borderLeftColor: isRTL ? 'transparent' : GOAL_COLOR,
      borderRightColor: isRTL ? GOAL_COLOR : 'transparent',
    },
    goalsSectionHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
      padding: 8,
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
    blockCardRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    blockCardTime: {
      fontSize: 14,
      fontWeight: '700',
      color: '#039BE5',
    },
    blockCardEdit: {
      fontSize: 13,
      color: '#039BE5',
      fontWeight: '600',
    },
    blockCardActivity: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
    },
    blockEditActions: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      marginTop: 4,
    },
    blockSaveBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: '#039BE5',
      borderRadius: 8,
    },
    blockSaveBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    blockCancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    blockCancelBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: '700' },
    blockDeleteBtn: {
      marginLeft: 'auto',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    blockDeleteBtnText: { fontSize: 14, color: colors.recordBtn, fontWeight: '500' },
  });
}
