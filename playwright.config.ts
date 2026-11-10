import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync(localChrome) ? localChrome : undefined);
export default defineConfig({
  testMatch: '**/*.spec.ts',
  testDir: './tests', timeout: 180_000, expect: { timeout: 90_000 }, workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173', viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    trace: 'retain-on-failure',
  },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 30_000 },
});
