const capabilities = [
  'Project-based prompt history',
  'Structured quality analysis',
  'Secure connector synchronization',
];

export default function HomePage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Primary navigation">
        <a className="wordmark" href="/">
          PromptLens
        </a>
        <div className="landing-nav-actions">
          <a className="text-link" href="/login">
            Sign in
          </a>
          <a className="button-link" href="/register">
            Get started
          </a>
        </div>
      </nav>
      <section className="hero landing-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Open source prompt intelligence</p>
          <h1 id="hero-title">Make every prompt a reusable asset.</h1>
          <p className="lede">
            Capture, understand and improve your best thinking without losing the project context
            that makes every prompt valuable.
          </p>
          <div className="hero-actions">
            <a className="button-link" href="/register">
              Create a workspace
            </a>
            <a className="text-link" href="/login">
              Sign in to PromptLens →
            </a>
          </div>
        </div>
        <div className="hero-preview" aria-label="Prompt analysis preview">
          <div className="preview-topline">
            <span className="preview-dot" /> Live prompt analysis <span>92 / 100</span>
          </div>
          <p className="preview-prompt">
            Design a reliable onboarding flow for a multi-tenant SaaS product...
          </p>
          <div className="preview-progress">
            <span />
          </div>
          <div className="preview-grid">
            <div>
              <small>Strength</small>
              <strong>Clear outcome</strong>
            </div>
            <div>
              <small>Improvement</small>
              <strong>Add constraints</strong>
            </div>
          </div>
        </div>
      </section>
      <section className="capability-grid" aria-label="PromptLens capabilities">
        {capabilities.map((capability, index) => (
          <article className="capability-card" key={capability}>
            <span className="capability-index">0{index + 1}</span>
            <h2>{capability}</h2>
            <p>
              {index === 0
                ? 'Keep every experiment connected to the work it supports.'
                : index === 1
                  ? 'Get practical feedback, not a black-box score.'
                  : 'Bring your prompts with you across supported AI tools.'}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
