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
import DailySummaryService from '../services/DailySummaryService';
import { DailySummary, DailySummaryResult } from '../types/DailySummary';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n/LanguageContext';

interface Props {
  onClose: () => void;
}

const SUMMARY_COLOR = '#F5A623';

function formatGeneratedAt(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DailySummariesScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, direction } = useTranslation();
  const styles = makeStyles(colors, direction);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setSummaries(await DailySummaryService.getAllSummaries());
    } catch (e: any) {
      Alert.alert(t('Load failed'), String(e?.message ?? e));
    }
  }

  function parse(summary: DailySummary): DailySummaryResult {
    return DailySummaryService.parseSummary(summary) ?? { debrief: t('Unable to parse saved summary.') };
  }

  function startEdit(summary: DailySummary) {
    setExpandedId(summary.id);
    setEditingId(summary.id);
    setDraft(parse(summary).debrief);
  }

  async function saveEdit(summary: DailySummary) {
    try {
      const saved = await DailySummaryService.saveSummaryText(summary.date, draft);
      setSummaries(prev => prev.map(item => item.id === summary.id ? saved : item));
      setEditingId(null);
      setDraft('');
    } catch (e: any) {
      Alert.alert(t('Save failed'), String(e?.message ?? e));
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft('');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.headerBtn}>{t('Close')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('Daily Summaries')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {summaries.length === 0 ? (
          <Text style={styles.emptyText}>{t('No saved daily summaries.')}</Text>
        ) : (
          summaries.map(summary => {
            const parsed = parse(summary);
            const expanded = expandedId === summary.id;
            const editing = editingId === summary.id;
            return (
              <View
                key={summary.id}
                style={styles.summaryCard}>
                <View style={styles.cardHeader}>
                  <TouchableOpacity
                    style={styles.cardTitleBlock}
                    onPress={() => !editing && setExpandedId(expanded ? null : summary.id)}>
                    <Text style={styles.dateText}>{summary.date}</Text>
                    <Text style={styles.generatedText}>{formatGeneratedAt(summary.generatedAt)}</Text>
                  </TouchableOpacity>
                  {!editing && (
                    <TouchableOpacity onPress={() => startEdit(summary)}>
                      <Text style={styles.editLink}>{t('Edit')}</Text>
                    </TouchableOpacity>
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
                      placeholder={t('Write a summary...')}
                      placeholderTextColor={colors.placeholder}
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity style={styles.saveBtn} onPress={() => saveEdit(summary)}>
                        <Text style={styles.saveBtnText}>{t('Save')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                        <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => setExpandedId(expanded ? null : summary.id)}>
                    <Text style={styles.debriefText} numberOfLines={expanded ? undefined : 3}>
                      {parsed.debrief}
                    </Text>
                  </TouchableOpacity>
                )}
                {expanded && parsed.keyInsights && parsed.keyInsights.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>{t('KEY INSIGHTS')}</Text>
                    {parsed.keyInsights.map((insight, i) => (
                      <Text key={i} style={styles.bulletText}>• {insight.text}</Text>
                    ))}
                  </>
                )}
                {expanded && !!parsed.momentum && (
                  <>
                    <Text style={styles.sectionLabel}>{t('MOMENTUM')}</Text>
                    <Text style={styles.bulletText}>{parsed.momentum}</Text>
                  </>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ColorPalette, direction: 'ltr' | 'rtl') {
  const isRTL = direction === 'rtl';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerBtn: { fontSize: 17, color: colors.textSecondary },
    title: { fontSize: 17, fontWeight: '700', color: colors.text },
    headerSpacer: { width: 48 },
    body: { padding: 16, gap: 12, paddingBottom: 40 },
    emptyText: { textAlign: 'center', color: colors.placeholder, fontSize: 15, marginTop: 36 },
    summaryCard: {
      backgroundColor: SUMMARY_COLOR + '10',
      borderLeftWidth: isRTL ? 0 : 4,
      borderRightWidth: isRTL ? 4 : 0,
      borderLeftColor: isRTL ? 'transparent' : SUMMARY_COLOR,
      borderRightColor: isRTL ? SUMMARY_COLOR : 'transparent',
      borderRadius: 8,
      padding: 12,
      gap: 8,
    },
    cardHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    cardTitleBlock: { flex: 1, gap: 2 },
    dateText: { fontSize: 15, color: colors.text, fontWeight: '700' },
    generatedText: { fontSize: 11, color: colors.textSecondary },
    editLink: { fontSize: 13, color: SUMMARY_COLOR, fontWeight: '700' },
    debriefText: { fontSize: 14, color: colors.text, lineHeight: 20 },
    editInput: {
      minHeight: 120,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: SUMMARY_COLOR + '70',
      padding: 10,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      textAlignVertical: 'top',
    },
    editActions: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' },
    saveBtn: {
      backgroundColor: SUMMARY_COLOR,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    saveBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    cancelBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    cancelBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: '700' },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: SUMMARY_COLOR,
      letterSpacing: 0.5,
      marginTop: 4,
    },
    bulletText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  });
}
