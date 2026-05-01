const reactNative = jest.requireActual('react-native');

reactNative.NativeModules.SpeechRecognition = {
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

module.exports = reactNative;
