import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import ReportScreen from '../src/screens/ReportScreen';
import StorageService from '../src/services/StorageService';
import { LogEntry } from '../src/types/LogEntry';

const entry: LogEntry = {
  id: 1,
  timestampStart: new Date('2026-05-02T10:00:00').getTime(),
  timestampEnd: new Date('2026-05-02T12:00:00').getTime(),
  transcript: 'Worked on the report screen.',
  calendarEventId: null,
  source: 'app',
  status: 1,
  updatedAt: new Date('2026-05-02T10:00:00').getTime(),
  syncedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(StorageService, 'getByDateRange').mockResolvedValue([]);
});

async function render(onStartCheckIn = jest.fn(), onOpenMenu = jest.fn()) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ReportScreen onStartCheckIn={onStartCheckIn} onOpenMenu={onOpenMenu} />,
    );
  });
  return renderer;
}

test('shows empty state when no entries', async () => {
  const renderer = await render();
  expect(JSON.stringify(renderer.toJSON())).toContain('No entries for this day');
});

test('shows entry transcript when entries exist', async () => {
  jest.spyOn(StorageService, 'getByDateRange').mockResolvedValue([entry]);
  const renderer = await render();
  expect(JSON.stringify(renderer.toJSON())).toContain('Worked on the report screen.');
});

test('shows formatted time range for entry', async () => {
  jest.spyOn(StorageService, 'getByDateRange').mockResolvedValue([entry]);
  const renderer = await render();
  expect(JSON.stringify(renderer.toJSON())).toContain('10:00');
  expect(JSON.stringify(renderer.toJSON())).toContain('12:00');
});

test('calls onStartCheckIn when FAB is tapped', async () => {
  const onStartCheckIn = jest.fn();
  const renderer = await render(onStartCheckIn);
  await ReactTestRenderer.act(async () => {
    const fabNode = renderer.root.findAll(
      el => el.props.children === '+',
    )[0];
    let node = fabNode;
    while (node && typeof node.props.onPress !== 'function') {
      node = node.parent!;
    }
    node.props.onPress();
  });
  expect(onStartCheckIn).toHaveBeenCalledTimes(1);
});

test('end-of-day notification fires when no more check-ins today', async () => {
  const notifee = require('@notifee/react-native').default;
  const SchedulerService = require('../src/services/SchedulerService').default;
  jest.spyOn(SchedulerService, 'hasMoreCheckInsToday').mockResolvedValue(false);

  await SchedulerService.hasMoreCheckInsToday();
  if (!(await SchedulerService.hasMoreCheckInsToday())) {
    await SchedulerService.fireEndOfDayReport();
  }

  expect(notifee.displayNotification).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'end-of-day-report' }),
  );
});
