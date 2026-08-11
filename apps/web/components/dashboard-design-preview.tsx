'use client';

const projects = [
  { name: 'Product launch', prompts: 24, color: 'green' },
  { name: 'Support library', prompts: 18, color: 'lavender' },
  { name: 'Research notes', prompts: 9, color: 'sand' },
];

export function DashboardDesignPreview() {
  return (
    <main className="dashboard-preview-page">
      <header className="dashboard-preview-header">
        <div>
          <p className="eyebrow">PromptLens · panel concepts</p>
          <h1>Choose the workspace direction</h1>
          <p>Three visual routes for the user panel, using the landing page palette.</p>
        </div>
        <a href="/dashboard">Back to dashboard</a>
      </header>

      <div className="dashboard-preview-grid">
        <PreviewShell title="01 · Calm SaaS" label="Command center" className="is-recommended">
          <div className="preview-welcome">
            <div>
              <span className="preview-kicker">Tuesday, August 11</span>
              <h2>Good morning, Fatih</h2>
              <p>Keep your team&apos;s prompt knowledge moving forward.</p>
            </div>
            <button type="button">New prompt</button>
          </div>
          <div className="preview-metrics">
            <PreviewMetric label="Prompts" value="51" />
            <PreviewMetric label="Projects" value="8" />
            <PreviewMetric label="Analyses" value="124" />
          </div>
          <div className="preview-columns">
            <PreviewPanel title="Recent prompts">
              <PreviewRow title="Improve onboarding email" meta="Edited 12 min ago" />
              <PreviewRow title="Support response v2" meta="Edited yesterday" />
              <PreviewRow title="Launch announcement" meta="Edited Aug 08" />
            </PreviewPanel>
            <PreviewPanel title="Your projects">
              {projects.map((project) => (
                <PreviewProject key={project.name} {...project} />
              ))}
            </PreviewPanel>
          </div>
        </PreviewShell>

        <PreviewShell title="02 · Prompt Workbench" label="Focused workspace" className="is-workbench">
          <div className="workbench-layout">
            <aside>
              <span className="preview-kicker">Project</span>
              <strong>Product launch</strong>
              <a href="#capture">Capture</a>
              <a className="is-selected" href="#improve">Improve</a>
              <a href="#reuse">Reuse</a>
              <div className="workbench-mini-list">
                <span>Launch announcement</span>
                <span>Homepage headline</span>
                <span>Release notes</span>
              </div>
            </aside>
            <section>
              <div className="workbench-toolbar"><span>Improve prompt</span><span>Saved</span></div>
              <div className="prompt-editor">
                <span className="preview-kicker">Current prompt</span>
                <p>Write a clear launch announcement for thoughtful teams...</p>
                <span className="editor-cursor" />
              </div>
              <div className="workbench-result">
                <div><span className="preview-kicker">Prompt quality</span><strong>82</strong></div>
                <p>Strong intent. Add a specific audience and desired response format.</p>
              </div>
            </section>
          </div>
        </PreviewShell>

        <PreviewShell title="03 · Signal Analytics" label="Team intelligence" className="is-analytics">
          <div className="analytics-heading">
            <div><span className="preview-kicker">Last 30 days</span><h2>Prompt health</h2></div>
            <button type="button" className="preview-quiet-button">Export</button>
          </div>
          <div className="analytics-score"><strong>78%</strong><span>+12% from last month</span><div className="score-bar"><i /></div></div>
          <div className="analytics-chart" aria-label="Prompt quality trend preview">
            <i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="analytics-insights">
            <PreviewPanel title="Top signal"><strong>Specific context</strong><p>Appears in 64% of high-performing prompts.</p></PreviewPanel>
            <PreviewPanel title="Next improvement"><strong>Add output format</strong><p>18 prompts could be more reusable.</p></PreviewPanel>
          </div>
        </PreviewShell>
      </div>
    </main>
  );
}

function PreviewShell({
  title,
  label,
  className,
  children,
}: {
  readonly title: string;
  readonly label: string;
  readonly className: string;
  readonly children: React.ReactNode;
}) {
  return (
    <article className={`dashboard-preview-option ${className}`}>
      <header><div><span>{title}</span><h2>{label}</h2></div>{className === 'is-recommended' ? <b>Recommended</b> : null}</header>
      <div className="dashboard-preview-canvas">{children}</div>
    </article>
  );
}

function PreviewMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function PreviewPanel({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return <section className="preview-panel"><header><span>{title}</span><a href="#view">View all</a></header>{children}</section>;
}

function PreviewRow({ title, meta }: { readonly title: string; readonly meta: string }) {
  return <div className="preview-row"><strong>{title}</strong><small>{meta}</small></div>;
}

function PreviewProject({ name, prompts, color }: { readonly name: string; readonly prompts: number; readonly color: string }) {
  return <div className="preview-project"><i className={color} /><strong>{name}</strong><small>{prompts} prompts</small></div>;
}
