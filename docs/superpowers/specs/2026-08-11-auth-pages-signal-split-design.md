# PromptLens Auth Pages — Signal Split Design

## Goal

Refresh the login, register, and forgot-password screens so they feel like a direct continuation of the landing page. Preserve all existing auth behavior and change only the presentation layer.

## Chosen direction

Use a two-panel “Signal split” layout:

- Left panel: dark PromptLens ink background with the wordmark, a short product statement, and a restrained supporting line.
- Right panel: light landing-page background with the focused auth form.
- On mobile, collapse the left panel into a compact top brand band and keep the form as the primary content.

This gives the auth flow a stronger product identity than a generic centered card while keeping the form direct and familiar.

## Visual system

- Page background: `#f5f7f4` landing surface.
- Ink panel: `#14231b`.
- Primary text: `#14231b` on light surfaces and `#f5f7f4` on the ink panel.
- Supporting text: muted landing green-gray, approximately `#74847a`.
- Accent: PromptLens green, approximately `#167448`.
- Borders: soft green-gray, approximately `#d4dfd7`.
- Keep radius restrained: 8–12px for inputs and actions, no oversized floating card treatment.

## Page structure

Each auth route keeps its current content and links but uses the shared visual shell:

```text
┌──────────────────────────┬──────────────────────────────┐
│ PromptLens               │                              │
│ Keep the signal.         │  eyebrow                     │
│ Build the practice.      │  route heading               │
│                          │  form                         │
│ Prompt intelligence...   │  supporting links             │
└──────────────────────────┴──────────────────────────────┘
```

- Login: sign-in form, forgot-password link, register link.
- Register: registration form, login link.
- Forgot password: email form, return-to-login link.
- The left message remains shared across all three pages to reinforce continuity.

## Interaction and accessibility

- Preserve native labels, keyboard order, focus visibility, and existing error rendering.
- Use the green accent for focus and primary action states; keep contrast readable on both panels.
- Do not add decorative motion that competes with form completion.
- At narrow widths, stack panels without hiding the brand message or links.

## Scope

In scope: shared auth shell styling, auth page layout, form/input/button visual treatment, responsive behavior, and palette alignment.

Out of scope: authentication logic, route behavior, copy changes beyond small visual labels, dashboard styling, and landing page changes.

## Verification

- Run web lint, typecheck, and production build.
- Open `/login`, `/register`, and `/forgot-password` at desktop and mobile widths.
- Verify keyboard focus and that existing form submission/error states remain intact.
