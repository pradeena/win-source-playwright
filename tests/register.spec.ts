import { test, expect } from '@playwright/test';

test('must have register link in home page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Registration' })).toBeVisible();
});

test('must go to register page', async ({ page }) => {
  await page.goto('/');

  // Click the get started link.
  await page.getByRole('link', { name: 'Registration' }).click();
  await expect(page).toHaveURL('/register?returnUrl=%2F');
});


test('must see register form in register page', async ({ page }) => {
  await page.goto('/register');

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Registration' })).toBeVisible();
  await expect(page.getByLabel('First name:')).toBeVisible();
  await expect(page.getByLabel('Last name:')).toBeVisible();
  await expect(page.getByLabel('Email:')).toBeVisible();
  await expect(page.getByLabel('Company name:')).toBeVisible();
  await expect(page.getByLabel('Phone:')).toBeVisible();
  await expect(page.locator('select[id="customer_attribute_1"]')).toBeVisible();
  await expect(page.locator('select[id="CountryId"]')).toBeVisible();
  await expect(page.getByLabel("Country:")).toBeVisible()
  await expect(page.getByLabel("Confirm password:", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Password:", { exact: true })).toBeVisible()
});

test('Form must be submitable', async ({ page }) => {
  await page.goto('/register');
  const email = `test-${Date.now()}@example.com`;
  // Expects page to have a heading with the name of Installation.
  await page.getByLabel('First name:').fill("Pradeen")
  await page.getByLabel('Last name:').fill("Shrestha")
  await page.getByLabel('Email:').fill(email)
  await page.getByLabel('Company name:').fill("SEA")
  await page.getByLabel('Phone:').fill("")
  await page.getByLabel("Country:").selectOption("1")
  await page.getByLabel("Password:", {
    exact: true
  }).fill("topsecret")
  await page.getByLabel("Confirm password:", { exact: true }).fill("topsecret")
  await page.getByLabel('You agree to WIN SOURCE\'s', { exact: true }).click()
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page).toHaveURL(/\/register\?resultId=[a-zA-Z0-9]+&customerGuid=[a-zA-Z0-9]+/)
  await expect(page.getByText('Your registration has been successfully completed. You have just been sent an email containing account activation instructions.')).toBeVisible()
});