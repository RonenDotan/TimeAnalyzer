export interface TranscriptionProvider {
  start(onPartialResult: (text: string) => void): Promise<void>;
  stop(): Promise<string>;
}
