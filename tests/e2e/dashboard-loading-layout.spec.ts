import { expect, test } from '@playwright/test';

test('prompt log loading skeleton fills the prompt panel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.route('**/auth/session', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        userId: 'user-owner-001',
        role: 'OWNER',
        tenantId: 'tenant-001',
        sessionId: 'session-owner-001',
        isInstanceAdmin: true,
      }),
    });
  });

  await page.goto('/dashboard/prompts');
  await expect(page.locator('.v2-dashboard-loading')).toBeVisible();
  await expect(page.locator('.v2-prompt-log-skeleton')).toBeVisible();

  const [main, panel] = await Promise.all([
    page.locator('.v2-main').boundingBox(),
    page.locator('.v2-prompt-log-skeleton').boundingBox(),
  ]);

  expect(main).not.toBeNull();
  expect(panel).not.toBeNull();
  expect(panel!.width).toBeGreaterThan(main!.width * 0.9);
});

test('overview loading skeleton fills the dashboard canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.route('**/auth/session', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        userId: 'user-owner-001', role: 'OWNER', tenantId: 'tenant-001', sessionId: 'session-owner-001', isInstanceAdmin: true,
      }),
    });
  });

  await page.goto('/dashboard/overview');
  await expect(page.locator('.v2-overview-skeleton')).toBeVisible();
});

for (const [path, selector] of [
  ['/dashboard/projects', '.v2-projects-skeleton'],
  ['/dashboard/connect', '.v2-connect-skeleton'],
] as const) {
  test(`${path} loading skeleton renders`, async ({ page }) => {
    await page.route('**/auth/session', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ userId: 'user-owner-001', role: 'OWNER', tenantId: 'tenant-001', sessionId: 'session-owner-001', isInstanceAdmin: true }) });
    });
    await page.goto(path);
    await expect(page.locator(selector)).toBeVisible();
  });
}
