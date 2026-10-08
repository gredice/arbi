import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./browser", fullyParallel: false, workers: 1, timeout: 20000,
  reporter: "list", use: { baseURL: process.env.ARBI_DASHBOARD_ORIGIN, trace: "off", video: "off", screenshot: "off" } });
