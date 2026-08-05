# Editorial Intelligence UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current public, auth, dashboard, prompt, and project UI with the approved Poppins-based Editorial Intelligence and Narrative Glow designs while preserving the existing API and multi-tenant authorization model.

**Architecture:** Keep server/API behavior and dashboard data loading in the existing components. Establish shared visual tokens in the global stylesheet, add one reused auth page shell, and reshape the existing dashboard JSX into role-aware overview and two-pane prompt workbench layouts. Use URL query parameters only for shareable UI filters; tenant and actor scope continue to come from the authenticated server session.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, native CSS, `next/font/google`, Playwright, axe-core.

## Global Constraints

- Run the web app on `http://localhost:3001`.
- Preserve warm paper `#F8F5EF`, ink `#171717`, acid `#D9FF3F`, and signal orange `#FF7046`.
- Use Poppins weights 400, 500, 600, 700, 800, and 900 through the existing Next.js font feature; add no package.
- Use glow only on the public product stage and small brand accents, never on dashboard data surfaces.
- Keep current English product copy conventions; localization is outside this plan.
- Add no UI framework, chart library, state library, pricing, testimonial, blog, CMS, or dark-mode system.
- Never derive tenant or actor authorization from URL parameters.
- Preserve keyboard access, visible focus, semantic labels, reduced motion, and readable error contrast.
- Project runtime remains Node `>=22.14.0 <23` and pnpm `>=10.14.0 <11`.

---

## File Structure

- `apps/web/app/layout.tsx`: load Poppins once and expose its CSS variable.
- `apps/web/app/styles.css`: own shared tokens plus public, auth, dashboard, workbench, project, state, and responsive styles; replace the obsolete v2 visual rules instead of appending a third theme.
- `apps/web/app/page.tsx`: render the Narrative Glow landing page.
- `apps/web/components/auth-page-shell.tsx`: shared two-column presentation for all auth routes.
- `apps/web/app/login/page.tsx`: login copy and form composition.
- `apps/web/app/register/page.tsx`: registration copy and form composition.
- `apps/web/app/forgot-password/page.tsx`: forgot-password copy and form composition.
- `apps/web/app/reset-password/page.tsx`: reset-password copy and form composition.
- `apps/web/app/verify-email/page.tsx`: verification copy and form composition.
- `apps/web/components/auth-form.tsx`: preserve behavior; add semantic pending/error state hooks.
- `apps/web/components/recovery-form.tsx`: preserve behavior; add semantic pending/error state hooks.
- `apps/web/components/dashboard-client.tsx`: retain data fetching and mutations; implement the role-aware overview, native mobile navigation, URL filters, prompt workbench, project rows, and states.
- `tests/e2e/editorial-ui.spec.ts`: cover public/auth visuals, role-aware mock dashboards, URL-backed workbench filters, project handoff, mobile navigation, and accessibility.
- `tests/e2e/critical-flow.spec.ts`: update only selectors whose visible labels intentionally change.

---

### Task 1: Shared Foundation and Narrative Glow Landing

**Files:**

- Modify: `apps/web/app/layout.tsx:1-15`
- Modify: `apps/web/app/page.tsx:1-68`
- Modify: `apps/web/app/styles.css:1-302`
- Create: `tests/e2e/editorial-ui.spec.ts`

**Interfaces:**

- Produces: CSS variables `--paper`, `--ink`, `--acid`, `--signal`, `--muted`, `--line`, and `--font-poppins` for every later task.
- Produces: stable landing landmarks `main`, heading `Make every prompt a reusable asset.`, region `Editorial Workbench preview`, and process headings `Capture`, `Understand`, `Improve`.

- [ ] **Step 1: Write the failing landing test**

```ts
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
  await expect(page.getByRole('heading', { name: 'Improve' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
```

- [ ] **Step 2: Run the landing test and confirm it fails**

Run the web app in one PowerShell terminal:

```powershell
rtk pnpm --filter @promptlens/web dev -- --port 3001
```

Run the test in a second terminal:

```powershell
$env:E2E_WEB_ORIGIN='http://localhost:3001'; rtk pnpm exec playwright test tests/e2e/editorial-ui.spec.ts --grep "Narrative Glow"
```

Expected: FAIL because the current landing has no `Editorial Workbench preview` region or three process headings.

- [ ] **Step 3: Load Poppins and establish the shared tokens**

