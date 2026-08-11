# Admin Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the approved Balanced Control Center design to the existing PromptLens administrator screen while preserving all current admin behavior, APIs, and permissions.

**Architecture:** Keep the existing `AdminClient` data loading and action handlers intact, but reorganize its rendered UI into a responsive admin shell with a left navigation rail, top scope bar, overview metrics, activity/status panels, and compact management sections. Add narrowly scoped admin styles in `apps/web/app/styles.css`; do not change backend contracts or authorization logic.

**Tech Stack:** Next.js App Router, React client component, TypeScript, existing CSS system, pnpm, Docker Compose.

## Global Constraints

- Preserve all current admin actions, API calls, permissions, loading states, and error messages.
- Use landing palette values: `#f5f7f4`, `#14231b`, `#74847a`, `#167448`, and `#d4dfd7`.
- Keep corners restrained at roughly 8–12px; avoid oversized floating-card treatment.
- Use the same left/right content alignment as the landing header logo padding.
- Status must not rely on color alone; include text such as `Healthy`, `Pending`, or `Failed`.
- Do not change backend/API behavior, authorization policy, data models, or publish/push changes.

---

### Task 1: Create the admin shell and navigation structure

**Files:**
- Modify: `apps/web/components/admin-client.tsx` in the returned JSX around the current `<main className="dashboard-main admin-main">` block.
- Modify: `apps/web/app/styles.css` in a new `.control-center-*` style section.

**Interfaces:**
- Consumes: existing `overview`, `settings`, `error`, and current admin action handlers.
- Produces: stable shell classes for the overview and management sections.

- [ ] **Step 1: Replace the old admin header wrapper with the control-center shell**

Use this structure while keeping the existing data and handlers available:

```tsx
<main className="control-center admin-main">
  <aside className="control-center-rail" aria-label="Administration navigation">
    <Link className="control-center-wordmark" href="/dashboard">PromptLens</Link>
    <p className="control-center-rail-label">Administration</p>
    <nav className="control-center-nav">
      <a className="is-active" href="#overview">Overview</a>
      <a href="#members">Members</a>
      <a href="#workspace-policy">Settings</a>
      <a href="#connectors">Connectors</a>
      <a href="#audit">Audit log</a>
    </nav>
    {overview?.instance ? (
      <div className="control-center-instance-links">
        <p className="control-center-rail-label">Instance</p>
        <a href="#queue">Operations</a>
        <a href="#instance-users">Instance users</a>
      </div>
    ) : null}
    <Link className="control-center-back" href="/dashboard">Back to dashboard</Link>
  </aside>
  <div className="control-center-content">
    {/* top bar and existing sections */}
  </div>
</main>
```

- [ ] **Step 2: Add the top bar inside `.control-center-content`**

Include the page title, current scope, and role context without inventing new data:

```tsx
<header className="control-center-topbar">
  <div>
    <p className="eyebrow">Administration</p>
    <h1>Control center</h1>
  </div>
  <div className="control-center-scope">
    <span>{settings?.name ?? 'Workspace'}</span>
    <span className="control-center-role">{overview?.instance ? 'Instance admin' : 'Workspace admin'}</span>
  </div>
</header>
```

- [ ] **Step 3: Add desktop, tablet, and mobile shell styles**

Use a two-column grid above 1100px, collapse the rail above the existing mobile breakpoint, and keep the shared content gutter. The mobile rail becomes a horizontally scrollable navigation row; no existing admin content is hidden.

- [ ] **Step 4: Run the web lint and typecheck**

Run: `pnpm run lint` and `pnpm run typecheck` from `apps/web`.

Expected: both commands exit with code 0.

---

### Task 2: Recompose the overview metrics and status surfaces

**Files:**
- Modify: `apps/web/components/admin-client.tsx` around the current metric grid and instance-health section.
- Modify: `apps/web/app/styles.css` in the `.control-center-*` section.

**Interfaces:**
- Consumes: existing `overview.tenant` and `overview.instance` values.
- Produces: `#overview` metric row and status grid without changing values or API calls.

- [ ] **Step 1: Add the overview anchor and metric heading**

Wrap the current tenant metrics in:

```tsx
<section className="control-center-section" id="overview" aria-labelledby="overview-title">
  <div className="control-center-section-heading">
    <div>
      <p className="eyebrow">Workspace overview</p>
      <h2 id="overview-title">Signals at a glance</h2>
    </div>
    <span className="control-center-status">Live data</span>
  </div>
  <div className="control-center-metrics">{/* existing AdminMetric items */}</div>
</section>
```

- [ ] **Step 2: Convert instance metrics into a compact system-status panel**

Keep the same four values, but label the panel `System status` and add explicit text labels (`Healthy`, `Queued`, `Pending`) next to values where appropriate. Do not infer or modify backend state; use the existing metric labels and values.

- [ ] **Step 3: Add a two-column overview support row**

Place the existing audit list and connector list in the overview flow using the same data arrays. The row must stack at tablet/mobile widths and use `minmax(0, 1fr)` columns.

- [ ] **Step 4: Verify the overview with empty and loading-safe values**

Confirm that `overview === null`, an empty connector list, and an empty audit list still render without exceptions or overflow.

---

### Task 3: Reorganize management sections and preserve actions

