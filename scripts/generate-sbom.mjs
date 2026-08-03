import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(command, ['list', '--prod', '-r', '--depth', 'Infinity', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  shell: process.platform === 'win32',
});
if (result.status !== 0)
  throw new Error(result.error?.message || result.stderr || 'pnpm list failed');

const roots = JSON.parse(result.stdout);
const packages = new Map();
function collect(dependencies = {}) {
  for (const [name, dependency] of Object.entries(dependencies)) {
    const version = dependency.version ?? 'unknown';
    packages.set(`${name}@${version}`, { name, version });
    collect(dependency.dependencies);
  }
}
for (const root of roots) collect(root.dependencies);

const created = new Date().toISOString();
const documentNamespace = `https://promptlens.dev/sbom/${createHash('sha256')
  .update(`${created}:${packages.size}`)
  .digest('hex')}`;
const sbom = {
  spdxVersion: 'SPDX-2.3',
  dataLicense: 'CC0-1.0',
  SPDXID: 'SPDXRef-DOCUMENT',
  name: 'promptlens',
  documentNamespace,
  creationInfo: { created, creators: ['Tool: promptlens-generate-sbom'] },
  packages: [...packages.values()].map(({ name, version }, index) => ({
    SPDXID: `SPDXRef-Package-${index + 1}`,
    name,
    versionInfo: version,
    downloadLocation: 'NOASSERTION',
    filesAnalyzed: false,
    licenseConcluded: 'NOASSERTION',
    licenseDeclared: 'NOASSERTION',
    externalRefs: [
      {
        referenceCategory: 'PACKAGE-MANAGER',
        referenceType: 'purl',
        referenceLocator: `pkg:npm/${encodeURIComponent(name)}@${version}`,
      },
    ],
  })),
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/promptlens.spdx.json', `${JSON.stringify(sbom, null, 2)}\n`);
process.stdout.write(`Generated SPDX SBOM with ${packages.size} packages.\n`);
