// `defineConfig` from vitest/config, not vite: it is the same function widened
// to accept the `test` key below.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    // jsdom, not node: db.ts reads localStorage, and the mock client is the
    // thing under test — stubbing the browser API would test the stub.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
