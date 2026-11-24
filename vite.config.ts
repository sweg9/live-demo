/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// With VITE_MOCK=off, /api goes to a real server (for example the local k3d cluster at
// https://sweg9.localhost:8443). Otherwise MSW answers in the browser and nothing leaves the page.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET ?? 'https://sweg9.localhost:8443',
          changeOrigin: true,
          secure: false, // local self-signed certificate only
          ws: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['src/test/setup.ts'],
    },
  }
})
