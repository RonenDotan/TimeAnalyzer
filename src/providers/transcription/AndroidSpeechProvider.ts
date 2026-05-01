import { NativeEventEmitter, NativeModules } from 'react-native';
import type { TranscriptionProvider } from './TranscriptionProvider';

const { SpeechRecognition } = NativeModules;
const emitter = new NativeEventEmitter(SpeechRecognition);

let _onPartialResult: ((text: string) => void) | null = null;
let _latestText = '';
let _resolveStop: ((text: string) => void) | null = null;
let _rejectStop: ((err: Error) => void) | null = null;
let _autoStopped = false;
let _autoStopText = '';

const AndroidSpeechProvider: TranscriptionProvider = {
  async start(onPartialResult: (text: string) => void): Promise<void> {
    _onPartialResult = onPartialResult;
    _latestText = '';
    _autoStopped = false;
    _autoStopText = '';

    emitter.removeAllListeners('SpeechRecognition.onPartialResults');
    emitter.removeAllListeners('SpeechRecognition.onResults');
    emitter.removeAllListeners('SpeechRecognition.onError');

    emitter.addListener('SpeechRecognition.onPartialResults', (text: string) => {
      _latestText = text;
      _onPartialResult?.(text);
    });

    emitter.addListener('SpeechRecognition.onResults', (text: string) => {
      _latestText = text;
      if (_resolveStop) {
        _resolveStop(text);
        _resolveStop = null;
        _rejectStop = null;
      } else {
        _autoStopped = true;
        _autoStopText = text;
        _onPartialResult?.(text);
      }
    });

    emitter.addListener('SpeechRecognition.onError', (errorCode: string) => {
      if (_rejectStop) {
        _rejectStop(new Error(`Speech error code: ${errorCode}`));
        _resolveStop = null;
        _rejectStop = null;
      }
    });

    await SpeechRecognition.start('en-US');
  },

  async stop(): Promise<string> {
    emitter.removeAllListeners('SpeechRecognition.onPartialResults');
    emitter.removeAllListeners('SpeechRecognition.onResults');
    emitter.removeAllListeners('SpeechRecognition.onError');

    if (_autoStopped) {
      _autoStopped = false;
      return _autoStopText;
    }

    return new Promise<string>((resolve, reject) => {
      _resolveStop = resolve;
      _rejectStop = reject;
      SpeechRecognition.stop().catch(() => {
        _resolveStop = null;
        _rejectStop = null;
        resolve(_latestText);
      });
    });
  },
};

export default AndroidSpeechProvider;
