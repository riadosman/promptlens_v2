const capabilities = [
  {
    index: '01',
    title: 'Capture',
    copy: 'Keep every prompt connected to the project and work it supports.',
  },
  {
    index: '02',
    title: 'Understand',
    copy: 'See strengths, gaps, and practical feedback behind every score.',
  },
  {
    index: '03',
    title: 'Improve',
    copy: 'Turn recommendations into a stronger prompt your team can reuse.',
  },
];

export default function HomePage() {
  return (
    <main className="editorial-landing">
      <nav className="editorial-nav" aria-label="Primary navigation">
        <a className="editorial-wordmark" href="/">
          <span aria-hidden="true" />
          PromptLens
        </a>
        <div>
          <a href="/login">Sign in</a>
          <a className="ink-action" href="/register">
            Create a workspace
          </a>
        </div>
      </nav>
      <section className="landing-narrative" aria-labelledby="hero-title">
        <p className="editorial-kicker">Open source prompt intelligence</p>
        <h1 id="hero-title">Make every prompt a reusable asset.</h1>
        <div className="landing-stamp" aria-hidden="true">
          Prompt
          <br />
          quality
          <br />
          matters
        </div>
        <div className="landing-intro">
          <p>
            Capture, understand and improve your best thinking without losing the project context
            that makes every prompt valuable.
          </p>
          <a href="/register">Start your workspace →</a>
        </div>
      </section>
      <section className="landing-stage" aria-label="Editorial Workbench preview">
        <header>
          <div>
            <p className="editorial-kicker">Editorial Workbench</p>
            <h2>See what needs improvement at a glance.</h2>
          </div>
          <span>Role-aware · Project context</span>
        </header>
        <div className="landing-product-preview">
          <div className="preview-list" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <article>
            <strong>69 / 100</strong>
            <h3>Missing context and an unclear target</h3>
            <p>Add the audience, policy constraint, and desired next action.</p>
          </article>
        </div>
        <span className="floating-signal signal-one">3 weak prompts</span>
        <span className="floating-signal signal-two">+12 score improvement</span>
      </section>
      <section className="landing-process" aria-label="How PromptLens works">
        {capabilities.map((item) => (
          <article key={item.index}>
            <span>{item.index}</span>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
          </article>
        ))}
      </section>
      <section className="landing-final-cta">
        <h2>Better prompts are not an accident.</h2>
        <a className="ink-action" href="/register">
          Create a workspace →
        </a>
      </section>
    </main>
  );
}
