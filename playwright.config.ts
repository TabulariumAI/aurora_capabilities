import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: "capabilities.visual.spec.ts",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 5179",
    port: 5179,
    reuseExistingServer: !process.env.CI
  }
});