Use the built-in Next font integration in `layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import type { ReactNode } from 'react';
import './styles.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PromptLens',
  description: 'Understand, improve and organize every prompt.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={poppins.variable} lang="en">
      <body>{children}</body>
    </html>
  );
}
```

At the start of `styles.css`, replace the old palette with:

```css
:root {
  --paper: #f8f5ef;
  --paper-deep: #e7e1d6;
  --ink: #171717;
  --acid: #d9ff3f;
  --signal: #ff7046;
  --muted: #625f58;
  --line: #171717;
  color-scheme: light;
  font-family: var(--font-poppins), Arial, sans-serif;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-poppins), Arial, sans-serif;
}

:focus-visible {
  outline: 3px solid var(--acid);
  outline-offset: 3px;
}
```

- [ ] **Step 4: Replace the landing markup with the approved composition**

Keep the existing product claims and use this structure in `page.tsx`:

```tsx
const capabilities = [
  {
    index: '01',
    title: 'Capture',
    copy: 'Keep every prompt connected to the project and work it supports.',
  },
  {
    index: '02',
    title: 'Understand',
    copy: 'See strengths, gaps, and practical feedback behind every score.',
  },
  {
    index: '03',
    title: 'Improve',
    copy: 'Turn recommendations into a stronger prompt your team can reuse.',
  },
];

export default function HomePage() {
  return (
    <main className="editorial-landing">
      <nav className="editorial-nav" aria-label="Primary navigation">
        <a className="editorial-wordmark" href="/">
          <span aria-hidden="true" />
          PromptLens
        </a>
        <div>
          <a href="/login">Sign in</a>
          <a className="ink-action" href="/register">
            Create a workspace
          </a>
        </div>
      </nav>
      <section className="landing-narrative" aria-labelledby="hero-title">
        <p className="editorial-kicker">Open source prompt intelligence</p>
        <h1 id="hero-title">Make every prompt a reusable asset.</h1>
        <div className="landing-stamp" aria-hidden="true">
          Prompt
          <br />
          quality
          <br />
          matters
        </div>
        <div className="landing-intro">
          <p>
            Capture, understand and improve your best thinking without losing the project context
            that makes every prompt valuable.
          </p>
          <a href="/register">Start your workspace →</a>
        </div>
      </section>
      <section className="landing-stage" aria-label="Editorial Workbench preview">
        <header>
          <div>
            <p className="editorial-kicker">Editorial Workbench</p>
            <h2>See what needs improvement at a glance.</h2>
          </div>
          <span>Role-aware · Project context</span>
        </header>
        <div className="landing-product-preview">
          <div className="preview-list" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <article>
            <strong>69 / 100</strong>
            <h3>Missing context and an unclear target</h3>
            <p>Add the audience, policy constraint, and desired next action.</p>
          </article>
        </div>
        <span className="floating-signal signal-one">3 weak prompts</span>
        <span className="floating-signal signal-two">+12 score improvement</span>
      </section>
      <section className="landing-process" aria-label="How PromptLens works">
        {capabilities.map((item) => (
          <article key={item.index}>
            <span>{item.index}</span>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
          </article>
        ))}
      </section>
      <section className="landing-final-cta">
        <h2>Better prompts are not an accident.</h2>
        <a className="ink-action" href="/register">
          Create a workspace →
        </a>
      </section>
    </main>
  );
}
```

Implement the matching native CSS by replacing the old `.landing-*`, `.hero-*`, `.preview-*`, and `.capability-*` blocks. Use asymmetric hero positioning, a dark `.landing-stage`, one radial acid glow behind `.landing-product-preview`, and a single-column mobile fallback below `850px`. Do not retain the previous card grid styles.

- [ ] **Step 5: Run the test and typecheck**

```powershell
$env:E2E_WEB_ORIGIN='http://localhost:3001'; rtk pnpm exec playwright test tests/e2e/editorial-ui.spec.ts --grep "Narrative Glow"
rtk pnpm --filter @promptlens/web typecheck
```

Expected: landing test PASS; typecheck PASS.

- [ ] **Step 6: Commit the landing foundation**

```powershell
rtk git add -- apps/web/app/layout.tsx apps/web/app/page.tsx apps/web/app/styles.css tests/e2e/editorial-ui.spec.ts
rtk git commit -m "feat(web): add Narrative Glow landing"
```

---

### Task 2: Cohesive Auth Page Family

**Files:**

