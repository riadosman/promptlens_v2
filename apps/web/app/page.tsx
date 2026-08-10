import Link from 'next/link';
import { LegalLinks } from '../components/legal-links';

const workflow = [
  {
    icon: '01',
    title: 'Capture the real prompt',
    copy: '“Write a launch announcement for our new finance feature.”',
    detail: 'Browser connector · Product launch project',
  },
  {
    icon: '02',
    title: 'Understand what is missing',
    copy: 'Score 54 · Audience, release timing, and a measurable outcome are missing.',
  },
  {
    icon: '03',
    title: 'Use the improved version',
    copy: 'Create a concise launch announcement for finance leaders, including the August 18 rollout, one quantified benefit, and a demo CTA.',
    detail: 'Ready to copy · retained in project history',
  },
];

export default function HomePage() {
  return (
    <main className="pl-site-shell">
      <header className="pl-site-nav">
        <Link className="pl-brand" href="/">
          <span className="pl-brand-mark" aria-hidden="true">
            _
          </span>
          <span>PROMPTLENS</span>
        </Link>
        <nav aria-label="Primary navigation" className="pl-site-links">
          <a href="#features">Features</a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login">Sign in</Link>
          <Link className="pl-primary-link" href="/register">
            Start now <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      <section className="pl-hero">
        <div className="pl-hero-copy">
          <div className="pl-release-pill">
            <span /> Production-ready self-hosting
          </div>
          <h1>
            Secure prompt <span>intelligence.</span> Built for teams.
          </h1>
          <p>
            Capture, analyze, and organize LLM interactions in infrastructure you control—without
            losing the project context that makes every prompt valuable.
          </p>
          <div className="pl-hero-actions">
            <Link className="pl-primary-link pl-large-link" href="/register">
              Create workspace <span aria-hidden="true">↗</span>
            </Link>
            <a className="pl-secondary-link pl-large-link" href="#features">
              Explore platform <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="pl-trust-line">
            <span>SELF-HOSTED</span>
            <span>OPEN SOURCE</span>
            <span>MULTI-TENANT</span>
          </div>
        </div>

        <div className="pl-terminal" aria-label="Prompt analysis preview">
          <div className="pl-terminal-bar">
            <span className="pl-window-dots">
              <i />
              <i />
              <i />
            </span>
            <span>prompt_analysis.json — workspace/core</span>
          </div>
          <pre>
            <code>
              <span className="pl-code-purple">&#123;</span>
              {'\n'} <span className="pl-code-key">"prompt"</span>:{' '}
              <span className="pl-code-value">"Design a reliable onboarding flow..."</span>,{'\n'}{' '}
              <span className="pl-code-key">"analysis"</span>:{' '}
              <span className="pl-code-purple">&#123;</span>
              {'\n'} <span className="pl-code-key">"score"</span>:{' '}
              <span className="pl-code-number">92</span>,{'\n'}{' '}
              <span className="pl-code-key">"strengths"</span>: [
              <span className="pl-code-value">"clear outcome"</span>,{' '}
              <span className="pl-code-value">"useful context"</span>],{'\n'}{' '}
              <span className="pl-code-key">"next_step"</span>:{' '}
              <span className="pl-code-value">"add measurable constraints"</span>
              {'\n'} <span className="pl-code-purple">&#125;</span>,{'\n'}{' '}
              <span className="pl-code-key">"project"</span>:{' '}
              <span className="pl-code-value">"Product launch"</span>
              {'\n'}
              <span className="pl-code-purple">&#125;</span>
            </code>
          </pre>
          <div className="pl-terminal-status">
            <span>
              <i /> Analysis complete
            </span>
            <span>42ms</span>
          </div>
        </div>
      </section>

      <section className="pl-feature-section" id="features">
        <div className="pl-section-heading">
          <p>PRODUCT FLOW / 01</p>
          <h2>Capture. Understand. Improve.</h2>
          <span>See the exact path from a vague input to a stronger, reusable team prompt.</span>
        </div>
        <div className="pl-bento-grid pl-workflow-grid">
          {workflow.map((feature) => (
            <article className="pl-feature-card pl-workflow-card" key={feature.title}>
              <span className="pl-feature-icon" aria-hidden="true">
                {feature.icon}
              </span>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </div>
              {'detail' in feature && feature.detail ? (
                <small>{feature.detail}</small>
              ) : (
                <span className="pl-card-arrow" aria-hidden="true">
                  ↗
                </span>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="pl-cta">
        <div>
          <p>READY TO DEPLOY?</p>
          <h2>Turn prompt history into an operating advantage.</h2>
        </div>
        <Link className="pl-primary-link pl-large-link" href="/register">
          Create your workspace <span aria-hidden="true">↗</span>
        </Link>
      </section>

      <footer className="pl-footer">
        <span>PROMPTLENS / OPEN SOURCE PROMPT INTELLIGENCE</span>
        <LegalLinks />
      </footer>
    </main>
  );
}
