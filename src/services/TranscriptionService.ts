import WhisperTranscriptionProvider from '../providers/transcription/WhisperTranscriptionProvider';
import { TranscriptionProvider } from '../providers/transcription/TranscriptionProvider';

let activeProvider: TranscriptionProvider = WhisperTranscriptionProvider;

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
