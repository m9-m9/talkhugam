import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  define:
    mode === 'e2e'
      ? { 'import.meta.env.VITE_GA_MEASUREMENT_ID': JSON.stringify('G-E2ETEST123') }
      : undefined,
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    server: {
      deps: {
        inline: ['@seed-design/react', '@seed-design/css'],
      },
    },
    setupFiles: './src/test/setup.ts',
  },
}))
