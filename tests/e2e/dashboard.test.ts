import { test, expect } from '@playwright/test';

test('loads the canonical scenario comparison console', async ({ page }) => {
  await page.goto('/dashboard/analysis/compare');

  await expect(page.getByRole('heading', { name: 'Scenario Comparison Console' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Base Plan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upside Plan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CSV' })).toBeVisible();
});

test('loads the scope dimension editor route family', async ({ page }) => {
  await page.goto('/dashboard/scope/formats');

  await expect(page.getByRole('heading', { name: 'Formats Dimension Editor' })).toBeVisible();
  await expect(page.getByText('Dark Kitchen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reference Inventory' })).toBeVisible();
});

test('loads the scope review surface', async ({ page }) => {
  await page.goto('/dashboard/scope/review');

  await expect(page.getByRole('heading', { name: 'Scope Review Surface' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Validation Summary' })).toBeVisible();
  await expect(page.getByRole('button', { name: /FY26 Core Rollout/i })).toBeVisible();
});

test('loads the compute center', async ({ page }) => {
  await page.goto('/dashboard/compute/center');

  await expect(page.getByRole('heading', { name: 'Compute Center' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Compute' })).toBeVisible();
});

test('creates a scenario through the scenario wizard start flow', async ({ page }) => {
  await page.goto('/wizard/scenario/start');

  await page.getByLabel('Company').selectOption({ label: 'Acme Kitchens' });
  await page.getByLabel('Scenario Name').fill('E2E Growth Draft');
  await page.getByLabel('Version Label').fill('Working Draft v2');
  await page.getByRole('button', { name: 'Create Draft and Continue' }).click();

  await expect(page).toHaveURL(/\/wizard\/scenario\/scope/);
  await expect(page.getByText('E2E Growth Draft')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue to Decisions' })).toBeVisible();
});
