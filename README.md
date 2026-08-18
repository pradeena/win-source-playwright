# WIN SOURCE Playwright tests

## Run the login-page check

```powershell
npm run test:login
```

This confirms that the WIN SOURCE login page shows email and password fields.

## Run a real login

In PowerShell, set your credentials only for the current window, then run the test:

```powershell
$env:WIN_SOURCE_EMAIL = "you@example.com"
$env:WIN_SOURCE_PASSWORD = "your-password"
npm run test:login
```

The test never stores your password in the code. The real-login test is skipped until both variables are set.
