import { test, expect } from '@playwright/test';

test('must have register link in home page', async ({ page }) => {
  await page.goto('https://win-source.net/');
  await expect(page.getByRole('link', { name: 'Registration' })).toBeVisible();
});

test('must go to register page', async ({ page }) => {
  await page.goto('https://win-source.net/');

  // Click the get started link.
  await page.getByRole('link', { name: 'Registration' }).click();
  await expect(page).toHaveURL("https://win-source.net/register?returnUrl=%2F");
});


test('must see register form in register page', async ({ page }) => {
  await page.goto('https://win-source.net/register');

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Registration' })).toBeVisible();
  await expect(page.getByLabel('First name:')).toBeVisible();
  await expect(page.getByLabel('Last name:')).toBeVisible();
  await expect(page.getByLabel('Email:')).toBeVisible();
  await expect(page.getByLabel('Company name:')).toBeVisible();
  await expect(page.getByLabel('Phone:')).toBeVisible();
  await expect(page.getByLabel("Role:")).toBeVisible()
  await expect(page.getByLabel("Country:")).toBeVisible()
  await expect(page.getByLabel("Password:")).toBeVisible()
  await expect(page.getByLabel("Confirm password:")).toBeVisible()
});

test('Form must be submitable', async ({ page }) => {
  await page.goto('https://win-source.net/register');

  // Expects page to have a heading with the name of Installation.
  await page.getByLabel('First name:').fill("Pradeen")
  await page.getByLabel('Last name:').fill("Shrestha")
  await page.getByLabel('Email:').fill("pradeena@gmail.com")
  await page.getByLabel('Company name:').fill("SEA")
  await page.getByLabel('Phone:').fill("")
  await page.getByLabel("Country:").selectOption("1")
  await page.getByLabel("Password:").fill("secret")
  await page.getByLabel("Confirm password:").fill("secret")
});