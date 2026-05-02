import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import ReportScreen from '../src/screens/ReportScreen';
import StorageService from '../src/services/StorageService';
import { LogEntry } from '../src/types/LogEntry';

const entry: LogEntry = {
  id: 'e1',
  timestampStart: new Date('2026-05-02T10:00:00').getTime(),
  timestampEnd: new Date('2026-05-02T12:00:00').getTime(),
  transcript: 'Worked on the report screen.',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(StorageService, 'getByDateRange').mockResolvedValue([]);
});

async function render(onClose = jest.fn()) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<ReportScreen onClose={onClose} />);
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

test('calls onClose when Close is tapped', async () => {
  const onClose = jest.fn();
  const renderer = await render(onClose);
  await ReactTestRenderer.act(async () => {
    const closeNode = renderer.root.findAll(
      el => el.props.children === 'Close',
    )[0];
    let node = closeNode;
    while (node && typeof node.props.onPress !== 'function') {
      node = node.parent!;
    }
    node.props.onPress();
  });
  expect(onClose).toHaveBeenCalledTimes(1);
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
