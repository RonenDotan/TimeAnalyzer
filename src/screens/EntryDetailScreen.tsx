import React, { useEffect, useState } from 'react';
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
import StorageService from '../services/StorageService';
import { LogEntry } from '../types/LogEntry';
import { Note } from '../types/Note';
import NoteDetailScreen from './NoteDetailScreen';

interface Props {
  entry: LogEntry;
  onSave: (updated: LogEntry) => void;
  onClose: () => void;
}

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

export default function EntryDetailScreen({ entry, onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [transcript, setTranscript] = useState(entry.transcript);
  const [startTime, setStartTime] = useState(tsToTimeString(entry.timestampStart));
  const [endTime, setEndTime] = useState(tsToTimeString(entry.timestampEnd));
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  useEffect(() => {
    StorageService.getNotesByEntryId(entry.id).then(setNotes);
  }, [entry.id]);

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

    // save edited notes
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

  async function handleDeleteNote(id: number) {
    await StorageService.deleteNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    setEditingNotes(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
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

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
                <TextInput
                  style={styles.timeInput}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="HH:MM"
                  keyboardType="numeric"
                  maxLength={5}
                />
                <Text style={styles.timeSep}>–</Text>
                <TextInput
                  style={styles.timeInput}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="HH:MM"
                  keyboardType="numeric"
                  maxLength={5}
                />
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
            <TextInput
              style={styles.transcriptInput}
              value={transcript}
              onChangeText={setTranscript}
              multiline
              autoFocus
              textAlignVertical="top"
            />
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

        {/* Add new note — always available */}
        <View style={styles.addNoteCard}>
          <TextInput
            style={styles.addNoteInput}
            value={newNoteText}
            onChangeText={setNewNoteText}
            placeholder="New note…"
            placeholderTextColor="#aaa"
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
  headerTitle: { fontSize: 17, fontWeight: '600' },
  headerId: { fontSize: 13, fontWeight: '400', color: '#c0c0c0' },
  headerBtn: { fontSize: 17, color: '#007AFF' },
  editBtn: { color: '#007AFF' },
  saveBtn: { fontWeight: '600' },
  body: { padding: 16, gap: 20, paddingBottom: 40 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6d6d72',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeDisplay: { fontSize: 18, fontWeight: '600', color: '#000' },
  timeInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    borderBottomWidth: 1.5,
    borderBottomColor: '#007AFF',
    paddingVertical: 4,
    minWidth: 60,
    textAlign: 'center',
  },
  timeSep: { fontSize: 18, color: '#000' },
  transcriptText: { fontSize: 16, color: '#000', lineHeight: 24 },
  transcriptInput: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 10,
  },
  notesGroupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6d6d72',
    letterSpacing: 0.5,
    marginLeft: 4,
    marginBottom: 8,
  },
  emptyNotes: { fontSize: 14, color: '#aaa', marginLeft: 4 },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  noteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  noteCardMeta: { fontSize: 11, color: '#b0b0b0', fontWeight: '500' },
  noteDeleteText: { fontSize: 15, color: '#ff3b30', paddingHorizontal: 4 },
  noteText: { fontSize: 15, color: '#000', lineHeight: 22 },
  noteEditInput: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addNoteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  addNoteInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    minHeight: 44,
    textAlignVertical: 'top',
  },
  addNoteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  addNoteBtnDisabled: { backgroundColor: '#b0c8f0' },
  addNoteBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
