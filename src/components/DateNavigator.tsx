import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n/LanguageContext';

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
  const { direction } = useTranslation();
  const isRTL = direction === 'rtl';
  const styles = makeStyles(colors, direction);

  // In RTL, reading order is right→left so "previous" visually points right (›)
  const prevArrow = isRTL ? '›' : '‹';
  const nextArrow = isRTL ? '‹' : '›';

  return (
    <View style={styles.dayNav}>
      <TouchableOpacity onPress={onPrev} style={styles.navBtn} disabled={disablePrev} activeOpacity={0.75}>
        <Text style={[styles.navArrow, disablePrev && styles.navArrowDisabled]}>{prevArrow}</Text>
      </TouchableOpacity>
      <Text style={styles.dayLabel} numberOfLines={1}>{formatLabel(date)}</Text>
      <TouchableOpacity onPress={onNext} style={styles.navBtn} disabled={disableNext} activeOpacity={0.75}>
        <Text style={[styles.navArrow, disableNext && styles.navArrowDisabled]}>{nextArrow}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ColorPalette, direction: 'ltr' | 'rtl') {
  const isRTL = direction === 'rtl';
  return StyleSheet.create({
    dayNav: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
