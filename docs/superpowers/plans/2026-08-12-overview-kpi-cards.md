# Overview KPI Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Overview `Prompts`, `Last 7 days`, and `Analyses` cards distinct visual roles while preserving their existing data and responsive layout.

**Architecture:** Add stable modifier classes to the existing three KPI articles in `dashboard-client.tsx`. Add a final, scoped CSS block in `styles.css` for the three variants, reusing the current palette and existing responsive grid.

**Tech Stack:** React/Next.js, TypeScript, scoped CSS, existing dashboard data.

## Global Constraints

- Keep the existing three-card desktop layout and responsive breakpoints.
- Preserve the existing data contract and accessibility semantics.
- Use CSS-only decoration; add no dependency, data field, chart, or interaction.
- Keep values as the dominant content.

---

### Task 1: Add KPI variant hooks

**Files:**
- Modify: `apps/web/components/dashboard-client.tsx:835-839`

**Interfaces:**
- Consumes: existing `stats.prompts`, `stats.promptsLast7Days`, and `stats.analysesCompleted` values.
- Produces: `.v2-kpi-prompts`, `.v2-kpi-recent`, and `.v2-kpi-analyses` hooks for scoped CSS.

- [ ] **Step 1: Add stable classes without changing content**

```tsx
<article className="v2-kpi-prompts">
  <p>Prompts</p>
  <strong>{stats.prompts}</strong>
  <span>Total captured</span>
</article>
<article className="v2-kpi-recent">
  <p>Last 7 days</p>
  <strong>{stats.promptsLast7Days}</strong>
  <span>Recent activity</span>
</article>
<article className="v2-kpi-analyses">
  <p>Analyses</p>
  <strong>{stats.analysesCompleted}</strong>
  <span>Completed reviews</span>
</article>
```

- [ ] **Step 2: Run the web typecheck**

Run: `pnpm exec tsc -p apps/web/tsconfig.json --noEmit`

Expected: exits successfully with no TypeScript errors.

### Task 2: Style the three KPI roles

**Files:**
- Modify: `apps/web/app/styles.css` at the final dashboard override section

**Interfaces:**
- Consumes: the three modifier classes from Task 1 and existing `.v2-command-kpis` layout.
- Produces: distinct volume, recent-activity, and completion treatments with equal-height cards.

- [ ] **Step 1: Add scoped variant styles**

```css
.dashboard-shell-v2 .v2-command-kpis article {
  position: relative;
  overflow: hidden;
  min-height: 12rem;
  border-top: 3px solid #b7cbbd;
}

.dashboard-shell-v2 .v2-command-kpis article::after {
  content: '';
  position: absolute;
  right: -2rem;
  bottom: -3rem;
  width: 8rem;
  height: 8rem;
  border-radius: 50%;
  background: rgba(22, 116, 72, 0.07);
}

.dashboard-shell-v2 .v2-command-kpis .v2-kpi-prompts {
  border-top-color: #167448;
  background: linear-gradient(145deg, #fffdf8, #edf6ef);
}

.dashboard-shell-v2 .v2-command-kpis .v2-kpi-prompts strong {
  color: #167448 !important;
  font-size: clamp(3rem, 5vw, 4.2rem);
}

.dashboard-shell-v2 .v2-command-kpis .v2-kpi-recent {
  border-top-color: #9a8cff;
  background: linear-gradient(145deg, #fffdf8, #f1efff);
}

.dashboard-shell-v2 .v2-command-kpis .v2-kpi-recent::after {
  background: rgba(154, 140, 255, 0.12);
}

.dashboard-shell-v2 .v2-command-kpis .v2-kpi-recent strong {
  color: #6658c7 !important;
}

.dashboard-shell-v2 .v2-command-kpis .v2-kpi-analyses {
  border-top-color: #75b995;
  background: linear-gradient(145deg, #fffdf8, #f2f7f3);
}

.dashboard-shell-v2 .v2-command-kpis .v2-kpi-analyses::after {
  background: rgba(117, 185, 149, 0.12);
}

.dashboard-shell-v2 .v2-command-kpis .v2-kpi-analyses strong {
  color: #285f48 !important;
}
```

- [ ] **Step 2: Preserve compact mobile cards**

```css
@media (max-width: 560px) {
  .dashboard-shell-v2 .v2-command-kpis article {
    min-height: 8.5rem;
  }
}
```

- [ ] **Step 3: Run formatting and diff checks**

Run: `pnpm exec prettier --check apps/web/components/dashboard-client.tsx apps/web/app/styles.css` and `git diff --check`

Expected: no diff errors; if Prettier reports an existing stylesheet warning, verify the new block itself has valid formatting.

### Task 3: Verify the completed change

**Files:**
- Verify: `apps/web/components/dashboard-client.tsx`
- Verify: `apps/web/app/styles.css`

- [ ] **Step 1: Confirm the three hooks and no new dependencies**

Run: `rg -n "v2-kpi-(prompts|recent|analyses)" apps/web/components/dashboard-client.tsx apps/web/app/styles.css`

Expected: each hook appears in the component and its corresponding CSS rules appear in the stylesheet.

- [ ] **Step 2: Run the web typecheck again**

Run: `pnpm exec tsc -p apps/web/tsconfig.json --noEmit`

Expected: exits successfully with no TypeScript errors.

- [ ] **Step 3: Commit the implementation**

```bash
git add apps/web/components/dashboard-client.tsx apps/web/app/styles.css
git commit -m "feat: differentiate overview KPI cards"
```
