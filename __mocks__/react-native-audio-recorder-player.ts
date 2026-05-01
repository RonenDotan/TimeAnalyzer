const AudioRecorderPlayer = {
  startRecorder: jest.fn().mockResolvedValue('/tmp/test.mp4'),
  stopRecorder: jest.fn().mockResolvedValue('/tmp/test.mp4'),
  pauseRecorder: jest.fn().mockResolvedValue(''),
  resumeRecorder: jest.fn().mockResolvedValue(''),
  addRecordBackListener: jest.fn(),
  removeRecordBackListener: jest.fn(),
  startPlayer: jest.fn().mockResolvedValue(''),
  stopPlayer: jest.fn().mockResolvedValue(''),
  pausePlayer: jest.fn().mockResolvedValue(''),
  resumePlayer: jest.fn().mockResolvedValue(''),
  seekToPlayer: jest.fn().mockResolvedValue(''),
  setVolume: jest.fn().mockResolvedValue(''),
  setSubscriptionDuration: jest.fn(),
  addPlayBackListener: jest.fn(),
  removePlayBackListener: jest.fn(),
};

export default AudioRecorderPlayer;
export type RecordBackType = { isRecording?: boolean; currentPosition: number; currentMetering?: number };
export type PlayBackType = { currentPosition: number; duration: number; isMuted?: boolean };
