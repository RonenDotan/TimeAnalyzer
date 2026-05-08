import notifee, { EventType } from '@notifee/react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, StatusBar, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import v from './version.json';
import CalendarSyncService from './src/services/CalendarSyncService';
import SchedulerService from './src/services/SchedulerService';
import SettingsService from './src/services/SettingsService';
import StorageService from './src/services/StorageService';
import DrawerMenu, { DrawerScreen } from './src/components/DrawerMenu';
import { ThemeProvider } from './src/contexts/ThemeContext';
import CheckInScreen from './src/screens/CheckInScreen';
import DayPlanScreen from './src/screens/DayPlanScreen';
import ReportScreen from './src/screens/ReportScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { SyncIntervalMinutes, Theme } from './src/types/Settings';

export const version = `v${v.major}.${v.minor}.${v.ticket_id}.${v.sequence}`;

type Screen = 'entries' | 'checkin' | 'settings' | 'reports' | 'dayplan';
type Period = { periodStart: number; periodEnd: number };

// ID format: checkin-{periodStart}-{fireAt}
function parsePeriodFromId(id: string): Period | null {
  const match = id.match(/^checkin-(\d+)-(\d+)$/);
  if (!match) return null;
  return { periodStart: parseInt(match[1], 10), periodEnd: parseInt(match[2], 10) };
}

function AppContent(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('entries');
  const [checkInPeriod, setCheckInPeriod] = useState<Period | null>(null);
  const [planDate, setPlanDate] = useState<Date | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [themeSetting, setThemeSetting] = useState<Theme>('system');
  const [debugMode, setDebugMode] = useState(false);
  const systemScheme = useColorScheme();
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDark =
    themeSetting === 'dark' ? true :
    themeSetting === 'light' ? false :
    systemScheme === 'dark';

  function startSyncInterval(intervalMinutes: SyncIntervalMinutes) {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    syncIntervalRef.current = null;
    if (intervalMinutes > 0) {
      syncIntervalRef.current = setInterval(
        () => CalendarSyncService.syncChanged().catch(() => {}),
        intervalMinutes * 60 * 1000,
      );
    }
  }

  useEffect(() => {
    SettingsService.load().then(s => {
      setThemeSetting(s.theme);
      setDebugMode(s.debugMode);
      startSyncInterval(s.calendarSyncIntervalMinutes);
    });
    SchedulerService.requestPermission().then(async granted => {
      if (!granted) return;
      const alarmOk = await SchedulerService.checkAlarmPermission();
      if (!alarmOk) {
        Alert.alert(
          'Allow Exact Alarms',
          'TimeAnalyzer needs "Alarms & reminders" permission to fire check-in notifications at the right time.\n\nTap Open Settings, enable it for TimeAnalyzer, then come back.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Open Settings', onPress: () => SchedulerService.openAlarmSettings() },
          ],
        );
        return;
      }
      try {
        await SchedulerService.reschedule();
      } catch (e: any) {
        Alert.alert('Scheduler error', String(e?.message ?? e));
      }
    });

    // Run once on startup; interval is set up after settings load above
    CalendarSyncService.syncChanged().catch(() => {});
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') CalendarSyncService.syncChanged().catch(() => {});
    });

    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.PRESS) return;
      const id = detail.notification?.id ?? '';
      if (id === 'end-of-day-report') {
        setScreen('entries');
      } else if (id.startsWith('daily-plan-')) {
        setPlanDate(undefined);
        setScreen('dayplan');
      } else if (id.startsWith('checkin-')) {
        const period = parsePeriodFromId(id);
        if (period) setCheckInPeriod(period);
        setScreen('checkin');
      }
    });

    notifee.getInitialNotification().then(initial => {
      if (!initial) return;
      const id = initial.notification?.id ?? '';
      if (id.startsWith('daily-plan-')) {
        setPlanDate(undefined);
        setScreen('dayplan');
      } else if (id.startsWith('checkin-')) {
        const period = parsePeriodFromId(id);
        if (period) setCheckInPeriod(period);
        setScreen('checkin');
      }
    });

    return () => {
      unsub();
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      appStateSub.remove();
    };
  }, []);

  function handleSettingsClose(saved: boolean) {
    setScreen('entries');
    if (saved) {
      SchedulerService.reschedule();
      SettingsService.load().then(s => {
        setThemeSetting(s.theme);
        setDebugMode(s.debugMode);
        startSyncInterval(s.calendarSyncIntervalMinutes);
      });
    }
  }

  function handleCheckInDone() {
    setScreen('entries');
  }

  async function handleStartCheckIn() {
    const now = Date.now();
    const entries = await StorageService.getAll();
    let periodStart = now - 2 * 60 * 60 * 1000;
    if (entries.length > 0) {
      const last = entries.reduce((a, b) => a.timestampEnd > b.timestampEnd ? a : b);
      periodStart = last.timestampEnd;
    }
    setCheckInPeriod({ periodStart, periodEnd: now });
    setScreen('checkin');
  }

  function handleEditPlan(date: Date) {
    setPlanDate(date);
    setScreen('dayplan');
  }

  function handleDrawerNavigate(dest: DrawerScreen) {
    if (dest === 'dayplan') {
      setPlanDate(undefined);
    }
    setScreen(dest);
    setDrawerOpen(false);
  }

  const drawerScreen: DrawerScreen =
    screen === 'settings' ? 'settings' :
    screen === 'reports'  ? 'reports'  :
    screen === 'dayplan'  ? 'dayplan'  : 'entries';

  return (
    <ThemeProvider isDark={isDark}>
      {screen === 'settings' ? (
        <SettingsScreen onClose={handleSettingsClose} />
      ) : screen === 'dayplan' ? (
        <DayPlanScreen initialDate={planDate} onClose={() => setScreen('entries')} debugMode={debugMode} />
      ) : screen === 'checkin' ? (
        <CheckInScreen
          periodStart={checkInPeriod?.periodStart ?? Date.now() - 2 * 60 * 60 * 1000}
          periodEnd={checkInPeriod?.periodEnd ?? Date.now()}
          onDone={handleCheckInDone}
          onCancel={() => setScreen('entries')}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {screen === 'reports' ? (
            <ReportsScreen onOpenMenu={() => setDrawerOpen(true)} />
          ) : (
            <ReportScreen
              onStartCheckIn={handleStartCheckIn}
              onOpenMenu={() => setDrawerOpen(true)}
              onEditPlan={handleEditPlan}
              debugMode={debugMode}
            />
          )}
          <DrawerMenu
            visible={drawerOpen}
            currentScreen={drawerScreen}
            onClose={() => setDrawerOpen(false)}
            onNavigate={handleDrawerNavigate}
          />
        </View>
      )}
    </ThemeProvider>
  );
}

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppContent />
    </SafeAreaProvider>
  );
}

export default App;
