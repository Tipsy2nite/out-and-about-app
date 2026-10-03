import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is served from the root of app.outandaboutsocial.net
export default defineConfig({ plugins: [react()], base: '/' });
