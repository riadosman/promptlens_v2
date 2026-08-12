# Overview KPI Cards Design

## Goal

Improve the Overview dashboard cards for `Prompts`, `Last 7 days`, and `Analyses` so they feel intentional rather than like three identical statistic boxes.

## Design

Keep the existing three-card desktop layout and responsive breakpoints. Each card keeps the same data contract and accessibility semantics, but receives a distinct visual role:

- `Prompts`: primary volume card with the strongest numeral treatment.
- `Last 7 days`: recent-activity card with a compact trend/accent treatment.
- `Analyses`: completion/review card with a distinct completion accent.

All cards remain equal height, preserve the current light workspace palette, and use CSS-only decoration. No new dependency, data field, chart, or interaction is added.

## Implementation boundary

- Reuse the existing `.v2-command-kpis` markup and values.
- Add only the minimum class hooks needed to target the three cards reliably.
- Use existing typography, colors, borders, and responsive rules.
- Keep mobile cards stacked and readable.

## Acceptance criteria

- The three cards are visually differentiated without becoming inconsistent.
- Values remain the dominant content.
- No layout overflow at desktop or mobile widths.
- Existing TypeScript and formatting checks pass.
