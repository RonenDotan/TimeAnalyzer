import React, { useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StorageService from '../services/StorageService';
import { Note } from '../types/Note';

interface Props {
  note: Note;
  onSave: (updated: Note) => void;
  onClose: () => void;
}

export default function NoteDetailScreen({ note, onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(note.text);
  const dirty = text.trim() !== note.text;

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert('Empty note', 'Note text cannot be empty.');
      return;
    }
    const updated: Note = { ...note, text: trimmed };
    await StorageService.updateNote(updated);
    onSave(updated);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.headerBtn}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Note <Text style={styles.headerId}>#{note.id}</Text>
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={!dirty}>
          <Text style={[styles.headerBtn, styles.saveBtn, !dirty && styles.saveBtnDisabled]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.meta}>
          {new Date(note.createdAt).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          autoFocus
          placeholder="Note text…"
          placeholderTextColor="#aaa"
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
  saveBtn: { fontWeight: '600' },
  saveBtnDisabled: { color: '#b0c8f0' },
  body: { padding: 20, gap: 16 },
  meta: { fontSize: 12, color: '#b0b0b0', fontWeight: '500' },
  textInput: {
    fontSize: 17,
    color: '#000',
    lineHeight: 26,
    minHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#007AFF',
  },
});
