import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Vital for Electron to load assets via file://
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});