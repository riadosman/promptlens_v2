import { ConnectDevice } from '../../components/connect-device';
import { WorkspaceShell } from '../../components/workspace-shell';

export default function ConnectPage() {
  return (
    <WorkspaceShell
      eyebrow="Connector control"
      title="Connect device"
      description="Authorize an AI tool with explicit, project-scoped access."
      badge="Secure pairing"
    >
      <section className="pl-connect-layout">
        <article className="v2-panel pl-connect-card">
          <div className="pl-panel-heading">
            <span className="pl-panel-icon" aria-hidden="true">
              ⌘
            </span>
            <div>
              <p className="v2-kicker">Device authorization</p>
              <h2>Pair your AI tool</h2>
            </div>
          </div>
          <p className="v2-subline">
            Enter the code shown by your connector and choose the only project it may access.
          </p>
          <ConnectDevice />
        </article>
        <aside className="pl-connect-guide">
          <p className="v2-kicker">How it works</p>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Start the connector</strong>
                <p>Copy the temporary code shown in your terminal.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Limit its scope</strong>
                <p>Select one active project for this device.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Return to your tool</strong>
                <p>The connector resumes automatically after approval.</p>
              </div>
            </li>
          </ol>
          <div className="pl-scope-note">
            <span aria-hidden="true">◇</span>
            <p>
              <strong>Least-privilege access</strong>
              <br />A device never receives access to other projects.
            </p>
          </div>
        </aside>
      </section>
    </WorkspaceShell>
  );
}
