import notifee, { EventType } from '@notifee/react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import v from './version.json';
import SchedulerService from './src/services/SchedulerService';
import CheckInScreen from './src/screens/CheckInScreen';
import ReportScreen from './src/screens/ReportScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const version = `v${v.major}.${v.minor}.${v.ticket_id}.${v.sequence}`;

type Screen = 'home' | 'settings' | 'checkin' | 'report';

function AppContent(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>('home');

  useEffect(() => {
    SchedulerService.requestPermission().then(granted => {
      if (granted) {
        SchedulerService.reschedule();
      }
    });

    // Handle notification tap while app is open
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS && detail.notification?.id === 'end-of-day-report') {
        setScreen('report');
      }
    });

    // Handle notification tap when app was closed/backgrounded
    notifee.getInitialNotification().then(initial => {
      if (initial?.notification?.id === 'end-of-day-report') {
        setScreen('report');
      }
    });

    return () => unsub();
  }, []);

  function handleSettingsClose(saved: boolean) {
    setScreen('home');
    if (saved) {
      SchedulerService.reschedule();
    }
  }

  function handleCheckInDone(transcript: string) {
    console.log('Check-in confirmed:', transcript);
    setScreen('home');
  }

  if (screen === 'settings') {
    return <SettingsScreen onClose={handleSettingsClose} />;
  }

  if (screen === 'report') {
    return <ReportScreen onClose={() => setScreen('home')} />;
  }

  if (screen === 'checkin') {
    const now = Date.now();
    return (
      <CheckInScreen
        periodStart={now - 2 * 60 * 60 * 1000}
        periodEnd={now}
        onDone={handleCheckInDone}
        onCancel={() => setScreen('home')}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setScreen('settings')} style={styles.gearButton}>
          <Text style={styles.gear}>⚙️</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.center}>
        <Text style={styles.title}>TimeAnalyzer</Text>
        <TouchableOpacity style={styles.checkInBtn} onPress={() => setScreen('checkin')}>
          <Text style={styles.checkInBtnText}>Start Check-in</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reportBtn} onPress={() => setScreen('report')}>
          <Text style={styles.reportBtnText}>View Report</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.version}>{version}</Text>
    </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  topBar: {
    width: '100%',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  gearButton: { padding: 8 },
  gear: { fontSize: 22 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  checkInBtn: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#007AFF',
    borderRadius: 12,
  },
  checkInBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  reportBtn: {
    marginTop: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#007AFF',
  },
  reportBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  version: {
    fontSize: 11,
    color: '#bbb',
    marginBottom: 8,
  },
});

export default App;
