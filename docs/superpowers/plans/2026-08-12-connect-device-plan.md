# Connect Device Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the approved two-step Connect device experience inside the existing dashboard shell.

**Architecture:** Extend the existing `DashboardClient` route section with a `connect` section and render the existing `ConnectDevice` component inside it. Keep the current API calls and authentication redirect behavior; add only client-side step state and focused CSS in the existing stylesheet.

**Tech Stack:** Next.js App Router, React, TypeScript, existing PromptLens CSS and API helper.

## Global Constraints

- No new API endpoints, database changes, dependencies, or connector behavior.
- Reuse `ConnectDevice`, `apiRequest`, existing project types, and the dashboard shell.
- Keep the existing cream, dark-green, and mint-line visual system.
- Preserve query-string code and authentication return URLs.

### Task 1: Add dashboard Connect section

**Files:**
- Modify: `apps/web/components/dashboard-client.tsx`
- Modify: `apps/web/app/connect/page.tsx`

**Interfaces:**
- `currentSection(pathname)` produces `'connect'` for `/connect`.
- `DashboardClient` renders the existing shell and a Connect-specific content branch.

- [ ] Add the `connect` section type and title/caption/subline copy.
- [ ] Import `ConnectDevice` and render it only for the connect branch.
- [ ] Replace the standalone auth-card page with the same Suspense-wrapped `DashboardClient` used by dashboard pages.
- [ ] Keep `/connect?code=...` unchanged so `ConnectDevice` can prefill the code.

### Task 2: Implement the two-step interaction

**Files:**
- Modify: `apps/web/components/connect-device.tsx`

**Interfaces:**
- Continue from step one to step two without changing the approval payload.
- Submit `{ userCode: string, projectId: string }` to `/connectors/device/approve`.

- [ ] Add a `step` state with `1 | 2` and keep the existing uppercase code input.
- [ ] In step one, show the code input, temporary-code helper text, and `Continue` action.
- [ ] In step two, show active project selection, selected-code summary, `Back`, and `Connect device`.
- [ ] Keep project loading, unauthenticated, empty-project, API error, and success messages accessible.
- [ ] Add a success state with a `/dashboard/overview` return action.

### Task 3: Style and verify

**Files:**
- Modify: `apps/web/app/styles.css`

- [ ] Add scoped `v2-connect-*` styles for progress, setup panel, code field, summary, status, and responsive layout.
- [ ] Ensure disabled/loading and keyboard focus states remain visible.
- [ ] Run the web typecheck/build and verify `/connect` responds successfully.
- [ ] Check that the existing Overview, Prompt Log, and Projects routes remain unchanged.
- [ ] Commit the implementation as one focused feature commit.
