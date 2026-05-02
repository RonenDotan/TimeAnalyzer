const mockExecuteSync = jest.fn().mockReturnValue({ rows: [] });
const mockDb = { executeSync: mockExecuteSync };

export const open = jest.fn(() => mockDb);