**Files:**
- Modify: `apps/web/components/admin-client.tsx` sections for policy, support, queue, instance users, members, audit, and connectors.
- Modify: `apps/web/app/styles.css` for management cards, data rows, forms, and responsive behavior.

**Interfaces:**
- Consumes: existing forms, `load`, and all current action handlers.
- Produces: anchored management sections `#workspace-policy`, `#members`, `#audit`, `#connectors`, `#queue`, and `#instance-users`.

- [ ] **Step 1: Add stable section IDs and headings**

Add IDs to the existing sections and use concise section headings: `Workspace policy`, `Members and roles`, `Audit log`, `Connectors`, `Operations queue`, and `Instance users`.

- [ ] **Step 2: Keep each current action in its original section**

Preserve add member, role changes, removal, connector revoke, settings update, export, deletion scheduling, support approval/revoke, metadata view, queue retry, and user suspend/reactivate behavior. Only move wrappers and visual grouping.

- [ ] **Step 3: Use compact rows instead of oversized cards**

Keep `.data-list` as the row primitive, but add a control-center modifier so each row has a readable primary column, secondary metadata, status text, and action area. Long IDs, emails, reasons, and metadata must use `overflow-wrap: anywhere`.

- [ ] **Step 4: Make forms responsive**

On narrow screens, stack policy inputs and inline forms to one column. Buttons should use `width: 100%` only inside the mobile control-center form/action context; do not alter auth or landing button behavior.

- [ ] **Step 5: Verify action wiring by typecheck**

Run: `pnpm run lint` and `pnpm run typecheck` from `apps/web`.

Expected: both commands exit with code 0 and no handler is removed from the component.

---

### Task 4: Validate the responsive admin experience

**Files:**
- Modify: `apps/web/app/styles.css` only if validation finds a concrete responsive defect.

**Interfaces:**
- Consumes: completed control-center shell and section anchors.
- Produces: verified desktop, tablet, and mobile admin layout.

- [ ] **Step 1: Run the production build**

Run: `pnpm run build` from `apps/web`.

Expected: Next.js production build exits with code 0.

- [ ] **Step 2: Rebuild the web container**

Run from the repository root:

```powershell
docker compose --env-file .env -p promptlens-platform -f infra/compose/compose.full.yaml up -d --build --no-deps web
docker compose --env-file .env -p promptlens-platform -f infra/compose/compose.full.yaml ps web
```

Expected: `promptlens-platform-web-1` is `Up` and exposes `127.0.0.1:3001->3000/tcp`.

- [ ] **Step 3: Check route availability**

Request `http://localhost:3001/admin` and confirm an HTTP 200 response.

- [ ] **Step 4: Perform the visual checklist**

Check the admin page at desktop width, tablet width, and a 360–390px mobile width. Confirm:

- rail/navigation remains reachable;
- metrics do not overflow;
- long emails, UUIDs, reasons, and metadata wrap or scroll inside their own region;
- tables/data rows remain readable;
- workspace-admin view does not show instance-only sections;
- instance-admin view shows queue and instance-user sections;
- destructive action buttons retain their existing confirmation behavior.

- [ ] **Step 5: Review the final diff and leave changes uncommitted unless requested**

Run: `git diff --check` and `git status --short`.

Do not push or merge. Preserve unrelated generated changes such as `apps/web/tsconfig.tsbuildinfo`.

---

### Task 5: Split admin modules into route-aware pages

**Files:**
- Modify: `apps/web/app/admin/page.tsx` to keep the overview route.
- Create: `apps/web/app/admin/[section]/page.tsx` for focused admin modules.
- Modify: `apps/web/components/admin-client.tsx` to accept the current section and render the matching module.
- Modify: `apps/web/app/styles.css` only for active navigation and route-specific responsive adjustments.

**Interfaces:**
- Consumes: the shared control-center shell, existing admin APIs, and current action handlers.
- Produces: `/admin`, `/admin/members`, `/admin/settings`, `/admin/connectors`, `/admin/audit`, `/admin/support`, `/admin/operations`, and `/admin/instance-users`.

- [ ] **Step 1: Add route metadata to `AdminClient`**

Add an optional `section` prop with the union `'overview' | 'members' | 'settings' | 'connectors' | 'audit' | 'support' | 'operations' | 'instance-users'`, defaulting to `'overview'`. Use it to mark the matching sidebar item with `aria-current="page"` and `is-active`.

- [ ] **Step 2: Make sidebar items use `Link` routes**

Replace hash anchors with Next `Link` elements pointing to the exact routes listed in the design spec. Instance-only links remain conditional on `overview?.instance`.

- [ ] **Step 3: Render focused content by section**

Keep the current overview metrics on `/admin`. On focused routes, render only the corresponding existing panel and its actions: members, settings, connectors, audit, support, operations, or instance users. Do not duplicate API functions or alter request payloads.

- [ ] **Step 4: Add the dynamic route page**

Read the `[section]` parameter, validate it against the union, and render `AdminClient section={section}`. For unsupported sections, call `notFound()`.

- [ ] **Step 5: Verify all routes and build**

Run from `apps/web`: `pnpm run lint`, `pnpm run typecheck`, and `pnpm run build`.

Expected: all commands exit with code 0 and every route appears in the Next.js route output.
