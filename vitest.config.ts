import { defineConfig, mergeConfig } from "vitest/config"

import viteConfig from "./vite.config"

// eslint-disable-next-line import/no-default-export
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      environment: "jsdom",
      include: ["lib/**/*.test.{ts,tsx}"],
    },
  }),
)
