'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type WorkspaceSidebarProps = {
  readonly tenantName?: string;
  readonly role?: string;
  readonly tenantId?: string | undefined;
  readonly adminVisible?: boolean;
  readonly workspaceControl?: ReactNode;
  readonly onSignOut?: () => void;
};

const navigation = [
  { href: '/dashboard/overview', label: 'Overview', glyph: '◈' },
  { href: '/dashboard/prompts', label: 'Prompt log', glyph: '⌁' },
  { href: '/dashboard/projects', label: 'Projects', glyph: '▦' },
  { href: '/connect', label: 'Connect device', glyph: '⌘' },
];

export function WorkspaceSidebar({
  tenantName = 'PromptLens workspace',
  role = 'Workspace',
  tenantId,
  adminVisible = true,
  workspaceControl,
  onSignOut,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const items = adminVisible
    ? [...navigation, { href: '/admin', label: 'Administration', glyph: '◇' }]
    : navigation;

  return (
    <aside className="v2-rail pl-workspace-rail">
      <Link className="v2-wordmark" href="/dashboard/overview">
        PromptLens
      </Link>
      <div className="pl-mobile-workspace" aria-label={`Active workspace: ${tenantName}`}>
        <span>Workspace</span>
        <strong>{tenantName}</strong>
      </div>
      <div className="v2-panel v2-tenant">
        <p className="v2-kicker v2-tenant-kicker">Active workspace</p>
        <strong className="v2-tenant-name">{tenantName}</strong>
        <span className="v2-tenant-role">{role.toUpperCase()}</span>
        {tenantId ? (
          <small className="v2-tenant-id v2-id">Tenant {tenantId.slice(0, 7)}</small>
        ) : null}
      </div>
      <nav aria-label="Main navigation" className="v2-nav">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            pathname?.startsWith(`${item.href}/`) ||
            (item.href === '/dashboard/overview' && pathname === '/dashboard');
          return (
            <Link
              className={`v2-nav-link ${item.href === '/connect' || item.href === '/admin' ? 'pl-secondary-nav' : ''} ${active ? 'active' : ''}`}
              href={item.href}
              key={item.href}
            >
              <span className="pl-nav-glyph" aria-hidden="true">
                {item.glyph}
              </span>
              {item.label}
            </Link>
          );
        })}
        <details className="pl-nav-more">
          <summary>More</summary>
          <div>
            {items
              .filter((item) => item.href === '/connect' || item.href === '/admin')
              .map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
          </div>
        </details>
      </nav>
      {workspaceControl ? <div className="pl-workspace-control">{workspaceControl}</div> : null}
      {onSignOut ? (
        <button className="v2-ghost pl-sidebar-exit" onClick={onSignOut} type="button">
          Sign out
        </button>
      ) : (
        <Link className="v2-ghost pl-sidebar-exit" href="/dashboard/overview">
          Return to dashboard
        </Link>
      )}
    </aside>
  );
}

type WorkspaceShellProps = WorkspaceSidebarProps & {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly badge?: string;
  readonly children: ReactNode;
};

export function WorkspaceShell({
  eyebrow,
  title,
  description,
  badge,
  children,
  ...sidebarProps
}: WorkspaceShellProps) {
  return (
    <div className="dashboard-shell-v2 pl-route-shell">
      <WorkspaceSidebar {...sidebarProps} />
      <main className="v2-main">
        <header className="v2-header pl-page-header">
          <div className="v2-header-copy">
            <p className="v2-kicker">{eyebrow}</p>
            <div className="v2-header-title">
              <h1>{title}</h1>
              <span className="v2-mode-dot" aria-hidden="true" />
            </div>
            <p className="v2-subline">{description}</p>
          </div>
          {badge ? <span className="v2-chip pl-page-badge">{badge}</span> : null}
        </header>
        {children}
      </main>
    </div>
  );
}
