export default {
  CachesDirectoryPath: '/tmp',
  unlink: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(false),
};
