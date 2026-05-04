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
import StorageService from '../services/StorageService';
import { ParsedBlock } from '../types/DayPlan';
import { applyTranscription } from '../utils/parseTranscript';
import { formatMin, parseDayPlan } from '../utils/parseDayPlan';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  initialDate?: Date;
  onClose: () => void;
}

interface EditBlock {
  startText: string;
  endText: string;
  activity: string;
}

type RecordingState = { index: number; ms: number } | null;

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parsedToEdit(b: ParsedBlock): EditBlock {
  return { startText: formatMin(b.startMin), endText: formatMin(b.endMin), activity: b.activity };
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

export default function DayPlanScreen({ initialDate, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate ?? new Date());
  const [rawInput, setRawInput] = useState('');
  const [blocks, setBlocks] = useState<EditBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState<RecordingState>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dateStr = toDateString(currentDate);

  useEffect(() => {
    async function load() {
      setBlocks([]);
      setRawInput('');
      try {
        const plan = await StorageService.getDayPlan(dateStr);
        if (!plan) return;
        const existing = await StorageService.getPlanBlocks(plan.id);
        setBlocks(existing.map(b => parsedToEdit(b)));
      } catch (e: any) {
        Alert.alert('Load failed', String(e?.message ?? e));
      }
    }
    load();
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
    setBlocks(prev => prev.filter((_, i) => i !== index));
  }

  function addBlock() {
    setBlocks(prev => [...prev, { startText: '', endText: '', activity: '' }]);
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

    const parsed: ParsedBlock[] = [];
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
      parsed.push({ startMin, endMin, activity: b.activity.trim() });
    }

    if (parsed.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const plan = await StorageService.upsertDayPlan(dateStr);
      await StorageService.replacePlanBlocks(plan.id, parsed);
      onClose();
    } catch (e: any) {
      Alert.alert('Save failed', String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Plan</Text>
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
        {blocks.length > 0 && (
          <Text style={styles.sectionLabel}>PLAN BLOCKS</Text>
        )}
        {blocks.map((block, i) => {
          const isRecording = recording?.index === i;
          return (
            <View key={i} style={styles.blockCard}>
              <View style={styles.blockTimes}>
                <TextInput
                  style={styles.timeInput}
                  value={block.startText}
                  onChangeText={v => updateBlock(i, { startText: v })}
                  onBlur={() => updateBlock(i, { startText: normalizeTimeText(block.startText) })}
                  placeholder="14"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="numeric"
                  maxLength={5}
                />
                <Text style={styles.timeDash}>–</Text>
                <TextInput
                  style={styles.timeInput}
                  value={block.endText}
                  onChangeText={v => updateBlock(i, { endText: v })}
                  onBlur={() => updateBlock(i, { endText: normalizeTimeText(block.endText) })}
                  placeholder="16"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="numeric"
                  maxLength={5}
                />
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
            </View>
          );
        })}

        <TouchableOpacity style={styles.addBtn} onPress={addBlock}>
          <Text style={styles.addBtnText}>+ Add block manually</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
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
    save: { fontSize: 17, color: colors.accent, fontWeight: '600' },
    saveDim: { opacity: 0.4 },
    dayNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    navBtn: { padding: 8 },
    navArrow: { fontSize: 28, color: colors.accent, fontWeight: '300' },
    dayLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
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
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
    },
    blockTimes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeInput: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      borderBottomWidth: 1.5,
      borderBottomColor: colors.accent,
      paddingVertical: 2,
      minWidth: 60,
      textAlign: 'center',
    },
    timeDash: { fontSize: 16, color: colors.textSecondary },
    removeBtn: { marginLeft: 'auto', paddingHorizontal: 4 },
    removeBtnText: { fontSize: 16, color: colors.placeholder },
    activityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    activityInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingVertical: 4,
    },
    micBtn: {
      padding: 6,
      borderRadius: 8,
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
  });
}
