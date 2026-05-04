import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PieSlice } from '../utils/reportData';
import { ColorPalette } from '../contexts/ThemeContext';

interface Props {
  slices: PieSlice[];
  colors: ColorPalette;
}

export default function PieChart({ slices, colors }: Props) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.container}>
      {/* Segmented bar */}
      <View style={styles.bar}>
        {slices.map((slice, i) => (
          <View
            key={i}
            style={[
              styles.barSegment,
              { flex: slice.percentage, backgroundColor: slice.color },
              i === 0 && styles.barSegmentFirst,
              i === slices.length - 1 && styles.barSegmentLast,
            ]}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {slices.map((slice, i) => (
          <View key={i} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: slice.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>{slice.label}</Text>
            <Text style={styles.legendPct}>{slice.percentage}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { gap: 14 },
    bar: {
      flexDirection: 'row',
      height: 28,
      borderRadius: 14,
      overflow: 'hidden',
      gap: 1,
    },
    barSegment: { height: '100%' },
    barSegmentFirst: { borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
    barSegmentLast: { borderTopRightRadius: 14, borderBottomRightRadius: 14 },
    legend: { gap: 8 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
    legendLabel: { flex: 1, fontSize: 13, color: colors.text },
    legendPct: { fontSize: 13, fontWeight: '700', color: colors.text, width: 36, textAlign: 'right' },
  });
}
