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
