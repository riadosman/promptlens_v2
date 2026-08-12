# Dashboard Overview Signal Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the approved Signal Command Center redesign to `/dashboard/overview` while preserving its existing data, loading, and session behaviors.

**Architecture:** Keep the current `DashboardClient` and `stats`/`sessions` data flow. Refine only the Overview JSX hierarchy and its scoped `.dashboard-shell-v2` styles; Prompts and Projects remain untouched.

**Tech Stack:** Next.js, React, TypeScript, CSS, pnpm scripts.

## Global Constraints

- Existing `stats` and `sessions` values remain the source of truth.
- No new API endpoints or data models.
- Preserve loading, empty, error, keyboard focus, reduced-motion, and responsive behavior.
- Fewest files possible: `apps/web/components/dashboard-client.tsx` and `apps/web/app/styles.css`.

### Task 1: Reshape the Overview markup

**Files:**
- Modify: `apps/web/components/dashboard-client.tsx:804-879`

**Interfaces:**
- Consumes: existing `stats`, `sessions`, `visibleSessions`, `revokeSession`, and `Distribution` values/components.
- Produces: the same rendered data with explicit Signal Command Center structure.

- [ ] **Step 1: Replace only the Overview analytics wrapper markup**

  Keep the score panel, three KPI values, score trend mapping, model/project distributions, and recent sessions actions. Add semantic wrapper classes for the approved hierarchy: score anchor, KPI rail, trend panel, insight panel, and activity panel. Do not change API calls or non-Overview branches.

- [ ] **Step 2: Preserve empty and loading states**

  Keep `OverviewPanelSkeleton`, the `No completed analyses yet.` fallback, and all session pagination/revoke controls intact.

- [ ] **Step 3: Run the web typecheck**

  Run: `pnpm --filter @promptlens/web typecheck`
  Expected: PASS, or the repository’s existing equivalent if the package exposes a different script.

- [ ] **Step 4: Commit the markup change**

  ```bash
  git add apps/web/components/dashboard-client.tsx
  git commit -m "feat: reshape dashboard overview hierarchy"
  ```

### Task 2: Apply the visual system and responsive layout

**Files:**
- Modify: `apps/web/app/styles.css:3716-4146`

**Interfaces:**
- Consumes: the Overview classes emitted by Task 1 and existing `v2-*` tokens.
- Produces: responsive Signal Command Center presentation.

- [ ] **Step 1: Style the score anchor**

  Keep the dark evergreen `#14231b` panel, mint `#8fd2a8` meter, restrained border, and readable `/100` treatment. Ensure the score panel is visually dominant without adding a new dependency or asset.

- [ ] **Step 2: Style the KPI rail and trend panel**

  Use the existing warm palette (`#f0eee9`, `#fffdf8`), low-contrast borders, and lavender chart bars. Preserve the existing 14-day values and hover score labels.

- [ ] **Step 3: Style insight distributions and activity**

  Keep `Distribution` reusable for Models and Projects. Make the recent sessions section visually subordinate but readable, with the existing controls and focus states.

- [ ] **Step 4: Verify responsive behavior**

  Run: `pnpm --filter @promptlens/web build`
  Expected: PASS with no horizontal overflow introduced by the Overview layout at desktop, tablet, and mobile widths.

- [ ] **Step 5: Commit the styles**

  ```bash
  git add apps/web/app/styles.css
  git commit -m "feat: apply signal command center overview styles"
  ```

### Task 3: Final verification

**Files:**
- Test: existing web build and dashboard E2E coverage.

- [ ] **Step 1: Run dashboard-critical tests**

  Run: `pnpm exec playwright test tests/e2e/critical-flow.spec.ts`
  Expected: PASS, or report an environment-only failure separately.

- [ ] **Step 2: Check the final diff**

  Run: `git diff HEAD~2..HEAD --stat; git status --short`
  Expected: only the approved Overview component/style changes are present and the worktree is clean aside from intentional local preview artifacts.
