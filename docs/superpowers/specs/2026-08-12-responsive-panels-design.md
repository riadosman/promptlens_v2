# Responsive User and Administration Panels — Design Spec

## Goal

Make every user-panel and Administration screen usable on tablet and mobile while preserving the current desktop visual language and behavior.

## Scope

- User panel: Overview, Prompt Log, Projects, and Connect device.
- Administration: Overview, Members, Audit, Connectors, Settings, and Support requests.
- No API, database, routing, or permission changes.

## Responsive direction

Use the approved **A — fluid desktop** approach:

- Desktop keeps the existing left rail and spacious content layout.
- Tablet reduces rail/content spacing and collapses multi-column sections as needed.
- Mobile changes the left rail into a compact horizontal navigation row that can scroll without wrapping or clipping.
- Existing cream, dark-green, mint-line palette and typography remain unchanged.

## Layout rules

- Dashboard cards collapse from grids to one readable column on narrow screens.
- KPI and analytics cards keep their hierarchy instead of shrinking text below readable sizes.
- Prompt and Administration tables become stacked rows/cards when columns no longer fit.
- Filters and action groups switch from inline rows to full-width vertical groups.
- Pagination controls remain visible and reachable below the content.
- Long labels, user agents, IDs, and status text wrap or truncate within their container.
- Buttons retain minimum touch-friendly height and visible keyboard focus.

## Breakpoints

- Around `980px`: reduce multi-column content and rail spacing.
- Around `760px`: collapse primary grids and switch table/list layouts.
- Around `560px`: use the compact mobile navigation and stack action controls.

## Accessibility and behavior

- Preserve semantic navigation, headings, labels, and table/list meaning.
- Do not hide essential actions on mobile.
- Keep horizontal scrolling limited to intentionally wide data regions; page-level horizontal overflow is not allowed.
- Respect reduced-motion preferences; no new animation is required.

## Verification

- Check user-panel and Administration routes at desktop, tablet, and mobile widths.
- Confirm no page-level horizontal overflow.
- Confirm filters, buttons, navigation, pagination, and table rows remain usable by keyboard and touch.
- Run web lint, typecheck, build, and Docker web refresh.
