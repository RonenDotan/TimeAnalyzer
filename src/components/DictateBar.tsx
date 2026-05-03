import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import TranscriptionService from '../services/TranscriptionService';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';

interface Props {
  onResult: (text: string) => void;
}

type Phase = 'idle' | 'recording' | 'transcribing';

export default function DictateBar({ onResult }: Props) {
  const { colors } = useTheme();
  const [phase, setPhase] = useState<Phase>('idle');
  const [partial, setPartial] = useState('');
  const partialRef = useRef('');

  async function requestMic(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'TimeAnalyzer needs the microphone to transcribe.',
        buttonPositive: 'Allow',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  async function handleStart() {
    const ok = await requestMic();
    if (!ok) {
      Alert.alert('Permission denied', 'Microphone access is required.');
      return;
    }
    partialRef.current = '';
    setPartial('');
    setPhase('recording');
    try {
      await TranscriptionService.start(p => {
        partialRef.current = p;
        setPartial(p);
      });
    } catch (e: any) {
      Alert.alert('Failed to start', String(e?.message ?? e));
      setPhase('idle');
    }
  }

  async function handleStop() {
    setPhase('transcribing');
    try {
      const result = await TranscriptionService.stop();
      onResult((result || partialRef.current).trim());
    } catch (e: any) {
      Alert.alert('Transcription failed', String(e?.message ?? e));
    } finally {
      setPartial('');
      partialRef.current = '';
      setPhase('idle');
    }
  }

  const styles = makeStyles(colors);

  if (phase === 'transcribing') {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.statusText}>Transcribing…</Text>
      </View>
    );
  }

  if (phase === 'recording') {
    return (
      <View style={styles.row}>
        <View style={styles.recDot} />
        {partial.length > 0 && (
          <Text style={styles.partial} numberOfLines={1}>{partial}</Text>
        )}
        <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
          <Text style={styles.stopBtnText}>Stop</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.dictateBtn} onPress={handleStart}>
      <Text style={styles.dictateBtnText}>🎤 Dictate</Text>
    </TouchableOpacity>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
    },
    recDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.recordBtn,
    },
    partial: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    stopBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      backgroundColor: colors.recordBtn,
      borderRadius: 8,
    },
    stopBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
    statusText: { fontSize: 13, color: colors.textSecondary, marginLeft: 6 },
    dictateBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 20,
    },
    dictateBtnText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  });
}
