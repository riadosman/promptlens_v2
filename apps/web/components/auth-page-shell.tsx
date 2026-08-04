import Link from 'next/link';
import type { ReactNode } from 'react';

type AuthPageShellProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly children: ReactNode;
};

export function AuthPageShell({ eyebrow, title, children }: AuthPageShellProps) {
  return (
    <main className="editorial-auth">
      <aside className="auth-story">
        <Link className="editorial-wordmark inverse" href="/">
          <span aria-hidden="true" />PromptLens
        </Link>
        <div>
          <p className="editorial-kicker">Prompt intelligence</p>
          <h2>Better prompts are not an accident.</h2>
          <p>Find weak points, preserve project context, and turn team knowledge into reusable work.</p>
        </div>
        <p className="auth-proof">
          <strong>Editorial Workbench</strong>
          <br />
          Clear feedback. Better outcomes.
        </p>
      </aside>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <p className="editorial-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          {children}
        </div>
      </section>
    </main>
  );
}