- Create: `apps/web/components/auth-page-shell.tsx`
- Modify: `apps/web/app/login/page.tsx:1-26`
- Modify: `apps/web/app/register/page.tsx:1-23`
- Modify: `apps/web/app/forgot-password/page.tsx:1-18`
- Modify: `apps/web/app/reset-password/page.tsx:1-18`
- Modify: `apps/web/app/verify-email/page.tsx:1-18`
- Modify: `apps/web/components/auth-form.tsx:28-68`
- Modify: `apps/web/components/recovery-form.tsx:55-99`
- Modify: `apps/web/app/styles.css:303-365`
- Modify: `tests/e2e/editorial-ui.spec.ts`

**Interfaces:**

- Produces: `AuthPageShell({ eyebrow, title, children }: AuthPageShellProps)`.
- Preserves: `AuthForm` and `RecoveryForm` request payloads, redirects, validation, and button names.

- [ ] **Step 1: Add failing auth-family and error accessibility tests**

Append:

```ts
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
  await expect(page.getByRole('alert')).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
```

- [ ] **Step 2: Run the auth tests and confirm failure**

```powershell
$env:E2E_WEB_ORIGIN='http://localhost:3001'; rtk pnpm exec playwright test tests/e2e/editorial-ui.spec.ts --grep "auth"
```

Expected: FAIL because the shared story copy and alert role do not exist.

- [ ] **Step 3: Create the one shared auth shell**

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

type AuthPageShellProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly children: ReactNode;
};

