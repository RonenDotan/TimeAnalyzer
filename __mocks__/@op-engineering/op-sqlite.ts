const mockExecute = jest.fn().mockReturnValue({ rows: { _array: [] } });
const mockDb = { execute: mockExecute };

export const open = jest.fn(() => mockDb);
