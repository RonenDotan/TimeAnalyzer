import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import v from './version.json';
import SchedulerService from './src/services/SchedulerService';
import SettingsScreen from './src/screens/SettingsScreen';

const version = `v${v.major}.${v.minor}.${v.ticket_id}.${v.sequence}`;

function AppContent(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    SchedulerService.requestPermission().then(granted => {
      if (granted) {
        SchedulerService.reschedule();
      }
    });
  }, []);

  function handleSettingsClose(saved: boolean) {
    setShowSettings(false);
    if (saved) {
      SchedulerService.reschedule();
    }
  }

  if (showSettings) {
    return <SettingsScreen onClose={handleSettingsClose} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.gearButton}>
          <Text style={styles.gear}>⚙️</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.center}>
        <Text style={styles.title}>TimeAnalyzer</Text>
        <Text style={styles.subtitle}>Hello World ✓</Text>
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
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  version: {
    fontSize: 11,
    color: '#bbb',
    marginBottom: 8,
  },
});

export default App;
