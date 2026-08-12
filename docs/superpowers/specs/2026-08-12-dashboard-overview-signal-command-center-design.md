# Dashboard Overview — Signal Command Center

## Goal

Refresh the user-facing `/dashboard/overview` page so the workspace health signal is immediately legible, while preserving the existing analytics data and navigation.

## Design direction

Use the selected “Signal Command Center” direction: a calm editorial workspace shell with one dark green score panel as the visual anchor. The score is the first thing users read; supporting metrics, trend, distributions, and sessions follow in a clear operational hierarchy.

## Layout

```text
┌──────────────────────┬───────────────┐
│ Signal quality       │ Prompts       │
│ 82 / 100 + meter     │ Last 7 days   │
│                      │ Analyses      │
├──────────────────────┴───────────────┤
│ Score trend · 14 days                 │
├──────────────────────┬───────────────┤
│ Top signal / insight  │ Models        │
│                       │ Projects      │
└──────────────────────┴───────────────┘
Recent sessions
```

The existing `stats` and `sessions` values remain the source of truth. No new API endpoints or data models are needed.

## Visual system

- Background: existing warm landing palette (`#f0eee9` / `#fffdf8`).
- Signature accent: dark evergreen score panel (`#14231b`) with mint meter (`#8fd2a8`).
- Secondary chart accent: existing lavender (`#9a8cff`).
- Cards: low-contrast borders, restrained radius, no extra gradients or decorative illustrations.
- Preserve the current responsive breakpoints; the analytics grid collapses to one column on narrow screens.

## Component changes

- Update only the Overview branch in `apps/web/components/dashboard-client.tsx` where needed for hierarchy/copy.
- Prefer existing `v2-*` classes and shared `Distribution`, skeleton, and panel patterns.
- Update the related Overview selectors in `apps/web/app/styles.css`; do not alter Prompts or Projects layouts.
- Keep loading, empty, error, keyboard focus, and reduced-motion behavior intact.

## Acceptance checks

- `/dashboard/overview` still renders with live API data and demo data.
- Score, KPI, chart, distributions, and recent sessions remain present.
- Mobile layout remains readable without horizontal overflow.
- Existing dashboard navigation and actions are unchanged.
- Typecheck/build passes after the visual change.
