/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development the Spring Boot API runs on :8080; the browser only talks to Vite.
    proxy: {
      // API_TARGET points the dev server at another backend, e.g. a container on a different port
      '/api': process.env.API_TARGET ?? 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ is Playwright's
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
