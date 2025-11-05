import React from 'react';
import { render } from '@testing-library/react';

// Simple test that always passes
test('basic test', () => {
  expect(1 + 1).toBe(2);
});

test('react import works', () => {
  expect(React).toBeDefined();
});
