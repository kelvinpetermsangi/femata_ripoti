import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version?: string };
const backendTarget = 'http://127.0.0.1:8000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version || '0.0.0'),
  },
  server: {
    proxy: {
      '/health': backendTarget,
      '/meta': backendTarget,
      '/api/ai-chat': backendTarget,
      '/reports': backendTarget,
      '/track-report': backendTarget,
      '/ai-chat': backendTarget,
      '/admin/auth': backendTarget,
      '/admin/profile': backendTarget,
      '/admin/directory': backendTarget,
      '/admin/zones': backendTarget,
      '/admin/messages': backendTarget,
      '/admin/notifications': backendTarget,
      '/admin/training': backendTarget,
      '/admin/analytics': backendTarget,
      '/admin/users': backendTarget,
      '/admin/reports': backendTarget,
      '/admin/locales': backendTarget,
      '/admin/files': backendTarget,
    },
  },
});
