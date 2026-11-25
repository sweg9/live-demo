/// <reference types="vitest/config" />
import { createReadStream, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The textured scan (local/scan/home-textured.glb) shows personal belongings. The dev server
// serves it at /scan-local/ on this computer only; it is not in public/, so a build never
// copies it into dist/ (C-05).
function localScan(): Plugin {
  const file = resolve(__dirname, 'local/scan/home-textured.glb')
  return {
    name: 'local-scan',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/scan-local/home-textured.glb', (_req, res) => {
        if (!existsSync(file)) {
          res.statusCode = 404
          res.end()
          return
        }
        res.setHeader('content-type', 'model/gltf-binary')
        res.setHeader('cache-control', 'no-store')
        createReadStream(file).pipe(res)
      })
    },
  }
}

// With VITE_MOCK=off, /api goes to a real server (for example the local k3d cluster at
// https://sweg9.localhost:8443). Otherwise MSW answers in the browser and nothing leaves the page.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), localScan()],
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
