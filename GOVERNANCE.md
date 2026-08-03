# Project governance

PromptLens uses a maintainer-and-reviewer model. Maintainers own release signing, security response, roadmap decisions, and final merge authority. Reviewers may approve changes in their demonstrated areas but cannot unilaterally publish a release.

Material changes to authentication, tenant boundaries, connector protocol, provider data flow, licensing, or deployment architecture require an ADR and two maintainer approvals. Routine fixes require one independent review and green required checks. Authors do not approve their own security-sensitive changes.

The project follows semantic versioning. Public API and connector protocol removals require a major release; deprecations remain supported for at least one minor release and are documented before removal. Security fixes may accelerate the normal cadence.

Maintainer status is earned through sustained, high-quality contributions and responsible review. Inactive maintainers may be moved to emeritus status through a documented consensus decision. Conflicts of interest must be disclosed.
