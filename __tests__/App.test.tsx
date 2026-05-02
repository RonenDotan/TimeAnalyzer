import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders entries screen as home', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const tree = JSON.stringify(renderer!.toJSON());
  // FAB and date nav are present on the entries home screen
  expect(tree).toContain('+');
});