export function AuthPageShell({ eyebrow, title, children }: AuthPageShellProps) {
  return (
    <main className="editorial-auth">
      <aside className="auth-story">
        <Link className="editorial-wordmark inverse" href="/">
          <span aria-hidden="true" />
          PromptLens
        </Link>
        <div>
          <p className="editorial-kicker">Prompt intelligence</p>
          <h2>Better prompts are not an accident.</h2>
          <p>
            Find weak points, preserve project context, and turn team knowledge into reusable work.
          </p>
        </div>
        <p className="auth-proof">
          <strong>Editorial Workbench</strong>
          <br />
          Clear feedback. Better outcomes.
        </p>
      </aside>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <p className="editorial-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          {children}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Use the shell on all five auth pages**

Use these exact shell props while preserving each page's existing form and helper links:

| File                       | `eyebrow`              | `title`                                | Child form                                             |
| -------------------------- | ---------------------- | -------------------------------------- | ------------------------------------------------------ |
| `login/page.tsx`           | `Welcome back`         | `Sign in to your workspace.`           | `<AuthForm mode="login" />` plus forgot/register links |
| `register/page.tsx`        | `Start your workspace` | `Turn prompts into durable knowledge.` | `<AuthForm mode="register" />` plus login link         |
| `forgot-password/page.tsx` | `Account recovery`     | `Reset your password.`                 | `<RecoveryForm mode="forgot" />`                       |
| `reset-password/page.tsx`  | `Account recovery`     | `Choose a new password.`               | `<RecoveryForm mode="reset" />`                        |
| `verify-email/page.tsx`    | `Account security`     | `Verify your email.`                   | `<RecoveryForm mode="verify" />`                       |

Remove the duplicated `main.auth-shell`, `section.auth-card`, and wordmark markup from those pages.

- [ ] **Step 5: Add semantic form states and native CSS**

Change both form error paragraphs to:

```tsx
{
  error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
```

Set `aria-busy={pending}` on both `<form>` elements. Keep existing labels and native validation. Replace old `.auth-shell` and `.auth-card` rules with `.editorial-auth`, `.auth-story`, `.auth-panel`, and `.auth-panel-inner`; use black story / paper form columns on desktop and stack them below `760px`. Error text must be ink on a signal-orange surface.

- [ ] **Step 6: Run auth tests and typecheck**

```powershell
$env:E2E_WEB_ORIGIN='http://localhost:3001'; rtk pnpm exec playwright test tests/e2e/editorial-ui.spec.ts --grep "auth"
rtk pnpm --filter @promptlens/web typecheck
```

Expected: both auth tests PASS; typecheck PASS.

- [ ] **Step 7: Commit the auth family**

```powershell
rtk git add -- apps/web/components/auth-page-shell.tsx apps/web/components/auth-form.tsx apps/web/components/recovery-form.tsx apps/web/app/login/page.tsx apps/web/app/register/page.tsx apps/web/app/forgot-password/page.tsx apps/web/app/reset-password/page.tsx apps/web/app/verify-email/page.tsx apps/web/app/styles.css tests/e2e/editorial-ui.spec.ts
rtk git commit -m "feat(web): unify auth page design"
```

---

### Task 3: Editorial Dashboard Shell and Role-Aware Overview

**Files:**

- Modify: `apps/web/components/dashboard-client.tsx:318-786`
- Modify: `apps/web/app/styles.css:985-1290`
- Modify: `tests/e2e/editorial-ui.spec.ts`
- Modify: `tests/e2e/critical-flow.spec.ts:28-36`

**Interfaces:**

- Consumes: shared visual tokens from Task 1.
- Preserves: existing `ActorContext`, mock owner/user modes, endpoint calls, session revocation, logout, and tenant switching.
- Produces: role-aware headings `Where is your team getting stuck?` and `What should you improve next?`.

- [ ] **Step 1: Add failing owner/user overview tests**

```ts
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
```

- [ ] **Step 2: Run overview tests and confirm failure**

```powershell
$env:E2E_WEB_ORIGIN='http://localhost:3001'; rtk pnpm exec playwright test tests/e2e/editorial-ui.spec.ts --grep "overview"
```

Expected: FAIL because the current overview has generic trend/distribution headings.

- [ ] **Step 3: Replace the v2 shell class structure**

Rename the outer wrappers to `editorial-dashboard`, `editorial-sidebar`, and `editorial-main` without changing data calls. Define the shared navigation list inside `DashboardClient`:

```tsx
const navItems = [
  { href: '/dashboard/overview', label: 'Overview' },
  { href: '/dashboard/prompts', label: 'Prompt log' },
  { href: '/dashboard/projects', label: 'Projects' },
  { href: '/connect', label: 'Connect device' },
];
if (adminLinksVisible) navItems.push({ href: '/admin', label: 'Administration' });
```

Render the active tenant above a desktop `<nav aria-label="Main navigation">`, map `navItems` to links with the existing active-route check, keep the existing tenant switch control below it, and keep `Sign out` last. Add the mobile copy from the same array:

```tsx
<details className="mobile-navigation">
  <summary>Menu</summary>
  <nav aria-label="Mobile navigation">
    {navItems.map((item) => (
      <Link href={item.href} key={item.href}>
        {item.label}
      </Link>
    ))}
  </nav>
</details>
```

- [ ] **Step 4: Compute and render actionable overview data**

Add only derived values; do not add state or endpoints:

```tsx
const tenantAdmin = actor ? isTenantAdmin(actor.role) : false;
const needsAttention = prompts.filter((prompt) => {
  const score = prompt.analysis?.score;
  return (
    prompt.analysis?.status === 'FAILED' || (score !== null && score !== undefined && score < 75)
  );
});
const overviewTitle = tenantAdmin
  ? 'Where is your team getting stuck?'
  : 'What should you improve next?';
```

For members, render KPI rows followed by a `Needs attention` list using `needsAttention`. For owner/admin, render the same action list plus `Project performance` from `stats.projectDistribution` and `People performance` from `tenantMembers`; do not show the people section to members. Keep active sessions as a compact security section below the main overview.

- [ ] **Step 5: Replace obsolete v2 dashboard styles**

Delete the `.dashboard-shell-v2` and `.v2-*` theme block as each renamed selector is replaced. Implement paper surfaces, black one-pixel separators, low radii, acid active states, signal-orange attention rows, Poppins metric typography, sticky desktop sidebar, and a one-column layout below `900px`. Dashboard panels receive no glow.

- [ ] **Step 6: Update the existing critical-flow selector and run checks**

Keep the existing `Prompt overview` page heading only if required by the critical flow; otherwise update its assertion to the owner heading:

```ts
await expect(
  page.getByRole('heading', { name: 'Where is your team getting stuck?' }),
).toBeVisible();
```

Run:

```powershell
$env:E2E_WEB_ORIGIN='http://localhost:3001'; rtk pnpm exec playwright test tests/e2e/editorial-ui.spec.ts --grep "overview"
rtk pnpm --filter @promptlens/web typecheck
```

Expected: overview tests PASS; typecheck PASS.

- [ ] **Step 7: Commit the role-aware overview**

```powershell
rtk git add -- apps/web/components/dashboard-client.tsx apps/web/app/styles.css tests/e2e/editorial-ui.spec.ts tests/e2e/critical-flow.spec.ts
rtk git commit -m "feat(web): add role-aware editorial dashboard"
```

---

### Task 4: URL-Backed Prompt Workbench and Project Handoff

**Files:**

- Modify: `apps/web/components/dashboard-client.tsx:318-610`
- Modify: `apps/web/components/dashboard-client.tsx:787-1016`
- Modify: `apps/web/app/styles.css:1291-1585`
- Modify: `tests/e2e/editorial-ui.spec.ts`

**Interfaces:**

- Consumes: existing prompt/project APIs and role scope.
- Produces: query keys `q`, `projectId`, `userId`, `platform`, `model`, `minScore`, and `promptId`.
- Preserves: `mock`, `demo`, and `mockRole` query keys when filters or selection change.

- [ ] **Step 1: Add failing workbench URL and project handoff tests**

```ts
test('prompt workbench keeps filters and selection in the URL', async ({ page }) => {
  await page.goto('/dashboard/prompts?mock=1');
  await page.getByLabel('Filter by project').selectOption('project-content');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/projectId=project-content/u);
  await page.getByRole('button', { name: 'Open analysis' }).first().click();
  await expect(page).toHaveURL(/promptId=prompt-/u);
  await expect(page.getByRole('heading', { name: 'Improved prompt' })).toBeVisible();
});

test('project rows open a pre-filtered workbench', async ({ page }) => {
  await page.goto('/dashboard/projects?mock=1');
  await page.getByRole('link', { name: 'Open Content team prompts' }).click();
  await expect(page).toHaveURL(/\/dashboard\/prompts\?.*projectId=project-content/u);
  await expect(page.getByLabel('Filter by project')).toHaveValue('project-content');
});
```

- [ ] **Step 2: Run workbench tests and confirm failure**

```powershell
$env:E2E_WEB_ORIGIN='http://localhost:3001'; rtk pnpm exec playwright test tests/e2e/editorial-ui.spec.ts --grep "workbench|project rows"
```

Expected: FAIL because filters and selected prompt are not stored in the URL and projects have no workbench link.

- [ ] **Step 3: Initialize and synchronize UI filters from the URL**

Add one effect using existing `useSearchParams`:

```tsx
useEffect(() => {
  setQuery(searchParams.get('q') ?? '');
  setProjectFilter(searchParams.get('projectId') ?? '');
  setPlatformFilter(searchParams.get('platform') ?? '');
  setModelFilter(searchParams.get('model') ?? '');
  setMinScoreFilter(searchParams.get('minScore') ?? '');
  setMemberFilter(searchParams.get('userId') ?? '');
  setSelectedPromptId(searchParams.get('promptId'));
}, [searchParams]);

function replaceDashboardQuery(patch: Record<string, string | null>) {
  const parameters = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value) parameters.set(key, value);
    else parameters.delete(key);
  }
  router.replace(`${pathname}?${parameters.toString()}`);
}
```

Change filter submit to call `replaceDashboardQuery` with all six filter values, then call `load()`. Rename its button to `Apply filters`. Remove the current member `onChange` call to `load()` because it reads stale React state; only update `memberFilter` there.

- [ ] **Step 4: Build the two-pane workbench**

Derive the selected row:

```tsx
const selectedPrompt = prompts.find((prompt) => prompt.id === selectedPromptId) ?? null;

function selectPrompt(promptId: string) {
  setSelectedPromptId(promptId);
  replaceDashboardQuery({ promptId });
}
```

Render `.prompt-workbench` with `.prompt-index` on the left and `.prompt-analysis-panel` on the right. Each list row gets an `Open analysis` button. The right panel renders, in order: status/score, prompt text and metadata, strengths, weaknesses, numbered recommendations, then an `Improved prompt` heading with copy/reanalyze actions. If no prompt is selected, show `Select a prompt to inspect its analysis.` in the right panel.

- [ ] **Step 5: Replace project cards with editorial rows and links**

For each project, keep the archive/restore button and add:

```tsx
<Link
  aria-label={`Open ${project.name} prompts`}
  className="editorial-link"
  href={`/dashboard/prompts?${new URLSearchParams({
    ...(demoMode ? { mock: '1' } : {}),
    projectId: project.id,
  }).toString()}`}
>
  Open workbench →
</Link>
```

Use single-row project records with name, description, status, and action group. Do not invent project metrics absent from the current contract.

- [ ] **Step 6: Implement workbench and project CSS**

Use a `minmax(18rem, 0.75fr) minmax(24rem, 1.25fr)` desktop grid. Keep the index independently scrollable only when viewport height allows it. At `860px`, stack index then analysis, remove sticky behavior, and preserve source order. Use signal orange for scores below 75/failed status and ink/acid for completed states; include textual status labels.

- [ ] **Step 7: Run workbench tests and typecheck**

```powershell
$env:E2E_WEB_ORIGIN='http://localhost:3001'; rtk pnpm exec playwright test tests/e2e/editorial-ui.spec.ts --grep "workbench|project rows"
rtk pnpm --filter @promptlens/web typecheck
```

Expected: both tests PASS; typecheck PASS.

- [ ] **Step 8: Commit the workbench and projects**

```powershell
rtk git add -- apps/web/components/dashboard-client.tsx apps/web/app/styles.css tests/e2e/editorial-ui.spec.ts
rtk git commit -m "feat(web): add editorial prompt workbench"
```

---

### Task 5: Editorial Tenant and Instance Administration

**Files:**

- Modify: `apps/web/components/admin-client.tsx:88-520`
- Modify: `apps/web/app/styles.css:934-984`
- Modify: `tests/e2e/critical-flow.spec.ts:47-50`

**Interfaces:**

- Consumes: existing `/admin/*` responses and shared Editorial Intelligence tokens.
- Preserves: tenant member, connector, policy, audit, queue, instance user, support grant, and metadata-only support operations.
- Produces: role-aware heading `Instance operations` when `overview.instance` exists; otherwise `Workspace administration`.

- [ ] **Step 1: Change the critical-flow expectation first**

Replace the current admin heading assertion with:

```ts
await page.goto('/admin');
await expect(page.getByRole('heading', { name: 'Instance operations' })).toBeVisible();
const adminA11y = await new AxeBuilder({ page }).analyze();
expect(adminA11y.violations).toEqual([]);
```

- [ ] **Step 2: Run the critical flow and confirm the heading failure**

With the API, database, worker, and port-3001 web app running:

```powershell
$env:E2E_WEB_ORIGIN='http://localhost:3001'; rtk pnpm exec playwright test tests/e2e/critical-flow.spec.ts --grep "registers"
```

Expected: FAIL at the admin heading because the current page says `System control`.

- [ ] **Step 3: Make the admin heading and hierarchy role-aware**

Derive the title from the already-loaded overview:

```tsx
const adminTitle = overview?.instance ? 'Instance operations' : 'Workspace administration';
```

Replace `dashboard-main admin-main`, `dashboard-header`, `panel`, `metric-grid`, and `data-list` visual classes with `editorial-admin`, `admin-header`, `admin-section`, `admin-metrics`, and `admin-records`. Keep all existing forms, confirmation prompts, API calls, and destructive-action wording unchanged.

Order the content as:

1. Tenant metrics
2. Instance health, queue, and instance users when `overview.instance` exists
3. Workspace policy and export/deletion controls
4. Privacy-preserving support grants and metadata preview
5. Members, audit trail, and connectors

Keep the sentence stating that support access exposes operational metadata only and never prompt or analysis content. Do not add a cross-tenant prompt request because no authorized endpoint currently produces it.

- [ ] **Step 4: Apply the shared editorial styling**

Use paper backgrounds, ink separators, acid active/success accents, and signal-orange destructive warnings. Use compact responsive records instead of card grids. Instance operations may use a black header band but no glow. At widths below `760px`, stack record actions below their labels without changing DOM order.

- [ ] **Step 5: Run the critical flow and web typecheck**

```powershell
$env:E2E_WEB_ORIGIN='http://localhost:3001'; rtk pnpm exec playwright test tests/e2e/critical-flow.spec.ts --grep "registers"
rtk pnpm --filter @promptlens/web typecheck
```

Expected: critical flow PASS including axe scan; typecheck PASS.

- [ ] **Step 6: Commit the admin redesign**

```powershell
rtk git add -- apps/web/components/admin-client.tsx apps/web/app/styles.css tests/e2e/critical-flow.spec.ts
rtk git commit -m "feat(web): redesign tenant and instance admin"
```

---

### Task 6: States, Mobile Navigation, and Accessibility Verification

**Files:**

- Modify: `apps/web/components/dashboard-client.tsx:318-1016`
- Modify: `apps/web/app/styles.css`
- Modify: `tests/e2e/editorial-ui.spec.ts`

**Interfaces:**

- Consumes: all page landmarks and role-aware mock routes from Tasks 1-4.
- Produces: visible empty-state action, `role="alert"` errors, `aria-busy` loading state, and native mobile menu.

- [ ] **Step 1: Add failing state, mobile, and accessibility tests**

```ts
test('empty prompt results offer a clear reset action', async ({ page }) => {
  await page.goto('/dashboard/prompts?mock=1');
  await page.getByLabel('Search prompts').fill('no-result-query');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByText('No prompts match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('button', { name: 'Open analysis' }).first()).toBeVisible();
});

test('mobile dashboard navigation and accessibility remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/overview?mock=1&mockRole=user');
  await page.getByText('Menu', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'Prompt log' }).last()).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('reduced motion disables decorative animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const duration = await page
    .locator('.landing-product-preview')
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(duration === '0s' || duration === '0.01ms').toBeTruthy();
});
```

- [ ] **Step 2: Run state tests and confirm failure**

```powershell
$env:E2E_WEB_ORIGIN='http://localhost:3001'; rtk pnpm exec playwright test tests/e2e/editorial-ui.spec.ts --grep "empty prompt|mobile dashboard|reduced motion"
```

Expected: at least the empty reset action and reduced-motion assertion FAIL.

- [ ] **Step 3: Add minimal loading, empty, and error states**

While `actor` is null, mark the dashboard main surface `aria-busy="true"` and render fixed-height skeleton rows. For prompt filters with zero results, render:

```tsx
<div className="editorial-empty">
  <strong>No prompts match these filters.</strong>
  <p>Clear the filters or broaden your search.</p>
  <button type="button" onClick={clearPromptFilters}>
    Clear filters
  </button>
</div>
```

Implement one reset function:

```tsx
function clearPromptFilters() {
  setQuery('');
  setProjectFilter('');
  setPlatformFilter('');
  setModelFilter('');
  setMinScoreFilter('');
  setMemberFilter('');
  replaceDashboardQuery({
    q: null,
    projectId: null,
    platform: null,
    model: null,
    minScore: null,
    userId: null,
    promptId: null,
  });
}
```

Render API errors as `<div className="editorial-error" role="alert">` with the existing message and a `Retry` button calling `load`. Keep ink text on signal orange.

- [ ] **Step 4: Complete native responsive and motion rules**

At desktop widths, show `.editorial-sidebar` and hide `.mobile-navigation`. Below `900px`, hide the sidebar, show the native `<details>` menu, stack KPI/panel grids, and keep all controls at least 44px high. Add:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Run focused and full web verification**

```powershell
$env:E2E_WEB_ORIGIN='http://localhost:3001'; rtk pnpm exec playwright test tests/e2e/editorial-ui.spec.ts
rtk pnpm --filter @promptlens/web lint
rtk pnpm --filter @promptlens/web typecheck
rtk pnpm --filter @promptlens/web test
rtk pnpm --filter @promptlens/web build
```

Expected: all commands PASS. If the local shell does not satisfy the repository's exact Node/pnpm engine range, switch to Node 22.14+ and pnpm 10.14+ before interpreting failures as product defects.

- [ ] **Step 6: Run viewport smoke checks on port 3001**

Open and inspect these routes at widths 390px, 768px, and 1440px:

```text
http://localhost:3001/
http://localhost:3001/login
http://localhost:3001/dashboard/overview?mock=1
http://localhost:3001/dashboard/overview?mock=1&mockRole=user
http://localhost:3001/dashboard/prompts?mock=1
http://localhost:3001/dashboard/projects?mock=1
```

Expected: no horizontal overflow; mobile navigation is operable; the workbench stacks in source order; error and signal text remain readable; no dashboard panel uses glow.

- [ ] **Step 7: Commit final UI hardening**

```powershell
rtk git add -- apps/web/components/dashboard-client.tsx apps/web/app/styles.css tests/e2e/editorial-ui.spec.ts
rtk git commit -m "test(web): verify editorial UI states"
```

---

## Final Acceptance

After all task commits:

```powershell
rtk git status --short
rtk git log -5 --oneline
```

Expected: clean working tree and six focused implementation commits. The mock dashboard must demonstrate member and owner/admin views; production data remains constrained by the existing authenticated API, authorization checks, and tenant RLS.
