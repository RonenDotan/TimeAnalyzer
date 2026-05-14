import notifee, { EventType } from '@notifee/react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, StatusBar, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import v from './version.json';
import CalendarSyncService from './src/services/CalendarSyncService';
import DevSeedService from './src/services/DevSeedService';
import SchedulerService from './src/services/SchedulerService';
import SettingsService from './src/services/SettingsService';
import StorageService from './src/services/StorageService';
import DrawerMenu, { DrawerScreen } from './src/components/DrawerMenu';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { LanguageProvider } from './src/i18n/LanguageContext';
import AITestScreen from './src/screens/AITestScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import DailySummariesScreen from './src/screens/DailySummariesScreen';
import DailySummaryScreen from './src/screens/DailySummaryScreen';
import DayPlanScreen from './src/screens/DayPlanScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import PromptsScreen from './src/screens/PromptsScreen';
import ReportScreen from './src/screens/ReportScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { SyncIntervalMinutes, Theme } from './src/types/Settings';
import { DEFAULT_CALENDAR_COLOR } from './src/services/SettingsService';

export const version = `v${v.major}.${v.minor}.${v.ticket_id}.${v.sequence}`;

type Screen = 'entries' | 'checkin' | 'settings' | 'reports' | 'dayplan' | 'goals' | 'aitest' | 'prompts' | 'dailySummaries' | 'dailySummary';
type Period = { periodStart: number; periodEnd: number };

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function workStartForToday(now: number, startHour: number): number {
  return startOfLocalDay(now) + startHour * 60 * 60 * 1000;
}

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
  const [dailySummaryDate, setDailySummaryDate] = useState<Date | undefined>(undefined);
  const [focusedGoalId, setFocusedGoalId] = useState<number | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [themeSetting, setThemeSetting] = useState<Theme>('system');
  const [debugMode, setDebugMode] = useState(false);
  const [calendarColor, setCalendarColor] = useState(DEFAULT_CALENDAR_COLOR);
  const [seedingMockData, setSeedingMockData] = useState(false);
  const [entriesRefreshKey, setEntriesRefreshKey] = useState(0);
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
    SettingsService.getCalendarColor().then(setCalendarColor);
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
    SettingsService.getCalendarColor().then(setCalendarColor);
  }

  function handleCheckInDone() {
    setScreen('entries');
  }

  async function handleStartCheckIn() {
    const now = Date.now();
    const [entries, settings] = await Promise.all([
      StorageService.getAll(),
      SettingsService.load(),
    ]);
    const todayStart = startOfLocalDay(now);
    const defaultPeriodStart = Math.min(workStartForToday(now, settings.startHour), now);
    let periodStart = defaultPeriodStart;
    if (entries.length > 0) {
      const last = entries.reduce((a, b) => a.timestampEnd > b.timestampEnd ? a : b);
      periodStart = last.timestampEnd >= todayStart ? last.timestampEnd : defaultPeriodStart;
    }
    setCheckInPeriod({ periodStart, periodEnd: now });
    setScreen('checkin');
  }

  function handleEditPlan(date: Date) {
    setPlanDate(date);
    setScreen('dayplan');
  }

  function handleOpenDailySummary(date: Date) {
    setDailySummaryDate(date);
    setScreen('dailySummary');
  }

  function handleOpenGoal(goalId: number) {
    setFocusedGoalId(goalId);
    setScreen('goals');
  }

  function handleDrawerNavigate(dest: DrawerScreen) {
    if ((dest === 'prompts' || dest === 'aitest' || dest === 'dailySummaries') && !debugMode) return;
    if (dest === 'dayplan') {
      setPlanDate(undefined);
    }
    if (dest === 'goals') {
      setFocusedGoalId(undefined);
    }
    setScreen(dest);
    setDrawerOpen(false);
  }

  function handleSeedMockData() {
    if (!debugMode || seedingMockData) return;
    Alert.alert(
      'Seed Mock Data',
      'This clears existing entries, goals, plans, notes, and daily summaries, then inserts a software engineer demo day.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear and Seed',
          style: 'destructive',
          onPress: async () => {
            setSeedingMockData(true);
            try {
              const result = await DevSeedService.seedSoftwareEngineerDemo(debugMode);
              if (result.seeded) {
                setDrawerOpen(false);
                setScreen('entries');
                setEntriesRefreshKey(key => key + 1);
                Alert.alert('Seed complete', 'Mock software engineer data was added.');
              } else {
                Alert.alert('Seed skipped', result.reason ?? 'No data was added.');
              }
            } catch (e: any) {
              Alert.alert('Seed failed', e?.message ?? String(e));
            } finally {
              setSeedingMockData(false);
            }
          },
        },
      ],
    );
  }

  const drawerScreen: DrawerScreen =
    screen === 'settings' ? 'settings' :
    screen === 'reports'  ? 'reports'  :
    screen === 'dayplan'  ? 'dayplan'  :
    screen === 'goals'    ? 'goals'    :
    screen === 'prompts'  ? 'prompts'  :
    screen === 'dailySummaries' ? 'dailySummaries' :
    screen === 'aitest'   ? 'aitest'   : 'entries';

  return (
    <ThemeProvider isDark={isDark}>
      {screen === 'aitest' ? (
        <AITestScreen onClose={() => setScreen('entries')} />
      ) : screen === 'prompts' && debugMode ? (
        <PromptsScreen onClose={() => setScreen('entries')} />
      ) : screen === 'dailySummaries' && debugMode ? (
        <DailySummariesScreen onClose={() => setScreen('entries')} />
      ) : screen === 'dailySummary' ? (
        <DailySummaryScreen
          initialDate={dailySummaryDate ?? new Date()}
          onClose={() => setScreen('entries')}
        />
      ) : screen === 'settings' ? (
        <SettingsScreen onClose={handleSettingsClose} />
      ) : screen === 'dayplan' ? (
        <DayPlanScreen initialDate={planDate} onClose={() => setScreen('entries')} debugMode={debugMode} calendarColor={calendarColor} />
      ) : screen === 'goals' ? (
        <GoalsScreen initialGoalId={focusedGoalId} onClose={() => setScreen('entries')} />
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
              key={entriesRefreshKey}
              onStartCheckIn={handleStartCheckIn}
              onOpenMenu={() => setDrawerOpen(true)}
              onEditPlan={handleEditPlan}
              onOpenDailySummary={handleOpenDailySummary}
              onOpenGoal={handleOpenGoal}
              debugMode={debugMode}
              calendarColor={calendarColor}
            />
          )}
          <DrawerMenu
            visible={drawerOpen}
            currentScreen={drawerScreen}
            onClose={() => setDrawerOpen(false)}
            onNavigate={handleDrawerNavigate}
            onSeedMockData={handleSeedMockData}
            debugMode={debugMode}
            seedingMockData={seedingMockData}
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
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

export default App;
