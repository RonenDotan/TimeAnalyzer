const reactNative = jest.requireActual('react-native');

reactNative.NativeModules.AudioRecorder = {
  startRecording: jest.fn().mockResolvedValue(undefined),
  stopRecording: jest.fn().mockResolvedValue('file://test.m4a'),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

module.exports = reactNative;
