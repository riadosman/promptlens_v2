# Connect Device — Design Spec

## Goal

Move the existing device authorization flow into the dashboard shell and make it a clear two-step setup experience without changing the backend contract.

## User flow

1. **Enter device code**
   - Show the connector code, uppercase it while typing, and preserve a `code` query parameter when present.
   - Explain that the code is temporary.
   - Continue only when the existing code validation requirements are met.

2. **Choose access**
   - Load active projects using the existing `/projects` request.
   - Let the user choose the project that will receive prompts.
   - Submit the existing `/connectors/device/approve` request with `userCode` and `projectId`.

## Layout

- Reuse the dashboard layout and left navigation; mark Connect device as active.
- Use the existing cream, dark-green, mint-line visual system from Overview, Prompt Log, and Projects.
- Main content has a page header, a two-segment progress indicator, and one focused setup panel.
- Step one emphasizes the code field; step two emphasizes project access and a compact connection summary.
- Use sentence-case labels and explicit actions: `Continue`, `Connect device`, `Back`, and `Back to overview`.

## States and errors

- Loading projects: disable project selection and show a short loading state.
- Unauthenticated: keep the existing sign-in/register links and return to `/connect?code=...`.
- Empty active projects: explain that an active project is required and link to Projects.
- Approval success: show a success state and a return-to-overview action.
- API failure: show the existing error message in an inline status region without losing entered values.

## Scope

- Reuse `ConnectDevice`, `apiRequest`, existing project types, and the dashboard shell.
- No new API endpoints, database changes, dependencies, or connector behavior.
- Add focused styling and only the state needed to move between the two steps.

## Verification

- TypeScript/build passes.
- `/connect` renders inside the dashboard shell.
- Query-string code is prefilled and remains available through authentication redirects.
- Active projects can be selected and approval still posts the same payload.
- Loading, unauthenticated, empty-project, failure, and success states remain readable and keyboard accessible.
