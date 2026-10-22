import { defineConfig, devices } from "@playwright/test"

// Every browser runs the stand on React 18 and on React 19.
const servers = [
  { react: "18", port: 4318 },
  { react: "19", port: 4319 },
]

const browsers = [
  { name: "chromium", use: devices["Desktop Chrome"] },
  { name: "firefox", use: devices["Desktop Firefox"] },
  { name: "webkit", use: devices["Desktop Safari"] },
]

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  projects: servers.flatMap(({ react, port }) =>
    browsers.map((browser) => ({
      name: `${browser.name}-react${react}`,
      use: { ...browser.use, baseURL: `http://localhost:${port}` },
    })),
  ),
  webServer: servers.map(({ react, port }) => ({
    command: `npx vite --port ${port} --strictPort`,
    port,
    env: { REACT_VERSION: react },
    reuseExistingServer: !process.env.CI,
  })),
})
