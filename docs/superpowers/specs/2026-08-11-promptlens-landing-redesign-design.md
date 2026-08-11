# PromptLens Landing Page Redesign

## Goal

Refresh the public landing page so PromptLens reads as a professional SaaS product for both developers and product/design teams. Developer credibility remains visible through restrained terminal microcopy, not through a terminal-heavy interface.

## Visual direction

- Clean SaaS-first layout with a light, calm surface and dark ink typography.
- Green is the primary product accent, reserved for action, status, and quality signals.
- Keep the existing PromptLens wordmark and routes unless a small landing-only adjustment is required.
- Use the existing CSS and installed dependencies; add no new UI library or animation package.

## Page structure

1. Navbar: PromptLens wordmark, How it works, Sign in, Create your workspace.
2. Hero: headline `Turn every prompt into team knowledge.`, supporting copy, primary CTA `Create your workspace`, secondary sign-in link, and a quality-analysis preview card.
3. Proof strip: Capture, Understand, Improve, Reuse.
4. Workflow: explain prompt capture, analysis, and reusable improvement in three steps.
5. Feature grid: project context, structured quality analysis, and connector synchronization.
6. Final CTA: `Your next great prompt shouldn’t disappear.`
7. Minimal footer.

## Interaction and accessibility

- The analysis preview may transition subtly from analyzing to scored on load.
- Section reveals and hover elevation are restrained and disabled under `prefers-reduced-motion`.
- Maintain visible keyboard focus styles and semantic headings/links.
- Use one-column layouts and full-width actions on small screens.
- Do not alter auth or dashboard behavior.

## Copy and behavior

Use plain, active product language. CTA labels remain consistent with their destination: `Create your workspace` opens `/register`; `Sign in` opens `/login`.

## Verification

- Run the web lint, typecheck, and build commands.
- Check the landing page at desktop and mobile widths.
- Confirm keyboard focus and reduced-motion behavior.
- Confirm existing login/register links still resolve.
