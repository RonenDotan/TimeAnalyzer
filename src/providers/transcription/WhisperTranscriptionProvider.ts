import { NativeModules } from 'react-native';
import type { TranscriptionProvider } from './TranscriptionProvider';
import SettingsService from '../../services/SettingsService';

const { AudioRecorder } = NativeModules;

const WhisperTranscriptionProvider: TranscriptionProvider = {
  async start(_onPartialResult: (text: string) => void): Promise<void> {
    await AudioRecorder.startRecording();
  },

  async stop(): Promise<string> {
    const audioUri: string = await AudioRecorder.stopRecording();

    const apiKey = await SettingsService.getGroqApiKey();
    if (!apiKey) throw new Error('Groq API key not set. Add it in Settings.');

    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'checkin.m4a',
    } as any);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'en');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error ${response.status}: ${err}`);
    }

    const json = await response.json();
    return json.text ?? '';
  },
};

export default WhisperTranscriptionProvider;
