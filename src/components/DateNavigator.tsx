import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  date: Date;
  onPrev: () => void;
  onNext: () => void;
  formatLabel?: (date: Date) => string;
  disablePrev?: boolean;
  disableNext?: boolean;
}

function defaultFormatLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function DateNavigator({
  date,
  onPrev,
  onNext,
  formatLabel = defaultFormatLabel,
  disablePrev = false,
  disableNext = false,
}: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.dayNav}>
      <TouchableOpacity onPress={onPrev} style={styles.navBtn} disabled={disablePrev} activeOpacity={0.75}>
        <Text style={[styles.navArrow, disablePrev && styles.navArrowDisabled]}>{'‹'}</Text>
      </TouchableOpacity>
      <Text style={styles.dayLabel} numberOfLines={1}>{formatLabel(date)}</Text>
      <TouchableOpacity onPress={onNext} style={styles.navBtn} disabled={disableNext} activeOpacity={0.75}>
        <Text style={[styles.navArrow, disableNext && styles.navArrowDisabled]}>{'›'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
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
    navBtn: {
      minWidth: 40,
      minHeight: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navArrow: {
      fontSize: 24,
      color: colors.accent,
      fontWeight: '300',
      lineHeight: 26,
    },
    navArrowDisabled: {
      color: colors.border,
    },
    dayLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
  });
}
