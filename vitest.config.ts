import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node, not jsdom: everything under test here is pure logic — bytes,
    // strings and numbers. The parts that genuinely need a browser engine are
    // covered by tests/characterization, which drives a real Electron.
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    globals: false
  }
});
