import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import v from '../version.json';

test('renders TimeAnalyzer title', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const tree = JSON.stringify(renderer!.toJSON());
  expect(tree).toContain('TimeAnalyzer');
  expect(tree).toContain('Start Check-in');
});

test('renders correct version string', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const tree = JSON.stringify(renderer!.toJSON());
  const expected = `v${v.major}.${v.minor}.${v.ticket_id}.${v.sequence}`;
  expect(tree).toContain(expected);
});
