import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import StorageService from '../services/StorageService';
import GoalsService from '../services/GoalsService';
import CalendarSyncService from '../services/CalendarSyncService';
import AnalysisService from '../services/AnalysisService';
import { LogEntry } from '../types/LogEntry';
import { Note } from '../types/Note';
import { Goal, GoalEntryContribution } from '../types/Goal';

const GOAL_COLOR = '#F97316';
import DictateBar from '../components/DictateBar';
import SettingsService from '../services/SettingsService';
import NoteDetailScreen from './NoteDetailScreen';
import { applyTranscription } from '../utils/parseTranscript';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  entry: LogEntry;
  onSave: (updated: LogEntry) => void;
  onClose: () => void;
}

type ActiveTimePicker = 'start' | 'end' | null;

function tsToTimeString(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function applyTimeString(originalTs: number, timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  const d = new Date(originalTs);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function timeStringToDate(timeStr: string, fallbackTs: number): Date {
  const ts = applyTimeString(fallbackTs, timeStr);
  return new Date(ts ?? fallbackTs);
}

export default function EntryDetailScreen({ entry, onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [transcript, setTranscript] = useState(entry.transcript);
  const [startTime, setStartTime] = useState(tsToTimeString(entry.timestampStart));
  const [endTime, setEndTime] = useState(tsToTimeString(entry.timestampEnd));
  const [activeTimePicker, setActiveTimePicker] = useState<ActiveTimePicker>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [goalContributions, setGoalContributions] = useState<GoalEntryContribution[]>([]);
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiApplying, setAiApplying] = useState(false);
  const [aiSuggestionInputs, setAiSuggestionInputs] = useState<Record<number, string>>({});
  const [aiSuggestionReasons, setAiSuggestionReasons] = useState<Record<number, string>>({});
  const [aiSuggestionMessage, setAiSuggestionMessage] = useState('');
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [appendKeyword, setAppendKeyword] = useState('append');

  useEffect(() => {
    StorageService.getNotesByEntryId(entry.id).then(setNotes);
    GoalsService.getContributionsByEntryId(entry.id).then(setGoalContributions);
    GoalsService.getActiveGoals(entry.timestampEnd).then(setActiveGoals);
    AnalysisService.isConfigured().then(setAiAvailable).catch(() => setAiAvailable(false));
    SettingsService.load().then(s => setAppendKeyword(s.appendKeyword));
  }, [entry.id, entry.timestampEnd]);

  function handleCancel() {
    setTranscript(entry.transcript);
    setStartTime(tsToTimeString(entry.timestampStart));
    setEndTime(tsToTimeString(entry.timestampEnd));
    setEditingNotes({});
    setEditing(false);
  }

  async function handleSave() {
    const newStart = applyTimeString(entry.timestampStart, startTime);
    const newEnd = applyTimeString(entry.timestampEnd, endTime);

    if (newStart === null) {
      Alert.alert('Invalid time', 'Start time must be in HH:MM format.');
      return;
    }
    if (newEnd === null) {
      Alert.alert('Invalid time', 'End time must be in HH:MM format.');
      return;
    }
    if (newEnd <= newStart) {
      Alert.alert('Invalid time', 'End time must be after start time.');
      return;
    }

    const updated: LogEntry = {
      ...entry,
      timestampStart: newStart,
      timestampEnd: newEnd,
      transcript: transcript.trim(),
    };

    await StorageService.update(updated);

    await Promise.all(
      Object.entries(editingNotes).map(([idStr, text]) => {
        const note = notes.find(n => n.id === parseInt(idStr, 10));
        if (!note) return Promise.resolve();
        return StorageService.updateNote({ ...note, text: text.trim() });
      }),
    );

    const refreshed = await StorageService.getNotesByEntryId(entry.id);
    setNotes(refreshed);
    setEditingNotes({});
    setEditing(false);
    CalendarSyncService.syncChanged().catch(() => {});
    onSave(updated);
  }

  async function handleAddNote() {
    if (!newNoteText.trim()) return;
    const saved = await StorageService.saveNote({
      entryId: entry.id,
      text: newNoteText.trim(),
      createdAt: Date.now(),
    });
    setNotes(prev => [...prev, saved]);
    setNewNoteText('');
  }

  function handleTimePicked(event: DateTimePickerEvent, picked?: Date) {
    const picker = activeTimePicker;
    setActiveTimePicker(null);
    if (!picker || event.type === 'dismissed' || !picked) return;
    const formatted = tsToTimeString(picked.getTime());
    if (picker === 'start') setStartTime(formatted);
    else setEndTime(formatted);
  }

  async function handleDeleteNote(id: number) {
    await StorageService.deleteNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    setEditingNotes(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleSuggestWithAI() {
    if (aiSuggesting || activeGoals.length === 0 || transcript.trim().length === 0) return;

    setAiSuggesting(true);
    setAiSuggestionInputs({});
    setAiSuggestionReasons({});
    setAiSuggestionMessage('');

    try {
      const result = await AnalysisService.suggestGoalContributions(transcript, activeGoals);
      if (result.suggestions.length === 0) {
        setAiSuggestionMessage('No clear goal progress found in this entry.');
        return;
      }

      const nextInputs: Record<number, string> = {};
      const nextReasons: Record<number, string> = {};
      for (const suggestion of result.suggestions) {
        nextInputs[suggestion.goalId] = String(suggestion.contributionPct);
        nextReasons[suggestion.goalId] = suggestion.reason;
      }

      setAiSuggestionInputs(nextInputs);
      setAiSuggestionReasons(nextReasons);
      setAiSuggestionMessage(`Suggested ${result.suggestions.length} contribution${result.suggestions.length === 1 ? '' : 's'}.`);
    } catch (e: any) {
      setAiSuggestionMessage(String(e?.message ?? e));
    } finally {
      setAiSuggesting(false);
    }
  }

  async function handleApplyAISuggestions() {
    const selected = activeGoals
      .map(goal => ({ goal, pct: parseInt(aiSuggestionInputs[goal.id] ?? '', 10) }))
      .filter(item => Number.isFinite(item.pct) && item.pct > 0);

    if (selected.length === 0 || aiApplying) return;

    setAiApplying(true);
    try {
      for (const { goal, pct } of selected) {
        await GoalsService.applyContribution(goal, pct, entry.id);
      }
      const refreshed = await GoalsService.getContributionsByEntryId(entry.id);
      setGoalContributions(refreshed);
      setActiveGoals(await GoalsService.getActiveGoals(entry.timestampEnd));
      setAiSuggestionInputs({});
      setAiSuggestionReasons({});
      setAiSuggestionMessage(`Applied ${selected.length} contribution${selected.length === 1 ? '' : 's'}.`);
      CalendarSyncService.syncChanged().catch(() => {});
    } catch (e: any) {
      Alert.alert('Failed to apply suggestions', String(e?.message ?? e));
    } finally {
      setAiApplying(false);
    }
  }

  if (selectedNote) {
    return (
      <NoteDetailScreen
        note={selectedNote}
        onSave={updated => {
          setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
          setSelectedNote(null);
        }}
        onClose={() => setSelectedNote(null)}
      />
    );
  }

  const styles = makeStyles(colors);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={editing ? handleCancel : onClose}>
          <Text style={styles.headerBtn}>{editing ? 'Cancel' : 'Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Entry <Text style={styles.headerId}>#{entry.id}</Text>
        </Text>
        {editing ? (
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.headerBtn, styles.saveBtn]}>Save</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={[styles.headerBtn, styles.editBtn]}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Time range */}
        <View style={styles.section}>
          <Text style={styles.label}>TIME RANGE</Text>
          <View style={styles.timeRow}>
            {editing ? (
              <>
                <TouchableOpacity style={styles.timeInput} onPress={() => setActiveTimePicker('start')}>
                  <Text style={styles.timeInputText}>{startTime}</Text>
                </TouchableOpacity>
                <Text style={styles.timeSep}>–</Text>
                <TouchableOpacity style={styles.timeInput} onPress={() => setActiveTimePicker('end')}>
                  <Text style={styles.timeInputText}>{endTime}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.timeDisplay}>
                {tsToTimeString(entry.timestampStart)} – {tsToTimeString(entry.timestampEnd)}
              </Text>
            )}
          </View>
        </View>

        {/* Transcript */}
        <View style={styles.section}>
          <Text style={styles.label}>TRANSCRIPT</Text>
          {editing ? (
            <>
              <TextInput
                style={styles.transcriptInput}
                value={transcript}
                onChangeText={setTranscript}
                multiline
                autoFocus
                textAlignVertical="top"
              />
              <DictateBar onResult={raw => setTranscript(prev => applyTranscription(prev, raw, appendKeyword))} />
            </>
          ) : (
            <Text style={styles.transcriptText}>{entry.transcript}</Text>
          )}
        </View>

        {/* Notes */}
        <Text style={styles.notesGroupLabel}>NOTES</Text>

        {notes.length === 0 && (
          <Text style={styles.emptyNotes}>No notes yet.</Text>
        )}

        {notes.map(note => (
          <TouchableOpacity
            key={note.id}
            style={styles.noteCard}
            onPress={() => !editing && setSelectedNote(note)}
            activeOpacity={editing ? 1 : 0.7}>
            <View style={styles.noteCardHeader}>
              <Text style={styles.noteCardMeta}>
                #{note.id} · {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {editing && (
                <TouchableOpacity onPress={() => handleDeleteNote(note.id)}>
                  <Text style={styles.noteDeleteText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {editing ? (
              <TextInput
                style={styles.noteEditInput}
                value={editingNotes[note.id] ?? note.text}
                onChangeText={t => setEditingNotes(prev => ({ ...prev, [note.id]: t }))}
                multiline
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.noteText}>{note.text}</Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Goal contributions */}
        {goalContributions.length > 0 && (
          <>
            <Text style={styles.notesGroupLabel}>GOAL CONTRIBUTIONS</Text>
            {goalContributions.map((c, i) => (
              <View key={i} style={styles.goalContribCard}>
                <View style={styles.goalContribRow}>
                  <Text style={styles.goalContribText} numberOfLines={2}>{c.goalText}</Text>
                  <Text style={styles.goalContribDelta}>+{c.contributionPct}%</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {aiAvailable && activeGoals.length > 0 && (
          <View style={styles.aiSection}>
            <View style={styles.aiHeaderRow}>
              <Text style={styles.aiSectionLabel}>AI GOAL SUGGESTIONS</Text>
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
            </View>

            {!!aiSuggestionMessage && (
              <Text style={styles.aiSuggestionMessage}>{aiSuggestionMessage}</Text>
            )}

            {Object.keys(aiSuggestionInputs).length > 0 && (
              <>
                {activeGoals
                  .filter(goal => aiSuggestionInputs[goal.id] !== undefined)
                  .map(goal => (
                    <View key={goal.id} style={styles.aiSuggestionCard}>
                      <Text style={styles.aiSuggestionGoal}>{goal.text}</Text>
                      {!!aiSuggestionReasons[goal.id] && (
                        <Text style={styles.aiSuggestionReason}>{aiSuggestionReasons[goal.id]}</Text>
                      )}
                      <View style={styles.aiInputRow}>
                        <Text style={styles.aiInputLabel}>Apply</Text>
                        <TextInput
                          style={styles.aiPctInput}
                          value={aiSuggestionInputs[goal.id] ?? ''}
                          onChangeText={v => setAiSuggestionInputs(prev => ({ ...prev, [goal.id]: v }))}
                          placeholder="0"
                          placeholderTextColor={colors.placeholder}
                          keyboardType="numeric"
                          maxLength={3}
                        />
                        <Text style={styles.aiInputLabel}>%</Text>
                      </View>
                    </View>
                  ))}

                <TouchableOpacity
                  style={[styles.aiApplyBtn, aiApplying && styles.aiSuggestBtnDisabled]}
                  onPress={handleApplyAISuggestions}
                  disabled={aiApplying}>
                  <Text style={styles.aiApplyBtnText}>
                    {aiApplying ? 'Applying...' : 'Apply suggestions'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Add new note — always available */}
        <View style={styles.addNoteCard}>
          <TextInput
            style={styles.addNoteInput}
            value={newNoteText}
            onChangeText={setNewNoteText}
            placeholder="New note…"
            placeholderTextColor={colors.placeholder}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.addNoteBtn, !newNoteText.trim() && styles.addNoteBtnDisabled]}
            onPress={handleAddNote}
            disabled={!newNoteText.trim()}>
            <Text style={styles.addNoteBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {activeTimePicker && (
        <DateTimePicker
          value={timeStringToDate(
            activeTimePicker === 'start' ? startTime : endTime,
            activeTimePicker === 'start' ? entry.timestampStart : entry.timestampEnd,
          )}
          mode="time"
          display="default"
          onChange={handleTimePicked}
        />
      )}
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
      backgroundColor: '#33B679' + '18',
      borderBottomWidth: 2,
      borderBottomColor: '#33B679',
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
    headerId: { fontSize: 13, fontWeight: '400', color: colors.border },
    headerBtn: { fontSize: 17, color: '#33B679' },
    editBtn: { color: '#33B679' },
    saveBtn: { fontWeight: '600' },
    body: { padding: 16, gap: 20, paddingBottom: 40 },
    section: {
      backgroundColor: '#33B679' + '18',
      borderRadius: 12,
      padding: 16,
      borderLeftWidth: 4,
      borderLeftColor: '#33B679',
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: '#33B679',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeDisplay: { fontSize: 18, fontWeight: '600', color: colors.text },
    timeInput: {
      borderBottomWidth: 1.5,
      borderBottomColor: '#33B679',
      paddingVertical: 4,
      minWidth: 60,
      alignItems: 'center',
    },
    timeInputText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    timeSep: { fontSize: 18, color: colors.text },
    transcriptText: { fontSize: 16, color: colors.text, lineHeight: 24 },
    transcriptInput: {
      fontSize: 16,
      color: colors.text,
      lineHeight: 24,
      minHeight: 120,
      borderWidth: 1,
      borderColor: '#33B679',
      borderRadius: 8,
      padding: 10,
      backgroundColor: colors.surface + 'cc',
    },
    notesGroupLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: '#33B679',
      letterSpacing: 0.5,
      marginLeft: 4,
      marginBottom: 8,
    },
    emptyNotes: { fontSize: 14, color: colors.placeholder, marginLeft: 4 },
    noteCard: {
      backgroundColor: '#33B679' + '12',
      borderRadius: 12,
      padding: 14,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
      borderLeftWidth: 4,
      borderLeftColor: '#33B679',
    },
    noteCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    noteCardMeta: { fontSize: 11, color: colors.placeholder, fontWeight: '500' },
    noteDeleteText: { fontSize: 15, color: colors.recordBtn, paddingHorizontal: 4 },
    noteText: { fontSize: 15, color: colors.text, lineHeight: 22 },
    noteEditInput: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
      borderWidth: 1,
      borderColor: '#33B679',
      borderRadius: 8,
      padding: 8,
      minHeight: 60,
      textAlignVertical: 'top',
      backgroundColor: colors.surface + 'cc',
    },
    addNoteCard: {
      backgroundColor: '#33B679' + '12',
      borderRadius: 12,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#33B679',
      borderStyle: 'dashed',
    },
    addNoteInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      minHeight: 44,
      textAlignVertical: 'top',
    },
    addNoteBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: '#33B679',
      borderRadius: 8,
    },
    addNoteBtnDisabled: { backgroundColor: colors.placeholder },
    addNoteBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
    goalContribCard: {
      backgroundColor: GOAL_COLOR + '10',
      borderRadius: 10,
      padding: 12,
      borderLeftWidth: 3,
      borderLeftColor: GOAL_COLOR,
    },
    goalContribRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    goalContribText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
    goalContribDelta: { fontSize: 15, fontWeight: '700', color: GOAL_COLOR },
    aiSection: {
      backgroundColor: GOAL_COLOR + '0f',
      borderRadius: 12,
      padding: 14,
      gap: 10,
      borderLeftWidth: 4,
      borderLeftColor: GOAL_COLOR,
    },
    aiHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    aiSectionLabel: {
      flex: 1,
      fontSize: 11,
      fontWeight: '700',
      color: GOAL_COLOR,
      letterSpacing: 0.5,
    },
    aiSuggestBtn: {
      minHeight: 34,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: GOAL_COLOR,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiSuggestBtnDisabled: { opacity: 0.65 },
    aiSuggestBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
    aiSuggestionMessage: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
    aiSuggestionCard: {
      backgroundColor: colors.surface + 'cc',
      borderRadius: 10,
      padding: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: GOAL_COLOR + '40',
    },
    aiSuggestionGoal: { fontSize: 14, color: colors.text, fontWeight: '600', lineHeight: 20 },
    aiSuggestionReason: { fontSize: 12, color: GOAL_COLOR, lineHeight: 17 },
    aiInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    aiInputLabel: { fontSize: 14, color: colors.textSecondary },
    aiPctInput: {
      width: 56,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      borderBottomWidth: 2,
      borderBottomColor: GOAL_COLOR,
      paddingVertical: 2,
    },
    aiApplyBtn: {
      alignSelf: 'flex-end',
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: GOAL_COLOR,
      borderRadius: 8,
    },
    aiApplyBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  });
}
