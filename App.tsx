import notifee, { EventType } from '@notifee/react-native';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import v from './version.json';
import SchedulerService from './src/services/SchedulerService';
import StorageService from './src/services/StorageService';
import CheckInScreen from './src/screens/CheckInScreen';
import ReportScreen from './src/screens/ReportScreen';
import SettingsScreen from './src/screens/SettingsScreen';

export const version = `v${v.major}.${v.minor}.${v.ticket_id}.${v.sequence}`;

type Screen = 'entries' | 'checkin' | 'settings';
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

  useEffect(() => {
    SchedulerService.requestPermission().then(granted => {
      if (granted) SchedulerService.reschedule();
    });

    // Notification tap while app is open
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.PRESS) return;
      const id = detail.notification?.id ?? '';
      if (id === 'end-of-day-report') {
        setScreen('entries');
      } else if (id.startsWith('checkin-')) {
        const period = parsePeriodFromId(id);
        if (period) setCheckInPeriod(period);
        setScreen('checkin');
      }
    });

    // Notification tap when app was closed/backgrounded
    notifee.getInitialNotification().then(initial => {
      if (!initial) return;
      const id = initial.notification?.id ?? '';
      if (id.startsWith('checkin-')) {
        const period = parsePeriodFromId(id);
        if (period) setCheckInPeriod(period);
        setScreen('checkin');
      }
    });

    return () => unsub();
  }, []);

  function handleSettingsClose(saved: boolean) {
    setScreen('entries');
    if (saved) SchedulerService.reschedule();
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

  if (screen === 'settings') {
    return <SettingsScreen onClose={handleSettingsClose} />;
  }

  if (screen === 'checkin') {
    const period = checkInPeriod ?? {
      periodStart: Date.now() - 2 * 60 * 60 * 1000,
      periodEnd: Date.now(),
    };
    return (
      <CheckInScreen
        periodStart={period.periodStart}
        periodEnd={period.periodEnd}
        onDone={handleCheckInDone}
        onCancel={() => setScreen('entries')}
      />
    );
  }

  return (
    <ReportScreen
      onStartCheckIn={handleStartCheckIn}
      onOpenSettings={() => setScreen('settings')}
    />
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
