import { NativeModules } from 'react-native';
import WhisperTranscriptionProvider from '../src/providers/transcription/WhisperTranscriptionProvider';
import SettingsService from '../src/services/SettingsService';

jest.mock('../src/services/SettingsService', () => ({
  getGroqApiKey: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockAudioRecorder = NativeModules.AudioRecorder;

beforeEach(() => {
  jest.clearAllMocks();
});

test('start() triggers audio recording', async () => {
  await WhisperTranscriptionProvider.start(() => {});
  expect(mockAudioRecorder.startRecording).toHaveBeenCalledTimes(1);
});

test('stop() returns transcript from Groq on success', async () => {
  (SettingsService.getGroqApiKey as jest.Mock).mockResolvedValue('test-key');
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ text: 'I was debugging the auth module' }),
  });

  const result = await WhisperTranscriptionProvider.stop();

  expect(mockAudioRecorder.stopRecording).toHaveBeenCalledTimes(1);
  expect(result).toBe('I was debugging the auth module');
});

test('stop() sends correct request to Groq API', async () => {
  (SettingsService.getGroqApiKey as jest.Mock).mockResolvedValue('sk-test-key');
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ text: 'hello' }),
  });

  await WhisperTranscriptionProvider.stop();

  const [url, options] = mockFetch.mock.calls[0];
  expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
  expect(options.method).toBe('POST');
  expect(options.headers.Authorization).toBe('Bearer sk-test-key');

  const formData: FormData = options.body;
  expect(formData).toBeInstanceOf(FormData);
});

test('stop() throws when Groq API key is not set', async () => {
  (SettingsService.getGroqApiKey as jest.Mock).mockResolvedValue('');

  await expect(WhisperTranscriptionProvider.stop()).rejects.toThrow('Groq API key not set');
});

test('stop() throws on non-ok API response', async () => {
  (SettingsService.getGroqApiKey as jest.Mock).mockResolvedValue('test-key');
  mockFetch.mockResolvedValue({
    ok: false,
    status: 401,
    text: async () => 'Unauthorized',
  });

  await expect(WhisperTranscriptionProvider.stop()).rejects.toThrow('Groq API error 401');
});

test('stop() returns empty string when response has no text field', async () => {
  (SettingsService.getGroqApiKey as jest.Mock).mockResolvedValue('test-key');
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });

  const result = await WhisperTranscriptionProvider.stop();
  expect(result).toBe('');
});
