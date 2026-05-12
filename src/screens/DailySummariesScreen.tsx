import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DailySummaryService from '../services/DailySummaryService';
import { DailySummary, DailySummaryResult } from '../types/DailySummary';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  onClose: () => void;
}

const SUMMARY_COLOR = '#0F766E';

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
  const styles = makeStyles(colors);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setSummaries(await DailySummaryService.getAllSummaries());
    } catch (e: any) {
      Alert.alert('Load failed', String(e?.message ?? e));
    }
  }

  function parse(summary: DailySummary): DailySummaryResult {
    return DailySummaryService.parseSummary(summary) ?? { debrief: 'Unable to parse saved summary.' };
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.headerBtn}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Daily Summaries</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {summaries.length === 0 ? (
          <Text style={styles.emptyText}>No saved daily summaries.</Text>
        ) : (
          summaries.map(summary => {
            const parsed = parse(summary);
            const expanded = expandedId === summary.id;
            return (
              <TouchableOpacity
                key={summary.id}
                style={styles.summaryCard}
                activeOpacity={0.85}
                onPress={() => setExpandedId(expanded ? null : summary.id)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.dateText}>{summary.date}</Text>
                  <Text style={styles.generatedText}>{formatGeneratedAt(summary.generatedAt)}</Text>
                </View>
                <Text style={styles.debriefText} numberOfLines={expanded ? undefined : 3}>
                  {parsed.debrief}
                </Text>
                {expanded && parsed.keyInsights && parsed.keyInsights.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>KEY INSIGHTS</Text>
                    {parsed.keyInsights.map((insight, i) => (
                      <Text key={i} style={styles.bulletText}>• {insight.text}</Text>
                    ))}
                  </>
                )}
                {expanded && !!parsed.momentum && (
                  <>
                    <Text style={styles.sectionLabel}>MOMENTUM</Text>
                    <Text style={styles.bulletText}>{parsed.momentum}</Text>
                  </>
                )}
              </TouchableOpacity>
            );
          })
        )}
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
    headerBtn: { fontSize: 17, color: colors.textSecondary },
    title: { fontSize: 17, fontWeight: '700', color: colors.text },
    headerSpacer: { width: 48 },
    body: { padding: 16, gap: 12, paddingBottom: 40 },
    emptyText: { textAlign: 'center', color: colors.placeholder, fontSize: 15, marginTop: 36 },
    summaryCard: {
      backgroundColor: SUMMARY_COLOR + '10',
      borderLeftWidth: 4,
      borderLeftColor: SUMMARY_COLOR,
      borderRadius: 8,
      padding: 12,
      gap: 8,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    dateText: { fontSize: 15, color: colors.text, fontWeight: '700' },
    generatedText: { fontSize: 11, color: colors.textSecondary },
    debriefText: { fontSize: 14, color: colors.text, lineHeight: 20 },
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
