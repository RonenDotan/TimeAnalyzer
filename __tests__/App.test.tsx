import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders TimeAnalyzer title', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const json = renderer!.toJSON();
  const tree = JSON.stringify(json);
  expect(tree).toContain('TimeAnalyzer');
  expect(tree).toContain('Hello World');
});
