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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DailySummaryService from '../services/DailySummaryService';
import { DailySummaryResult } from '../types/DailySummary';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  initialDate: Date;
  onClose: () => void;
}

const SUMMARY_COLOR = '#F5A623';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatGeneratedAt(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isToday(date: Date): boolean {
  const today = new Date();
  return startOfDay(date).getTime() === startOfDay(today).getTime();
}

export default function DailySummaryScreen({ initialDate, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [currentDate, setCurrentDate] = useState(startOfDay(initialDate));
  const [summary, setSummary] = useState<DailySummaryResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    load(currentDate);
  }, [currentDate]);

  async function load(date: Date) {
    setLoading(true);
    try {
      const saved = await DailySummaryService.getSummary(date);
      const parsed = DailySummaryService.parseSummary(saved);
      setSummary(parsed);
      setGeneratedAt(saved?.generatedAt ?? null);
      setDraft(parsed?.debrief ?? '');
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Load failed', String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  function goToPrevDay() {
    setCurrentDate(d => new Date(d.getTime() - 86_400_000));
  }

  function goToNextDay() {
    setCurrentDate(d => new Date(d.getTime() + 86_400_000));
  }

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    try {
      const saved = await DailySummaryService.generateSummary(currentDate);
      const parsed = DailySummaryService.parseSummary(saved);
      setSummary(parsed);
      setGeneratedAt(saved.generatedAt);
      setDraft(parsed?.debrief ?? '');
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Summary failed', String(e?.message ?? e));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    try {
      const saved = await DailySummaryService.saveSummaryText(currentDate, draft);
      const parsed = DailySummaryService.parseSummary(saved);
      setSummary(parsed);
      setGeneratedAt(saved.generatedAt);
      setDraft(parsed?.debrief ?? '');
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Save failed', String(e?.message ?? e));
    }
  }

  function handleCancelEdit() {
    setDraft(summary?.debrief ?? '');
    setEditing(false);
  }

  const canGoForward = !isToday(currentDate);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.headerBtn}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Daily Summary</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.dayNav}>
        <TouchableOpacity onPress={goToPrevDay} style={styles.navBtn}>
          <Text style={styles.navArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.dayLabel}>{formatDayHeader(currentDate)}</Text>
        <TouchableOpacity onPress={goToNextDay} style={styles.navBtn} disabled={!canGoForward}>
          <Text style={[styles.navArrow, !canGoForward && styles.navArrowDisabled]}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centeredFull}>
          <ActivityIndicator size="large" color={SUMMARY_COLOR} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryLabel}>SUMMARY</Text>
              {generatedAt !== null && (
                <Text style={styles.generatedText}>Updated {formatGeneratedAt(generatedAt)}</Text>
              )}
            </View>

            {editing ? (
              <>
                <TextInput
                  style={styles.editInput}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  textAlignVertical="top"
                  placeholder="Write a summary..."
                  placeholderTextColor={colors.placeholder}
                  autoFocus
                />
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleSave}>
                    <Text style={styles.primaryBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleCancelEdit}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.debriefText, !summary && styles.placeholderText]}>
                  {summary?.debrief || 'No summary yet'}
                </Text>
                {summary?.keyInsights && summary.keyInsights.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>KEY INSIGHTS</Text>
                    {summary.keyInsights.map((insight, i) => (
                      <Text key={i} style={styles.bulletText}>- {insight.text}</Text>
                    ))}
                  </View>
                )}
                {!!summary?.momentum && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>MOMENTUM</Text>
                    <Text style={styles.bulletText}>{summary.momentum}</Text>
                  </View>
                )}
                {summary?.gaps && summary.gaps.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>GAPS</Text>
                    {summary.gaps.map((gap, i) => (
                      <Text key={i} style={styles.bulletText}>- {gap}</Text>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {!editing && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setEditing(true)}>
                <Text style={styles.primaryBtnText}>{summary ? 'Edit' : 'Write summary'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.aiBtn, generating && styles.disabledBtn]}
                onPress={handleGenerate}
                disabled={generating}>
                <Text style={styles.primaryBtnText}>
                  {generating ? 'Generating...' : 'Generate with AI'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
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
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerBtn: { fontSize: 15, color: colors.textSecondary },
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    headerSpacer: { width: 44 },
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
    navArrow: { fontSize: 22, color: SUMMARY_COLOR, fontWeight: '500' },
    navArrowDisabled: { color: colors.border },
    dayLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    centeredFull: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    body: { padding: 16, gap: 12, paddingBottom: 40 },
    summaryCard: {
      backgroundColor: SUMMARY_COLOR + '12',
      borderRadius: 8,
      padding: 14,
      gap: 12,
      borderLeftWidth: 4,
      borderLeftColor: SUMMARY_COLOR,
    },
    summaryHeader: { gap: 3 },
    summaryLabel: { fontSize: 11, fontWeight: '700', color: SUMMARY_COLOR, letterSpacing: 0.5 },
    generatedText: { fontSize: 11, color: colors.textSecondary },
    debriefText: { fontSize: 15, color: colors.text, lineHeight: 22 },
    placeholderText: { color: colors.placeholder, fontStyle: 'italic' },
    editInput: {
      minHeight: 180,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: SUMMARY_COLOR + '70',
      padding: 10,
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
      textAlignVertical: 'top',
    },
    section: { gap: 4 },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: SUMMARY_COLOR, letterSpacing: 0.5 },
    bulletText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    primaryBtn: {
      backgroundColor: SUMMARY_COLOR,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    aiBtn: {
      backgroundColor: SUMMARY_COLOR,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    disabledBtn: { opacity: 0.65 },
    primaryBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    secondaryBtn: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    secondaryBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: '700' },
  });
}
