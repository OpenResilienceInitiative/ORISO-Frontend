import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone sandbox for the ORISO registration "topic selection" screen.
// Kept deliberately separate from ORISO-Frontend so it can be iterated on quickly,
// but built on the same stack (React + MUI v5 + react-i18next) so the
// <TopicSelection /> component lifts straight into production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    open: false,
  },
});
