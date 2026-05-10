import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

export type DrawerScreen = 'entries' | 'reports' | 'settings' | 'dayplan' | 'goals' | 'aitest';

interface NavItem {
  key: DrawerScreen;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'goals',   label: 'Goals',    icon: '\u{1F3AF}' },
  { key: 'entries', label: 'Entries',  icon: '\u{1F4CB}' },
  { key: 'dayplan', label: 'Plans',    icon: '\u{1F4C5}' },
  { key: 'reports', label: 'Reports',  icon: '\u{1F4CA}' },
];

const BOTTOM_ITEMS: NavItem[] = [
  { key: 'aitest',   label: 'AI Test',  icon: '\u{1F9EA}' },
  { key: 'settings', label: 'Settings', icon: '\u{2699}\u{FE0F}' },
];

const DRAWER_WIDTH = 280;

interface Props {
  visible: boolean;
  currentScreen: DrawerScreen;
  onClose: () => void;
  onNavigate: (screen: DrawerScreen) => void;
}

export default function DrawerMenu({ visible, currentScreen, onClose, onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 180, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const styles = makeStyles(colors);

  function handleNavigate(screen: DrawerScreen) {
    onNavigate(screen);
    onClose();
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} />
      </TouchableWithoutFeedback>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
          { transform: [{ translateX: slideAnim }] },
        ]}>
        {/* Header */}
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>TimeAnalyzer</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Main nav */}
        <View style={styles.navSection}>
          {NAV_ITEMS.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, currentScreen === item.key && styles.navItemActive]}
              onPress={() => handleNavigate(item.key)}>
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={[styles.navLabel, currentScreen === item.key && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom nav */}
        <View style={styles.bottomSection}>
          <View style={styles.divider} />
          {BOTTOM_ITEMS.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, currentScreen === item.key && styles.navItemActive]}
              onPress={() => handleNavigate(item.key)}>
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={[styles.navLabel, currentScreen === item.key && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.overlay,
    },
    drawer: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: DRAWER_WIDTH,
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 16,
    },
    drawerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    drawerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    closeBtn: { padding: 4 },
    closeBtnText: { fontSize: 16, color: colors.textSecondary },
    navSection: { flex: 1, paddingTop: 8 },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      gap: 14,
      borderRadius: 10,
      marginHorizontal: 8,
      marginVertical: 2,
    },
    navItemActive: { backgroundColor: colors.surfaceSecondary },
    navIcon: { fontSize: 20 },
    navLabel: { fontSize: 16, color: colors.textSecondary },
    navLabelActive: { color: colors.accent, fontWeight: '600' },
    bottomSection: { paddingBottom: 8 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginHorizontal: 20,
      marginBottom: 8,
    },
  });
}
