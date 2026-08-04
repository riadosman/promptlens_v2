import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing presents the Narrative Glow product story', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Make every prompt a reusable asset.' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Editorial Workbench preview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Capture' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Understand' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Improve', exact: true })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('auth routes share the Editorial Intelligence shell', async ({ page }) => {
  const routes = [
    ['/login', 'Sign in to your workspace.'],
    ['/register', 'Turn prompts into durable knowledge.'],
    ['/forgot-password', 'Reset your password.'],
    ['/reset-password', 'Choose a new password.'],
    ['/verify-email', 'Verify your email.'],
  ] as const;

  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByText('Better prompts are not an accident.')).toBeVisible();
  }
});

test('auth errors are announced and readable', async ({ page }) => {
  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid credentials.' }),
    });
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill('wrong@example.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid credentials.' })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
