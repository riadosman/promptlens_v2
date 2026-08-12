# Prompt Log Signal Table Design

## Goal

Make Prompt Log faster to scan and compare while preserving search, filters, pagination, and JSON/CSV export.

## Design

- Use a dense table as the primary content surface.
- Keep a clear page header with prompt count and export actions.
- Place search and filters in one responsive toolbar.
- Show Prompt, Score, Status, Project, Model, and Time as table columns.
- Use green/amber/red score treatments and visible keyboard focus states.
- On narrow screens, preserve the table structure with horizontal scrolling rather than hiding data.

## Scope

Only the user dashboard Prompt Log markup and styles change. Existing data loading, filtering, pagination, and export behavior remain unchanged.
