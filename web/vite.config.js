import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Requests to /api go to the backend. This means the frontend code has no
    // hardcoded host in it, and there is no CORS setup to get wrong.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
