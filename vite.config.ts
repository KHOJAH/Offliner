import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['electron', 'electron-store', 'electron-updater', 'child_process', 'fs', 'path', 'os'],
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        vite: {
          build: {
            outDir: 'dist/preload',
          },
        },
      },
      {
        entry: 'src/worker/index.ts',
        vite: {
          build: {
            outDir: 'dist/worker',
            rollupOptions: {
              external: ['child_process', 'fs', 'path', 'os', 'stream', 'events'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
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
  build: {
    outDir: 'dist/renderer',
    rollupOptions: {
      input: {
        renderer: 'index.html',
      },
    },
  },
});
