const mockExecuteSync = jest.fn().mockReturnValue({ rows: [], insertId: 1 });
const mockDb = { executeSync: mockExecuteSync };

export const open = jest.fn(() => mockDb);
