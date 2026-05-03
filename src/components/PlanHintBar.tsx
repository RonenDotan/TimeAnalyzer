import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import StorageService from '../services/StorageService';
import { PlanBlock } from '../types/DayPlan';
import { overlapMin, toLocalMin } from '../utils/planMatching';
import { formatMin } from '../utils/parseDayPlan';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  periodStart: number;
  periodEnd: number;
}

export default function PlanHintBar({ periodStart, periodEnd }: Props) {
  const { colors } = useTheme();
  const [blocks, setBlocks] = useState<PlanBlock[]>([]);

  useEffect(() => {
    async function load() {
      const d = new Date(periodStart);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const plan = await StorageService.getDayPlan(date);
      if (!plan) return;
      const all = await StorageService.getPlanBlocks(plan.id);
      const periodStartMin = toLocalMin(periodStart);
      const periodEndMin = toLocalMin(periodEnd);
      setBlocks(all.filter(b => overlapMin(b.startMin, b.endMin, periodStartMin, periodEndMin) > 0));
    }
    load();
  }, [periodStart, periodEnd]);

  if (blocks.length === 0) return null;

  const styles = makeStyles(colors);
  return (
    <View style={styles.container}>
      <Text style={styles.header}>📋  Plan for this period</Text>
      {blocks.map(b => (
        <View key={b.id} style={styles.row}>
          <Text style={styles.time}>{formatMin(b.startMin)}–{formatMin(b.endMin)}</Text>
          <Text style={styles.activity}>{b.activity}</Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      width: '100%',
      gap: 6,
    },
    header: { fontSize: 13, fontWeight: '600', color: colors.accent, marginBottom: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    time: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, width: 100 },
    activity: { fontSize: 14, color: colors.text, flex: 1 },
  });
}
