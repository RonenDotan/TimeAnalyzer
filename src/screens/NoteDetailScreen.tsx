import React, { useEffect, useState } from 'react';
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
import DictateBar from '../components/DictateBar';
import SettingsService from '../services/SettingsService';
import StorageService from '../services/StorageService';
import { Note } from '../types/Note';
import { applyTranscription } from '../utils/parseTranscript';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  note: Note;
  onSave: (updated: Note) => void;
  onClose: () => void;
}

export default function NoteDetailScreen({ note, onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [text, setText] = useState(note.text);
  const [appendKeyword, setAppendKeyword] = useState('append');
  const dirty = text.trim() !== note.text;

  useEffect(() => {
    SettingsService.load().then(s => setAppendKeyword(s.appendKeyword));
  }, []);

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

  const styles = makeStyles(colors);

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
          placeholderTextColor={colors.placeholder}
        />
        <DictateBar onResult={raw => setText(prev => applyTranscription(prev, raw, appendKeyword))} />
      </ScrollView>
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
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
    headerId: { fontSize: 13, fontWeight: '400', color: colors.border },
    headerBtn: { fontSize: 17, color: colors.accent },
    saveBtn: { fontWeight: '600' },
    saveBtnDisabled: { color: colors.placeholder },
    body: { padding: 20, gap: 16 },
    meta: { fontSize: 12, color: colors.placeholder, fontWeight: '500' },
    textInput: {
      fontSize: 17,
      color: colors.text,
      lineHeight: 26,
      minHeight: 200,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1.5,
      borderColor: colors.accent,
    },
  });
}
