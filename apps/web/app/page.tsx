const workflow = [
  ['Capture', 'Keep prompts connected to the projects and decisions they support.'],
  ['Understand', 'See what makes a prompt strong and where the next improvement is hiding.'],
  ['Improve', 'Turn useful feedback into a clearer, more reliable version.'],
  ['Reuse', 'Find the thinking that worked and make it part of the team’s practice.'],
] as const;

const capabilities = [
  ['Project context', 'Keep experiments connected to the work they support.'],
  ['Quality analysis', 'Get practical feedback, not a black-box score.'],
  ['Connector sync', 'Bring your prompts with you across supported AI tools.'],
] as const;

export default function HomePage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Primary navigation">
        <a className="wordmark" href="/">
          PromptLens
        </a>
        <div className="landing-nav-links">
          <a className="landing-nav-anchor" href="#how-it-works">
            How it works
          </a>
          <a className="text-link" href="/login">
            Sign in
          </a>
          <a className="button-link" href="/register">
            Create your workspace
          </a>
        </div>
      </nav>

      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Prompt intelligence for teams</p>
          <h1 id="hero-title">Turn every prompt into team knowledge.</h1>
          <p className="lede">
            Capture the thinking behind your best work, understand what makes it effective, and
            improve it with the context your team already has.
          </p>
          <div className="hero-actions">
            <a className="button-link" href="/register">
              Create your workspace
            </a>
            <a className="text-link" href="/login">
              Sign in to PromptLens →
            </a>
          </div>
          <p className="hero-note">Open source · Built for thoughtful AI work</p>
        </div>

        <div className="analysis-preview" aria-label="Prompt quality analysis preview">
          <div className="analysis-header">
            <div>
              <span className="analysis-status-dot" aria-hidden="true" />
              <span>Prompt quality</span>
            </div>
            <strong>92 / 100</strong>
          </div>
          <div className="analysis-score" role="img" aria-label="Prompt quality score: 92 out of 100">
            <span />
          </div>
          <p className="analysis-prompt">
            Design a reliable onboarding flow for a multi-tenant SaaS product...
          </p>
          <div className="analysis-grid">
            <div>
              <small>Strength</small>
              <strong>Clear outcome</strong>
            </div>
            <div>
              <small>Next improvement</small>
              <strong>Add constraints</strong>
            </div>
          </div>
          <div className="analysis-footer">
            <span>Project / onboarding</span>
            <span className="analysis-check">● Analysis complete</span>
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Prompt workflow">
        {workflow.map(([label], index) => (
          <div className="proof-item" key={label}>
            <span>0{index + 1}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </section>

      <section className="workflow-section" id="how-it-works" aria-labelledby="workflow-title">
        <div className="section-heading">
          <p className="eyebrow">A better prompt practice</p>
          <h2 id="workflow-title">The useful part shouldn’t disappear.</h2>
          <p>
            PromptLens gives your team a shared place to keep the questions, context, and lessons
            that make AI work better over time.
          </p>
        </div>
        <div className="workflow-grid">
          {workflow.map(([label, description], index) => (
            <article className="workflow-card" key={label}>
              <span className="workflow-marker">0{index + 1}</span>
              <h3>{label}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="feature-section" aria-labelledby="features-title">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Everything stays connected</p>
          <h2 id="features-title">From one useful prompt to a better way of working.</h2>
        </div>
        <div className="feature-grid">
          {capabilities.map(([title, description]) => (
            <article className="feature-card" key={title}>
              <span className="feature-icon" aria-hidden="true">
                ↗
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta" aria-labelledby="final-cta-title">
        <div>
          <p className="eyebrow">Keep the signal</p>
          <h2 id="final-cta-title">Your next great prompt shouldn’t disappear.</h2>
        </div>
        <a className="button-link" href="/register">
          Create your workspace
        </a>
      </section>

      <footer className="landing-footer">
        <a className="wordmark" href="/">
          PromptLens
        </a>
        <span>Prompt intelligence for thoughtful teams.</span>
      </footer>
    </main>
  );
}
