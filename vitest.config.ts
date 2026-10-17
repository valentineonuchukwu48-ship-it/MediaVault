import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Keep test writes out of the real data folder.
    env: {
      FGC_DATA_DIR: '.test-data',
      FGC_BIN_DIR: 'bin',
    },
  },
});
