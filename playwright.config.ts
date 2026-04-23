import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration Playwright pour les tests E2E Servicall.
 * Les tests E2E nécessitent que le serveur soit démarré (baseURL ci-dessous).
 * En CI, utiliser : npm run start & npx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],
  use: {
    baseURL: process.env['E']2E_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 13"] },
    },
  ],
  // Démarrer le serveur de développement avant les tests (optionnel)
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:5173",
  //   reuseExistingServer: !process.env['CI'],
  //   timeout: 120_000,
  // },
});
