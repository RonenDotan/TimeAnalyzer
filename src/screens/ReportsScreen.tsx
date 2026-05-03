import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  onOpenMenu: () => void;
}

export default function ReportsScreen({ onOpenMenu }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onOpenMenu} style={styles.menuBtn}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reports</Text>
        <View style={styles.menuBtn} />
      </View>
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>Reports coming soon</Text>
      </View>
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
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    menuBtn: { padding: 4, width: 36 },
    menuIcon: { fontSize: 22, color: colors.accent },
    title: { fontSize: 17, fontWeight: '600', color: colors.text },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyIcon: { fontSize: 48 },
    emptyText: { fontSize: 16, color: colors.textSecondary },
  });
}
