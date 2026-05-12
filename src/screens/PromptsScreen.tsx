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
import PromptsService from '../services/PromptsService';
import {
  Prompt,
  PROMPT_ACTION_DAILY_SUMMARY,
  PROMPT_ACTION_GOAL_CONTRIBUTION,
  PROMPT_ACTIONS,
  getPromptActionLabel,
} from '../types/Prompt';
import {
  DEFAULT_DAILY_SUMMARY_PROMPT_BODY,
  DEFAULT_GOAL_CONTRIBUTION_PROMPT_BODY,
} from '../utils/promptTemplates';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  onClose: () => void;
}

interface EditState {
  id: number | 'new';
  actionId: number;
  name: string;
  body: string;
}

const PROMPT_COLOR = '#0F766E';

function defaultBodyForAction(actionId: number): string {
  if (actionId === PROMPT_ACTION_GOAL_CONTRIBUTION) {
    return DEFAULT_GOAL_CONTRIBUTION_PROMPT_BODY;
  }
  if (actionId === PROMPT_ACTION_DAILY_SUMMARY) {
    return DEFAULT_DAILY_SUMMARY_PROMPT_BODY;
  }
  return '';
}

export default function PromptsScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedActionId, setSelectedActionId] = useState(PROMPT_ACTIONS[0].id);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setPrompts(await PromptsService.getAllPrompts());
    } catch (e: any) {
      Alert.alert('Load failed', String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  function startEdit(prompt: Prompt) {
    setEditing({
      id: prompt.id,
      actionId: prompt.actionId,
      name: prompt.name,
      body: prompt.body,
    });
  }

  function startAdd(actionId: number) {
    setEditing({
      id: 'new',
      actionId,
      name: `New ${getPromptActionLabel(actionId)} prompt`,
      body: defaultBodyForAction(actionId),
    });
  }

  async function saveEditing() {
    if (!editing) return;
    const name = editing.name.trim();
    const body = editing.body.trim();
    if (!name || !body) {
      Alert.alert('Missing prompt', 'Name and body are required.');
      return;
    }

    try {
      if (editing.id === 'new') {
        await PromptsService.savePrompt({
          actionId: editing.actionId,
          name,
          body,
          isDefault: prompts.filter(p => p.actionId === editing.actionId).length === 0,
        });
      } else {
        const existing = prompts.find(p => p.id === editing.id);
        if (!existing) return;
        await PromptsService.updatePrompt({ ...existing, name, body });
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      Alert.alert('Save failed', String(e?.message ?? e));
    }
  }

  async function setDefault(prompt: Prompt) {
    try {
      await PromptsService.setDefaultPrompt(prompt.actionId, prompt.id);
      await load();
    } catch (e: any) {
      Alert.alert('Default failed', String(e?.message ?? e));
    }
  }

  const selectedAction = PROMPT_ACTIONS.find(action => action.id === selectedActionId) ?? PROMPT_ACTIONS[0];
  const selectedPrompts = prompts.filter(prompt => prompt.actionId === selectedAction.id);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.headerBtn}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Prompts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.hintCard}>
          <Text style={styles.hintTitle}>Template variables</Text>
          <Text style={styles.hintText}>
            {'{{goals_json}}'} inserts active goals. {'{{transcript}}'} inserts the entry transcript. {'{{date}}'} and {'{{entries_json}}'} are for daily summaries.
          </Text>
        </View>

        <View style={styles.tabRow}>
          {PROMPT_ACTIONS.map(action => (
            <TouchableOpacity
              key={action.id}
              style={[styles.tab, selectedActionId === action.id && styles.tabActive]}
              onPress={() => {
                setSelectedActionId(action.id);
                if (editing?.id === 'new') setEditing(null);
              }}>
              <Text style={[styles.tabText, selectedActionId === action.id && styles.tabTextActive]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionSection}>
          <View style={styles.actionHeader}>
            <View style={styles.actionTitleBlock}>
              <Text style={styles.actionLabel}>{selectedAction.label}</Text>
              <Text style={styles.actionSub}>Action ID {selectedAction.id} · {selectedAction.description}</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => startAdd(selectedAction.id)}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {selectedPrompts.map(prompt => {
            const isEditing = editing?.id === prompt.id;
            return (
              <View key={prompt.id} style={[styles.promptCard, prompt.isDefault && styles.promptCardDefault]}>
                {isEditing ? (
                  <>
                    <TextInput
                      style={styles.nameInput}
                      value={editing.name}
                      onChangeText={name => setEditing(prev => prev ? { ...prev, name } : prev)}
                      placeholder="Prompt name"
                      placeholderTextColor={colors.placeholder}
                    />
                    <TextInput
                      style={styles.bodyInput}
                      value={editing.body}
                      onChangeText={body => setEditing(prev => prev ? { ...prev, body } : prev)}
                      multiline
                      textAlignVertical="top"
                      placeholder="Prompt body"
                      placeholderTextColor={colors.placeholder}
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity style={styles.saveBtn} onPress={saveEditing}>
                        <Text style={styles.saveBtnText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={styles.promptMain} onPress={() => startEdit(prompt)}>
                      <View style={styles.promptTopRow}>
                        <Text style={styles.promptName}>{prompt.name}</Text>
                        {prompt.isDefault && <Text style={styles.defaultBadge}>Default</Text>}
                      </View>
                      <Text style={styles.promptPreview} numberOfLines={3}>{prompt.body}</Text>
                    </TouchableOpacity>
                    <View style={styles.promptActions}>
                      <TouchableOpacity style={styles.secondaryBtn} onPress={() => startEdit(prompt)}>
                        <Text style={styles.secondaryBtnText}>Edit</Text>
                      </TouchableOpacity>
                      {!prompt.isDefault && (
                        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setDefault(prompt)}>
                          <Text style={styles.secondaryBtnText}>Set default</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}
              </View>
            );
          })}

          {selectedPrompts.length === 0 && !loading && (
            <Text style={styles.emptyText}>No prompts yet.</Text>
          )}
        </View>

        {editing?.id === 'new' && (
          <View style={[styles.promptCard, styles.newPromptCard]}>
            <Text style={styles.newPromptLabel}>NEW PROMPT · {getPromptActionLabel(editing.actionId)}</Text>
            <TextInput
              style={styles.nameInput}
              value={editing.name}
              onChangeText={name => setEditing(prev => prev ? { ...prev, name } : prev)}
              placeholder="Prompt name"
              placeholderTextColor={colors.placeholder}
            />
            <TextInput
              style={styles.bodyInput}
              value={editing.body}
              onChangeText={body => setEditing(prev => prev ? { ...prev, body } : prev)}
              multiline
              textAlignVertical="top"
              placeholder="Prompt body"
              placeholderTextColor={colors.placeholder}
            />
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={saveEditing}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    headerBtn: { fontSize: 17, color: colors.textSecondary },
    title: { fontSize: 17, fontWeight: '600', color: colors.text },
    headerSpacer: { width: 48 },
    body: { padding: 16, gap: 14, paddingBottom: 40 },
    hintCard: {
      backgroundColor: PROMPT_COLOR + '10',
      borderLeftWidth: 4,
      borderLeftColor: PROMPT_COLOR,
      borderRadius: 8,
      padding: 12,
      gap: 4,
    },
    hintTitle: { fontSize: 12, fontWeight: '700', color: PROMPT_COLOR },
    hintText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    tabRow: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tab: {
      flex: 1,
      minHeight: 36,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    tabActive: { backgroundColor: PROMPT_COLOR },
    tabText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', textAlign: 'center' },
    tabTextActive: { color: '#fff' },
    actionSection: { gap: 10 },
    actionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    actionTitleBlock: { flex: 1, gap: 2 },
    actionLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
    actionSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
    addBtn: {
      backgroundColor: PROMPT_COLOR,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
    },
    addBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
    promptCard: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    promptCardDefault: {
      borderColor: PROMPT_COLOR + '80',
      backgroundColor: PROMPT_COLOR + '0a',
    },
    newPromptCard: {
      borderStyle: 'dashed',
      borderColor: PROMPT_COLOR + '80',
    },
    newPromptLabel: { fontSize: 11, fontWeight: '700', color: PROMPT_COLOR, letterSpacing: 0.5 },
    promptMain: { gap: 8 },
    promptTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    promptName: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '700' },
    defaultBadge: {
      fontSize: 11,
      color: PROMPT_COLOR,
      fontWeight: '700',
      backgroundColor: PROMPT_COLOR + '18',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    promptPreview: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
    promptActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    secondaryBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    nameInput: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '700',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 6,
    },
    bodyInput: {
      minHeight: 220,
      fontSize: 13,
      color: colors.text,
      lineHeight: 19,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 8,
      padding: 10,
    },
    editActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    saveBtn: {
      backgroundColor: PROMPT_COLOR,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    saveBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    cancelBtn: { paddingHorizontal: 8, paddingVertical: 7 },
    cancelBtnText: { fontSize: 14, color: colors.textSecondary },
    emptyText: { color: colors.placeholder, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  });
}
