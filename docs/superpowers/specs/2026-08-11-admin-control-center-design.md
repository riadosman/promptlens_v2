# PromptLens Admin — Balanced Control Center Design

## Goal

Refresh the administrator area into a professional SaaS control center that combines workspace and instance administration without making the interface feel operationally dense. Preserve all existing admin actions and permissions; this document defines the presentation and information hierarchy only.

## Chosen direction

Use a balanced control-center layout:

- A restrained left navigation for moving between administration areas.
- A clear top bar with the current scope, administrator role, and account controls.
- An overview surface that puts health and activity ahead of configuration.
- Role-aware modules: workspace administrators see tenant controls, while instance administrators also see platform operations.
- Tables and compact status rows for detailed management instead of oversized cards.

The result should feel like a calm command center: quick to scan, easy to act on, and visually continuous with the landing page.

## Visual system

- App surface: `#f5f7f4`.
- Primary ink: `#14231b`.
- Muted text: `#74847a`.
- Accent/action green: `#167448`.
- Soft border: `#d4dfd7`.
- Subtle success surface: `#e8f2eb`.
- Use white or near-white surfaces only for elevated content regions.
- Keep corners restrained at roughly 8–12px; avoid floating-dashboard excess.
- Use the same left/right content alignment as the landing header logo padding.

## Information architecture

### Primary navigation

The left rail contains:

- Overview
- Members
- Projects
- Prompts
- Connectors
- Audit log
- Settings

Instance-only entries such as Operations, Queue, or Instance users are shown only when the current administrator has the required role.

The active item uses the green accent and a quiet tinted background. Navigation should collapse into a drawer on small screens.

### Top bar

The top bar contains:

- Page title: `Administration`.
- Scope selector or workspace name.
- Optional `Instance admin` or `Workspace admin` role label.
- Account/profile menu.

The top bar remains visually light, with a thin bottom border rather than a heavy header card.

### Overview composition

```text
┌──────────────────────────────────────────────────────────────┐
│ Administration       Workspace: PromptLens     Admin profile │
├──────────────┬───────────────────────────────────────────────┤
│ Overview     │ KPI row: Members  Projects  Prompts  Analyses  │
│ Members      │                                               │
│ Projects    │ Recent activity              System status      │
│ Prompts     │ compact table                queue/connectors   │
│ Connectors  │                                               │
│ Audit log   │ Management modules: people · access · policy   │
│ Settings    │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

The KPI row should show the most useful current values without turning every metric into a separate visual island. Each metric includes a short label, value, and optional small trend/status detail.

### Activity and status

The main content area uses two columns on desktop:

- Recent activity: actor, action, target, time, and result.
- System status: connector health, queue state, pending support access, or unpublished events when available.

Empty states should explain what is missing and provide one clear next action. Error states should remain inline and actionable.

### Management modules

Below the overview, show compact module entry points for:

- Members and roles.
- Workspace policy and settings.
- Connectors and access revocation.
- Support access requests.
- Instance operations, queue retry, and instance users for instance administrators.

These modules should open the existing management flows or route destinations; the redesign must not invent new permission behavior.

## Interaction and accessibility

- Preserve all current admin actions, API calls, permissions, loading states, and error messages.
- Keep keyboard navigation logical from navigation to page content and then to tables/actions.
- Use visible green focus rings with sufficient contrast.
- Status must not rely on color alone; include text such as `Healthy`, `Pending`, or `Failed`.
- Destructive actions such as revoke, remove, disable, and deletion scheduling require the existing confirmation flow.
- Tables should remain usable at narrow widths through responsive stacking or horizontal scrolling.
- Do not add decorative motion that delays administrative work.

## Responsive behavior

- Desktop: fixed or sticky left rail, top bar, two-column overview.
- Tablet: narrower rail and a single-column activity/status stack when needed.
- Mobile: drawer navigation, stacked metrics, single-column modules, and horizontally scrollable data tables where row context requires it.
- Maintain the shared landing-page content gutter at every breakpoint.

## Scope

In scope: admin shell layout, navigation, overview hierarchy, metric treatment, activity/status composition, module presentation, responsive behavior, and landing-palette alignment.

Out of scope: backend/API changes, authorization policy changes, new admin capabilities, data model changes, and publishing or pushing changes.

## Verification

- Preserve and verify all existing admin routes and actions.
- Run web lint, typecheck, and production build after implementation.
- Check workspace-admin and instance-admin visibility separately.
- Inspect desktop, tablet, and mobile layouts.
- Verify keyboard focus, status text, empty states, and destructive-action confirmations.
