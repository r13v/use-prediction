import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// https://vitejs.dev/config/
// eslint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [react(), dts({ include: ['lib'] })],
  build: {
    copyPublicDir: false,
    minify: false,

    lib: {
      entry: resolve(__dirname, 'lib/use-prediction.ts'),
      formats: ['es', 'cjs'],
    },

    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
    },
  },
})
