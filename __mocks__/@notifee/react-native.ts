const notifee = {
  createChannel: jest.fn().mockResolvedValue('checkin-reminders'),
  createTriggerNotification: jest.fn().mockResolvedValue(undefined),
  cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
  cancelTriggerNotifications: jest.fn().mockResolvedValue(undefined),
  requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
  getTriggerNotifications: jest.fn().mockResolvedValue([]),
  displayNotification: jest.fn().mockResolvedValue(undefined),
  onForegroundEvent: jest.fn().mockReturnValue(() => {}),
  getInitialNotification: jest.fn().mockResolvedValue(null),
};

export default notifee;
export const AndroidImportance = { HIGH: 4 };
export const TriggerType = { TIMESTAMP: 0 };
export const RepeatFrequency = { HOURLY: 0 };
export const EventType = { PRESS: 1, DISMISSED: 0 };
