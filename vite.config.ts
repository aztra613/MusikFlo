/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const projectRoot = import.meta.dirname ?? process.cwd();

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/vexflow')) return 'vendor-vexflow';
            if (id.includes('node_modules/tone')) return 'vendor-tone';
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) return 'vendor-export';
            if (id.includes('node_modules/@spotify/basic-pitch') || id.includes('node_modules/@tensorflow')) return 'vendor-transcribe';
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react';
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: false,
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
