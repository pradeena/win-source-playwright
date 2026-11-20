// One-off script (NOT run by `playwright test`) that logs in with the real
// WIN SOURCE account from .env and saves the resulting session (cookies +
// localStorage) to playwright/.auth/user.json.
//
// Run it whenever the saved session expires:
//   npm run generate-auth
//
// Requires WIN_SOURCE_EMAIL / WIN_SOURCE_PASSWORD to be set, either in a
// local .env file (see .env.example) or as environment variables.

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL = process.env.BASE_URL || 'https://www.win-source.net';
const LOGIN_URL = new URL('/login', BASE_URL).toString();
const AUTOMATION_KEY = process.env.WS_AUTOMATION_KEY;
const AUTH_FILE = path.resolve(__dirname, '../playwright/.auth/user.json');

(async () => {
  const email = process.env.WIN_SOURCE_EMAIL;
  const password = process.env.WIN_SOURCE_PASSWORD;

  if (!email || !password) {
    console.error(
      'Set WIN_SOURCE_EMAIL and WIN_SOURCE_PASSWORD (in .env or the shell) before running this script.',
    );
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const browser = await chromium.launch();
  // IMPORTANT: playwright.config.ts sends this header on every request made
  // through the test runner (see `use.extraHTTPHeaders`). The site appears to
  // gate automated traffic on it, so a context created outside the test
  // runner (like this script) has to add it manually or pages hang/never
  // render correctly. Both read the key from WS_AUTOMATION_KEY.
  const context = await browser.newContext({
    extraHTTPHeaders: AUTOMATION_KEY ? { 'x-ws-automation-key': AUTOMATION_KEY } : {},
  });
  const page = await context.newPage();

  try {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"], input[name*="email" i]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(password);

    const submitButton = page
      .getByRole('button', { name: /^(sign in|log in|login)$/i })
      .or(page.locator('input[type="submit"]').first());

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      submitButton.click(),
    ]);

    if (/\/login(?:\?|$)/i.test(page.url())) {
      throw new Error('Still on the login page after submitting — check the credentials or the login form.');
    }

    await context.storageState({ path: AUTH_FILE });
    console.log(`Saved logged-in session to ${AUTH_FILE}`);
  } catch (err) {
    console.error(`Failed to generate auth state: ${err.message}`);
    await page.screenshot({ path: path.resolve(__dirname, '../generate-auth-failure.png') }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
