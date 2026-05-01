import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import v from './version.json';
import SchedulerService from './src/services/SchedulerService';
import SettingsScreen from './src/screens/SettingsScreen';
import CheckInScreen from './src/screens/CheckInScreen';

const version = `v${v.major}.${v.minor}.${v.ticket_id}.${v.sequence}`;

type Screen = 'home' | 'settings' | 'checkin';

function AppContent(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>('home');

  useEffect(() => {
    SchedulerService.requestPermission().then(granted => {
      if (granted) {
        SchedulerService.reschedule();
      }
    });
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
  version: {
    fontSize: 11,
    color: '#bbb',
    marginBottom: 8,
  },
});

export default App;
