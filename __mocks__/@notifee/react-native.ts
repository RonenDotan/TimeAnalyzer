const notifee = {
  createChannel: jest.fn().mockResolvedValue('checkin-reminders'),
  createTriggerNotification: jest.fn().mockResolvedValue(undefined),
  cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
  cancelTriggerNotifications: jest.fn().mockResolvedValue(undefined),
  requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
};

export default notifee;
export const AndroidImportance = { HIGH: 4 };
export const TriggerType = { TIMESTAMP: 0 };
export const RepeatFrequency = { HOURLY: 0 };
