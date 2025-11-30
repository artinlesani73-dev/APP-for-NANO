import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    envPrefix: ['VITE_', 'GEMINI_'],
    plugins: [react()],
    define: {
      'process.env': {
        VITE_SHARED_API_KEY: env.VITE_SHARED_API_KEY,
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        VITE_LOG_ENDPOINT: env.VITE_LOG_ENDPOINT,
        VITE_ADMIN_PASSPHRASE: env.VITE_ADMIN_PASSPHRASE,
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: ({ name }) => {
            const ext = name ? path.extname(name) : '';
            if (ext === '.ico' || ext === '.png') {
              return 'assets/icons/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          }
        }
      }
    }
  };
});
