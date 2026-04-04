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

test('opens the executive AI strategy SME overlay', async ({ page }) => {
  await page.goto('/dashboard/executive');

  await expect(page.getByRole('heading', { name: 'Executive Planning Cockpit' })).toBeVisible();
  await page.getByRole('button', { name: 'AI Strategy SME' }).click();

  await expect(page.getByRole('dialog', { name: 'Executive AI Strategy SME' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leadership signals' })).toBeVisible();
  await expect(page.getByText('Average weighted score is')).toBeVisible();
});

test('opens the pnl AI driver SME overlay', async ({ page }) => {
  await page.goto('/dashboard/pnl');

  await expect(page.getByRole('heading', { name: 'P&L Projection Console' })).toBeVisible();
  await page.getByRole('button', { name: 'AI Driver SME' }).click();

  const dialog = page.getByRole('dialog', { name: 'P&L AI Driver SME' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Top drivers' })).toBeVisible();
  await expect(dialog.getByText('Average Order Value', { exact: true })).toBeVisible();
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
