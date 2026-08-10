import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';

test('registers, creates a project, and approves a connector', async ({ page }) => {
  const email = `browser-${randomUUID()}@example.test`;
  const authorization = await page.request.post(
    'http://localhost:4000/v1/connectors/device/authorization',
    {
      headers: { origin: 'http://localhost:3000' },
      data: { platform: 'browser-e2e', displayName: 'Browser E2E', protocolVersion: '1.0' },
    },
  );
  expect(authorization.status()).toBe(201);
  const device = (await authorization.json()) as { userCode: string };
  await page.goto(`/connect?code=${device.userCode}`);
  await expect(page.getByLabel('Device code')).toHaveValue(device.userCode);
  await page.getByRole('link', { name: 'create an account' }).click();
  await expect(page).toHaveURL(/\/register\?returnTo=/u);
  await page.getByLabel('Your name').fill('Browser Acceptance');
  await page.getByLabel('Workspace name').fill('Browser Workspace');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Browser-Acceptance-Password-42!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(new RegExp(`/connect\\?code=${device.userCode}$`, 'u'));
  await expect(page.getByLabel('Device code')).toHaveValue(device.userCode);

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Workspace overview' })).toBeVisible();
  const dashboardA11y = await new AxeBuilder({ page }).analyze();
  expect(dashboardA11y.violations).toEqual([]);

  await page.getByRole('link', { name: 'Projects' }).click();
  await expect(page).toHaveURL(/\/dashboard\/projects$/u);
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'General', exact: true })).toBeVisible();
  await page.getByLabel('Project name').fill('Browser Project');
  await page.getByLabel('Description').fill('Created by the browser acceptance test');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: 'Browser Project' })).toBeVisible();

  await page.goto(`/connect?code=${device.userCode}`);
  await page.getByLabel('Project').selectOption({ label: 'Browser Project' });
  await page.getByRole('button', { name: 'Connect device' }).click();
  await expect(page.getByText('Device connected. You can return to your AI tool.')).toBeVisible();
  const consentA11y = await new AxeBuilder({ page }).analyze();
  expect(consentA11y.violations).toEqual([]);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'System control' })).toBeVisible();
  const adminA11y = await new AxeBuilder({ page }).analyze();
  expect(adminA11y.violations).toEqual([]);
});
