export const GoogleSignin = {
  configure: jest.fn(),
  signIn: jest.fn().mockResolvedValue({}),
  signOut: jest.fn().mockResolvedValue(undefined),
  getTokens: jest.fn().mockRejectedValue(new Error('Not signed in')),
  getCurrentUser: jest.fn().mockReturnValue(null),
  isSignedIn: jest.fn().mockResolvedValue(false),
  hasPlayServices: jest.fn().mockResolvedValue(true),
};

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};

export const isErrorWithCode = jest.fn().mockReturnValue(false);
