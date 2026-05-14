import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n/LanguageContext';

type LeftIcon = 'hamburger' | 'close' | 'back' | undefined;

interface Props {
  title: string;
  onLeft: () => void;
  leftLabel?: string;
  leftIcon?: LeftIcon;
  onRight?: () => void;
  rightLabel?: string;
  rightColor?: string;
}

function renderLeftContent(leftIcon: LeftIcon, leftLabel: string) {
  if (leftIcon === 'hamburger') return '☰';
  if (leftIcon === 'close') return '×';
  if (leftIcon === 'back') return '‹';
  return leftLabel;
}

export default function ScreenHeader({
  title,
  onLeft,
  leftLabel = 'Close',
  leftIcon,
  onRight,
  rightLabel,
  rightColor,
}: Props) {
  const { colors } = useTheme();
  const { t, direction } = useTranslation();
  const styles = makeStyles(colors, direction);
  const leftIsIcon = leftIcon !== undefined;

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onLeft} style={styles.side} activeOpacity={0.75}>
        <Text style={[styles.sideText, leftIsIcon && styles.iconText]}>
          {leftIsIcon ? renderLeftContent(leftIcon, leftLabel) : t(leftLabel)}
        </Text>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{t(title)}</Text>
      {onRight && rightLabel ? (
        <TouchableOpacity onPress={onRight} style={styles.side} activeOpacity={0.75}>
          <Text style={[styles.sideText, styles.rightText, rightColor ? { color: rightColor } : null]}>
            {t(rightLabel)}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.side} />
      )}
    </View>
  );
}

function makeStyles(colors: ColorPalette, direction: 'ltr' | 'rtl') {
  const isRTL = direction === 'rtl';
  return StyleSheet.create({
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    side: {
      minWidth: 56,
      minHeight: 32,
      justifyContent: 'center',
    },
    sideText: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: '500',
      textAlign: isRTL ? 'right' : 'left',
    },
    iconText: {
      fontSize: 22,
      lineHeight: 24,
      color: colors.accent,
      fontWeight: '400',
    },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    rightText: {
      color: colors.accent,
      fontWeight: '700',
      textAlign: isRTL ? 'left' : 'right',
    },
  });
}
