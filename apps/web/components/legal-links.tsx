import Link from 'next/link';

export function LegalLinks() {
  return (
    <nav className="legal-links" aria-label="Legal information">
      <Link href="/privacy">Privacy and data use</Link>
      <a href="https://www.apache.org/licenses/LICENSE-2.0">Apache-2.0 license</a>
    </nav>
  );
}
