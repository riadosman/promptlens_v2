# Prompt Log Signal Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle the existing Prompt Log into the approved dense Signal Table layout without changing its data behavior.

**Architecture:** Reuse the current `DashboardClient` prompt rendering and event handlers. Add semantic table-like row markup and scoped dashboard CSS so the Overview styling remains isolated.

**Tech Stack:** Next.js, React, TypeScript, CSS, Docker Compose.

## Global Constraints

- Preserve search, project/model/status/score filters, pagination, and JSON/CSV exports.
- Do not add dependencies or change API contracts.
- Keep keyboard focus and responsive horizontal scrolling.

### Task 1: Update Prompt Log structure

**Files:**
- Modify: `apps/web/components/dashboard-client.tsx:900-1030`

- [ ] Replace the prompt list presentation with a semantic table wrapper while keeping each prompt’s existing values and actions.
- [ ] Add explicit columns for Prompt, Score, Status, Project, Model, and Time.
- [ ] Preserve the existing empty state and analysis action.

### Task 2: Add Signal Table styling

**Files:**
- Modify: `apps/web/app/styles.css`

- [ ] Add scoped `.dashboard-shell-v2` Prompt Log table styles for header, rows, score states, status, metadata, hover, focus, and responsive overflow.
- [ ] Match the approved evergreen/cream visual language used by Overview.

### Task 3: Verify and ship

**Files:**
- Test: `apps/web/components/dashboard-client.tsx`
- Test: `apps/web/app/styles.css`

- [ ] Run `git diff --check`.
- [ ] Run the web build through the existing Docker Compose web image.
- [ ] Recreate only the web container on port 3000 and verify `/dashboard/prompts` returns HTTP 200.
- [ ] Commit the two implementation files.
