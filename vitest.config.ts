// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/stores': resolve(__dirname, 'src/renderer/stores'),
      '@/components': resolve(__dirname, 'src/renderer/components'),
      '@/views': resolve(__dirname, 'src/renderer/views'),
      '@/ipc': resolve(__dirname, 'src/renderer/ipc'),
      '@/types': resolve(__dirname, 'src/types'),
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom', globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
