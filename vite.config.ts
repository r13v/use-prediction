import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Dev server for the example app only; the library is built with tsdown.
// https://vitejs.dev/config/
// eslint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [react()],
})
