import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('owner overview prioritizes people and projects', async ({ page }) => {
  await page.goto('/dashboard/overview?mock=1');
  await expect(
    page.getByRole('heading', { name: 'Where is your team getting stuck?' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project performance' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'People performance' })).toBeVisible();
});

test('member overview stays personal', async ({ page }) => {
  await page.goto('/dashboard/overview?mock=1&mockRole=user');
  await expect(page.getByRole('heading', { name: 'What should you improve next?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'People performance' })).toHaveCount(0);
  await expect(page.getByText('Needs attention')).toBeVisible();
});

test('prompt workbench keeps filters and the selected analysis in the URL', async ({ page }) => {
  await page.goto('/dashboard/prompts?mock=1');
  await page.getByLabel('Filter by project').selectOption('project-content');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/projectId=project-content/);

  await page.getByRole('button', { name: 'Open analysis' }).first().click();
  await expect(page).toHaveURL(/promptId=prompt-/);
  await expect(page.getByRole('heading', { name: 'Improved prompt' })).toBeVisible();
});

test('clearing an empty prompt filter restores the prompt workbench', async ({ page }) => {
  await page.goto('/dashboard/prompts?mock=1&mockRole=user');
  await page.getByLabel('Search prompts').fill('no matching prompt');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  await expect(page.getByText('No prompts match these filters.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible();

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/mock=1/);
  await expect(page).toHaveURL(/mockRole=user/);
  await expect(page).not.toHaveURL(/[?&](q|projectId|platform|model|minScore|userId|promptId)=/);
  await expect(page.getByRole('button', { name: 'Open analysis' }).first()).toBeVisible();
});

test('clearing production filters reloads prompts without filter parameters', async ({ page }) => {
  const promptRequests: string[] = [];
  const response = (body: unknown) => ({ contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('http://localhost:4000/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/v1/auth/session') {
      await route.fulfill(
        response({
          userId: '00000000-0000-4000-8000-000000000001',
          role: 'MEMBER',
          tenantId: '00000000-0000-4000-8000-000000000002',
          sessionId: '00000000-0000-4000-8000-000000000003',
          isInstanceAdmin: false,
        }),
      );
      return;
    }
    if (url.pathname === '/v1/prompts') {
      promptRequests.push(url.search);
      await route.fulfill(
        response({
          items: url.searchParams.has('q')
            ? []
            : [
                {
                  id: '00000000-0000-4000-8000-000000000004',
                  projectId: '00000000-0000-4000-8000-000000000005',
                  projectName: 'Production project',
                  content: 'A restored production prompt.',
                  platform: 'api',
                  model: 'gpt-test',
                  occurredAt: '2026-08-04T00:00:00.000Z',
                  tags: [],
                  analysis: null,
                },
              ],
          nextCursor: null,
        }),
      );
      return;
    }
    if (url.pathname === '/v1/dashboard/stats') {
      await route.fulfill(
        response({
          projects: 0,
          prompts: 0,
          analysesCompleted: 0,
          averageScore: null,
          promptsLast7Days: 0,
          scoreTrend: [],
          modelDistribution: [],
          projectDistribution: [],
        }),
      );
      return;
    }
    await route.fulfill(response([]));
  });

  await page.goto('/dashboard/prompts?q=no-match');
  await expect(page.getByText('No prompts match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await expect(page.getByRole('button', { name: 'Open analysis' })).toBeVisible();
  expect(promptRequests.some((search) => search.includes('mine=true') && !search.includes('q='))).toBe(
    true,
  );
});

test('project workbench link carries the selected project into prompts', async ({ page }) => {
  await page.goto('/dashboard/projects?mock=1');
  await page.getByRole('link', { name: 'Open Content team prompts' }).click();

  await expect(page).toHaveURL(/\/dashboard\/prompts\?mock=1&projectId=project-content/);
  await expect(page.getByLabel('Filter by project')).toHaveValue('project-content');
});

test('mobile member navigation opens the prompt log accessibly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/overview?mock=1&mockRole=user');
  await page.getByText('Menu', { exact: true }).click();
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(navigation).toContainText('Prompt log');
  await expect(navigation.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(page.getByText('Menu', { exact: true })).toHaveCSS('min-height', '44px');
  await expect(navigation.getByRole('link', { name: 'Prompt log' })).toHaveCSS('min-height', '44px');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

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

test('landing respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await expect(page.locator('.landing-product-preview')).toHaveCSS(
    'animation-duration',
    /^(0s|0\.01ms|1e-05s)$/,
  );
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

test('auth panel controls show a contrasting keyboard focus indicator', async ({ page }) => {
  await page.goto('/login');

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Email')).toBeFocused();
  await expect(page.getByLabel('Email')).toHaveCSS('box-shadow', 'rgb(23, 23, 23) 0px 0px 0px 3px');

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCSS(
    'outline-color',
    'rgb(23, 23, 23)',
  );

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Forgot your password?' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Forgot your password?' })).toHaveCSS(
    'outline-color',
    'rgb(23, 23, 23)',
  );
});
