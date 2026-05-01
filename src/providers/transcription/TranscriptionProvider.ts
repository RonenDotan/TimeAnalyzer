import { AudioFile } from '../../types/AudioFile';

export interface TranscriptionProvider {
  transcribe(audio: AudioFile): Promise<string>;
}
