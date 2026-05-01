import AndroidSpeechProvider from '../providers/transcription/AndroidSpeechProvider';
import { TranscriptionProvider } from '../providers/transcription/TranscriptionProvider';

let activeProvider: TranscriptionProvider = AndroidSpeechProvider;

function setProvider(provider: TranscriptionProvider): void {
  activeProvider = provider;
}

async function start(onPartialResult: (text: string) => void): Promise<void> {
  return activeProvider.start(onPartialResult);
}

async function stop(): Promise<string> {
  return activeProvider.stop();
}

const TranscriptionService = { start, stop, setProvider };
export default TranscriptionService;
