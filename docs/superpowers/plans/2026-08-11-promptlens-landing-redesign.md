# PromptLens Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public PromptLens landing page as a clean SaaS-first experience for developers, product teams, and design teams.

**Architecture:** Keep the landing page in the existing `apps/web/app/page.tsx` and shared `apps/web/app/styles.css`; do not add a component abstraction for a single page. Preserve `/login` and `/register` links and avoid touching auth/dashboard code.

**Tech Stack:** Next.js 16, React 19, TypeScript, plain CSS, existing workspace dependencies.

## Global Constraints

- Clean SaaS-first layout with a light, calm surface and dark ink typography.
- Green is the primary product accent, reserved for action, status, and quality signals.
- Use existing CSS and installed dependencies; add no new UI library or animation package.
- Primary CTA is `Create your workspace` and opens `/register`.
- Secondary sign-in action opens `/login`.
- Support visible keyboard focus, semantic headings/links, mobile single-column layout, and `prefers-reduced-motion`.
- Do not alter auth or dashboard behavior.

### Task 1: Replace landing page structure and copy

**Files:**
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Produces the semantic page sections and links styled by Task 2.
- Keeps the existing `capabilities` data local to the page or replaces it with explicit section content; no new shared component API.

- [ ] **Step 1: Write the landing markup**

Replace the current three-capability-only body with these semantic regions in order:

```tsx
<main className="landing-shell">
  <nav className="landing-nav" aria-label="Primary navigation">...</nav>
  <section className="landing-hero" aria-labelledby="hero-title">...</section>
  <section className="proof-strip" aria-label="Prompt workflow">...</section>
  <section className="workflow-section" aria-labelledby="workflow-title">...</section>
  <section className="feature-grid" aria-label="PromptLens capabilities">...</section>
  <section className="landing-final-cta" aria-labelledby="final-cta-title">...</section>
  <footer className="landing-footer">...</footer>
</main>
```

Use the approved copy: hero heading `Turn every prompt into team knowledge.`, CTA `Create your workspace`, workflow labels `Capture`, `Understand`, `Improve`, `Reuse`, and final CTA `Your next great prompt shouldn’t disappear.`. Keep copy plain and active.

- [ ] **Step 2: Add the analysis preview content**

Build the right side of the hero with static semantic HTML: a small status label, the sample prompt, a `92 / 100` score, a progress bar with `aria-label="Prompt quality score"`, and two recommendation cells: `Clear outcome` and `Add constraints`.

- [ ] **Step 3: Verify the page markup locally**

Run `pnpm --filter @promptlens/web typecheck`.

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: reshape landing page content"
```

### Task 2: Implement the clean SaaS visual system

**Files:**
- Modify: `apps/web/app/styles.css` around the existing landing selectors and responsive media queries.

**Interfaces:**
- Consumes the class names from Task 1.
- Produces responsive visual styling without changing auth/dashboard selectors.

- [ ] **Step 1: Define landing-only tokens**

Add or revise the existing root values for a light landing surface while keeping auth/dashboard colors stable through landing-specific selectors where necessary. Use dark ink, muted slate, calm off-white surfaces, and green for CTA/status/score.

- [ ] **Step 2: Style navigation and hero**

Use a centered max-width shell, compact nav, two-column desktop hero, and one-column mobile hero. Make the hero preview card clean and dashboard-like rather than rotated or heavily glowing. Keep the CTA high contrast and the secondary link visually quieter.

- [ ] **Step 3: Style proof strip, workflow, feature grid, CTA, and footer**

Use simple borders, restrained radius, generous whitespace, and a consistent card rhythm. The proof strip should read as a horizontal product vocabulary; workflow cards should communicate a real sequence; feature cards should not use decorative numbering unless the content order needs it.

- [ ] **Step 4: Add interaction and accessibility rules**

Add `:focus-visible` styles for landing links, restrained hover elevation for cards/buttons, a short status transition for the preview if implemented in CSS, and an existing/new `@media (prefers-reduced-motion: reduce)` rule that removes transforms and transitions.

- [ ] **Step 5: Verify responsive CSS**

Run `pnpm --filter @promptlens/web lint` and `pnpm --filter @promptlens/web typecheck`.

Expected: PASS with no lint or type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/styles.css
git commit -m "feat: apply clean SaaS landing styles"
```

### Task 3: Verify the complete landing flow

**Files:**
- Modify: none unless verification finds a concrete issue.
- Test: existing `tests/e2e/critical-flow.spec.ts` if the landing route is covered.

**Interfaces:**
- Validates the public route and its existing auth destinations.

- [ ] **Step 1: Build the web app**

Run `pnpm --filter @promptlens/web build`.

Expected: PASS and a successful Next.js production build.

- [ ] **Step 2: Run the existing web tests**

Run `pnpm --filter @promptlens/web test`.

Expected: PASS; no new landing-specific test framework or fixture is added.

- [ ] **Step 3: Check the route and links**

Start the web app with the repository’s normal dev command, open `/`, and verify at desktop and mobile widths that `/register`, `/login`, and `How it works` resolve or scroll to their intended targets. Use keyboard Tab navigation to confirm visible focus.

- [ ] **Step 4: Commit verification-only fixes if needed**

```bash
git add apps/web/app/page.tsx apps/web/app/styles.css
git commit -m "fix: polish landing verification issues"
```

Only create this commit if verification found and fixed a concrete issue.
