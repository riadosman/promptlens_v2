# Auth Pages Signal Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle the login, register, forgot-password, and related recovery screens as a responsive two-panel continuation of the landing page.

**Architecture:** Keep authentication components and route behavior unchanged. Add one shared auth shell structure to the route pages and replace the existing auth-only CSS with a light right form surface, dark left brand panel, and responsive stacked layout.

**Tech Stack:** Next.js App Router, React/TypeScript, existing shared `styles.css`, native CSS media queries.

## Global Constraints

- Preserve all existing auth behavior, form submission, links, errors, pending states, and accessibility semantics.
- Use the landing palette: `#f5f7f4`, `#14231b`, `#74847a`, `#167448`, and `#d4dfd7`.
- Keep radius restrained at 8–12px for inputs and actions; do not add a floating oversized card treatment.
- Do not add decorative motion that competes with form completion.
- Do not change authentication logic, APIs, or dashboard/landing markup.

---

### Task 1: Add the shared Signal split auth shell

**Files:**
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/app/register/page.tsx`
- Modify: `apps/web/app/forgot-password/page.tsx`
- Modify: `apps/web/app/reset-password/page.tsx`
- Modify: `apps/web/app/verify-email/page.tsx`

**Interfaces:**
- Consumes: Existing page headings, `AuthForm`, `RecoveryForm`, and route links.
- Produces: A consistent `.auth-shell` containing `.auth-brand-panel` and `.auth-form-panel` for every auth route.

- [ ] **Step 1: Wrap each route’s existing content in the two-panel structure**

Use this shape in every listed page, keeping each page’s current form, heading, eyebrow, and links inside the right panel:

```tsx
<main className="auth-shell">
  <section className="auth-brand-panel" aria-label="PromptLens">
    <Link className="wordmark" href="/">PromptLens</Link>
    <div className="auth-brand-copy">
      <p className="eyebrow">Prompt intelligence for teams</p>
      <h2>Keep the signal.<br />Build the practice.</h2>
      <p>One place for the prompts, context, and lessons your team wants to keep.</p>
    </div>
    <span className="auth-brand-note">Open source · Built for thoughtful AI work</span>
  </section>
  <section className="auth-form-panel">
    {/* existing route-specific content */}
  </section>
</main>
```

For the form panel, keep the route-specific heading and existing components exactly as they are. Keep `aria-label` only on the brand panel and preserve the existing link destinations.

- [ ] **Step 2: Run the typecheck**

Run: `rtk pnpm run typecheck` from `apps/web`.

Expected: TypeScript completes without errors.

- [ ] **Step 3: Commit the shell markup**

```bash
git add apps/web/app/login/page.tsx apps/web/app/register/page.tsx apps/web/app/forgot-password/page.tsx apps/web/app/reset-password/page.tsx apps/web/app/verify-email/page.tsx
git commit -m "feat: add shared auth signal split shell"
```

### Task 2: Replace auth-only styling with the landing palette

**Files:**
- Modify: `apps/web/app/styles.css:303-360` and the later auth overrides near the end of the file

**Interfaces:**
- Consumes: `.auth-shell`, `.auth-brand-panel`, `.auth-form-panel`, `.auth-card`, `.auth-form`, `.muted`, `.form-error`, and existing native form elements.
- Produces: Desktop split layout with visible focus states and a mobile stacked layout.

- [ ] **Step 1: Add the light auth color context**

Make `.auth-shell` use `color-scheme: light`, `min-height: 100svh`, `display: grid`, and a landing-surface background. Remove the blanket `.auth-shell * { color: ... !important; }` rule because it prevents panel-specific colors and accessible focus styling.

- [ ] **Step 2: Style the two panels**

Use a desktop grid such as:

```css
.auth-shell {
  grid-template-columns: minmax(18rem, .82fr) minmax(24rem, 1.18fr);
  background: #f5f7f4;
}
.auth-brand-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100svh;
  background: #14231b;
  color: #f5f7f4;
  padding: clamp(1.5rem, 4vw, 3.5rem);
}
.auth-form-panel {
  display: grid;
  align-content: center;
  width: min(100%, 34rem);
  margin-inline: auto;
  padding: clamp(2rem, 7vw, 6rem);
}
```

Style the brand heading as a restrained landing-style display heading, keep supporting copy muted green-gray, and style `.auth-card` as a transparent content wrapper with no shadow or oversized radius.

- [ ] **Step 3: Style form controls and states**

Use `#14231b` for labels and buttons, `#74847a` for secondary text, `#d4dfd7` for borders, and `#167448` for links/focus. Add a visible `:focus-visible` outline on links, inputs, and buttons. Keep `.form-error` readable in a soft red treatment without changing its text or rendering logic.

- [ ] **Step 4: Add responsive stacking**

At `max-width: 760px`, switch `.auth-shell` to one column, reduce the brand panel to a compact top section, hide only the long supporting paragraph if needed for height, and keep the wordmark, eyebrow, heading, and form panel visible. Ensure the form panel is full width with safe horizontal padding.

- [ ] **Step 5: Run lint and build**

Run from `apps/web`:

```bash
rtk pnpm run lint
rtk pnpm run build
```

Expected: both commands pass and the Next build includes `/login`, `/register`, `/forgot-password`, `/reset-password`, and `/verify-email`.

- [ ] **Step 6: Commit the visual system**

```bash
git add apps/web/app/styles.css
git commit -m "feat: refresh auth visuals with landing palette"
```

### Task 3: Verify the auth flows visually and functionally

**Files:**
- Modify: none

**Interfaces:**
- Consumes: The running web container at `http://localhost:3001`.
- Produces: Verified desktop/mobile auth presentation without changing behavior.

- [ ] **Step 1: Rebuild only the web service**

Run from the repository root:

```bash
rtk docker compose --env-file .env -p promptlens-platform -f infra/compose/compose.full.yaml up -d --build --no-deps web
```

- [ ] **Step 2: Check each route at desktop width**

Open `/login`, `/register`, `/forgot-password`, `/reset-password`, and `/verify-email`. Confirm the dark brand panel is consistent, each existing heading/form appears in the right panel, and all links remain visible.

- [ ] **Step 3: Check mobile layout and keyboard focus**

At a narrow viewport, confirm the panels stack, no horizontal scrolling appears, inputs remain usable, and Tab focus is visible on links, fields, and the primary button.

- [ ] **Step 4: Check form behavior**

Submit empty forms and invalid credentials/email values. Confirm native required validation and existing error/message states still appear; do not use real credentials.

- [ ] **Step 5: Commit any only-if-needed verification fix**

If verification finds a purely visual defect, patch the smallest relevant selector, rerun lint/build, and commit with:

```bash
git add apps/web/app/styles.css apps/web/app/login/page.tsx apps/web/app/register/page.tsx apps/web/app/forgot-password/page.tsx apps/web/app/reset-password/page.tsx apps/web/app/verify-email/page.tsx
git commit -m "fix: polish auth responsive layout"
```
