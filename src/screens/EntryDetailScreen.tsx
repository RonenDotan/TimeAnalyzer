import React, { useState } from 'react';
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

  function handleCancel() {
    setTranscript(entry.transcript);
    setStartTime(tsToTimeString(entry.timestampStart));
    setEndTime(tsToTimeString(entry.timestampEnd));
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
    setEditing(false);
    onSave(updated);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={editing ? handleCancel : onClose}>
          <Text style={styles.headerBtn}>{editing ? 'Cancel' : 'Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Entry <Text style={styles.headerId}>#{entry.id}</Text></Text>
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
  body: { padding: 16, gap: 20 },
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
});
