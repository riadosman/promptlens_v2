import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="policy-shell">
      <article className="policy-card">
        <Link className="wordmark" href="/">
          PromptLens
        </Link>
        <p className="eyebrow">Privacy and data use</p>
        <h1>Know where your prompts go.</h1>
        <p>
          PromptLens is self-hosted. The operator of this installation controls its database,
          backups, email service, logs and access policies.
        </p>
        <h2>Stored data</h2>
        <p>
          Account details, workspace membership, projects, prompts, analyses, connector metadata,
          usage records and audit events are stored in the installation&apos;s PostgreSQL database.
        </p>
        <h2>AI providers</h2>
        <p>
          When an operator enables OpenAI or Anthropic, prompt content is sent to that configured
          provider for analysis. Provider retention, location and training policies are controlled
          by the operator&apos;s provider agreement. The deterministic fake provider sends no data
          to an external AI service.
        </p>
        <h2>Telemetry and logs</h2>
        <p>
          Remote tracing is disabled unless the operator configures an OpenTelemetry endpoint.
          Prompt content, credentials, cookies and tokens are excluded from application logs and
          telemetry fields.
        </p>
        <h2>Retention and control</h2>
        <p>
          Workspace owners can configure retention, export workspace data and schedule workspace
          deletion. Backup retention and deletion are the responsibility of the installation
          operator.
        </p>
        <p>
          Contact the operator of this installation for access, correction, deletion or incident
          requests.
        </p>
        <Link className="button-link" href="/">
          Back to PromptLens
        </Link>
      </article>
    </main>
  );
}
