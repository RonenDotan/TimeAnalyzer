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
  getNotificationSettings: jest.fn().mockResolvedValue({ authorizationStatus: 1, android: { alarm: 1 } }),
  openAlarmPermissionSettings: jest.fn().mockResolvedValue(undefined),
};

export default notifee;
export const AndroidImportance = { HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0 };
export const AndroidNotificationSetting = { DISABLED: 0, ENABLED: 1 };
export const AndroidVisibility = { PUBLIC: 1, PRIVATE: 0, SECRET: -1 };
export const AlarmType = {
  SET: 0,
  SET_AND_ALLOW_WHILE_IDLE: 1,
  SET_EXACT: 2,
  SET_EXACT_AND_ALLOW_WHILE_IDLE: 3,
};
export const TriggerType = { TIMESTAMP: 0 };
export const RepeatFrequency = { HOURLY: 0 };
export const EventType = { PRESS: 1, DISMISSED: 0 };
