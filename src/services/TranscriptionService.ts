import { AudioFile } from '../types/AudioFile';
import { TranscriptionProvider } from '../providers/transcription/TranscriptionProvider';

// Stub provider — returns a placeholder until Whisper integration (ticket #4)
const stubProvider: TranscriptionProvider = {
  async transcribe(_audio: AudioFile): Promise<string> {
    await new Promise<void>(resolve => { setTimeout(resolve, 1000); });
    return 'This is a placeholder transcript. Real transcription coming in ticket #4.';
  },
};

let activeProvider: TranscriptionProvider = stubProvider;

function setProvider(provider: TranscriptionProvider): void {
  activeProvider = provider;
}

async function transcribe(audio: AudioFile): Promise<string> {
  return activeProvider.transcribe(audio);
}

const TranscriptionService = { transcribe, setProvider };
export default TranscriptionService;
