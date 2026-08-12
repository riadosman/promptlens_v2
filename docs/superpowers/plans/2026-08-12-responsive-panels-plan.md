# Responsive User and Administration Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all user-panel and Administration routes usable at desktop, tablet, and mobile widths with the approved fluid-desktop layout.

**Architecture:** Keep existing React components, data flow, routes, and visual tokens. Add a focused responsive layer to the shared stylesheet, using existing class names first and adding only small semantic hooks where a layout needs a distinct mobile treatment.

**Tech Stack:** Next.js App Router, React, TypeScript, existing CSS, existing Playwright/browser verification setup.

## Global Constraints

- User panel scope is Overview, Prompt Log, Projects, and Connect device.
- Administration scope is Overview, Members, Audit, Connectors, Settings, and Support requests.
- No API, database, routing, or permission changes.
- Desktop keeps the existing left rail and spacious content layout.
- Page-level horizontal overflow is not allowed.
- Preserve semantic navigation, headings, labels, and table/list meaning.

### Task 1: Stabilize the shared responsive shell

**Files:**
- Modify: `apps/web/app/styles.css`

**Interfaces:**
- Existing `.dashboard-shell-v2`, `.v2-rail`, `.v2-main`, `.v2-header`, and navigation markup remain the public layout contract.

- [ ] At approximately `980px`, reduce main padding, header gaps, and multi-column minimum widths without changing desktop values.
- [ ] At approximately `760px`, make `.dashboard-shell-v2` a single-column flow, turn `.v2-rail` into a full-width horizontal navigation row, and keep nav links unwrapped/scrollable.
- [ ] At approximately `560px`, reduce page padding, stack header metadata, and keep sign-out/workspace controls reachable below navigation.
- [ ] Add `min-width: 0`, `overflow-wrap: anywhere`, and bounded text rules to shared content containers so IDs, user agents, and long labels cannot create page overflow.
- [ ] Preserve visible focus outlines and touch-friendly button heights.

### Task 2: Make user-panel sections fluid

**Files:**
- Modify: `apps/web/app/styles.css`
- Modify: `apps/web/components/connect-device.tsx` only if a small class hook is required for mobile action layout

**Interfaces:**
- Existing routes and components keep their current props, API calls, and state behavior.

- [ ] Collapse Overview analytics, KPI, insight, session, and pagination layouts into readable single-column flows at narrow widths.
- [ ] Keep Prompt Log filters full-width and stack export/actions without clipping; keep table header/body readable in the available width.
- [ ] Stack Projects create fields, featured-project actions, project rows, and pagination while preserving visible action text/icons.
- [ ] Keep Connect device progress, form fields, summary, select, and action buttons inside the viewport at tablet/mobile widths.
- [ ] Ensure no user-panel route creates document-level horizontal scrolling at 1280px, 900px, 760px, and 390px widths.

### Task 3: Make Administration sections fluid

**Files:**
- Modify: `apps/web/app/styles.css`
- Modify: `apps/web/components/admin-client.tsx` only when an existing section lacks a selector needed for a safe responsive rule

**Interfaces:**
- Existing Administration section selection, forms, pagination, and action handlers remain unchanged.

- [ ] Collapse `.admin-columns` to one column at tablet/mobile widths.
- [ ] Stack member role/remove controls, connector actions, support actions, queue retry actions, and instance-user actions to full-width controls.
- [ ] Stack list toolbars and make search/select inputs full-width while keeping result counts visible.
- [ ] Convert dense audit/member/connector/support/operations rows to readable stacked rows with labels/statuses still visually associated.
- [ ] Collapse settings grids and action groups without hiding save, reset, or security actions.

### Task 4: Verify responsive behavior

**Files:**
- No new files unless an existing test needs a focused selector.

- [ ] Run `pnpm --filter @promptlens/web lint` and `pnpm --filter @promptlens/web typecheck`.
- [ ] Run the web build and inspect `/dashboard/overview`, `/dashboard/prompts`, `/dashboard/projects`, `/connect`, `/admin`, and representative Administration subsections at desktop/tablet/mobile widths.
- [ ] Confirm page-level horizontal overflow is absent and intentional data regions remain usable.
- [ ] Refresh the Docker web image, verify the web endpoint, and commit the responsive implementation as one focused feature commit.
