# Compatibility and release policy

PromptLens uses SemVer. The server supports the current connector protocol major and the immediately previous major during its documented deprecation window.

Every pull request builds the SDK, Claude Code connector, and Codex connector on current GitHub-hosted Ubuntu, macOS, and Windows runners using the pinned Node.js toolchain. Tagged releases include SHA-256 checksums and Sigstore bundles for each connector archive.

| Component          | v1 support target |
| ------------------ | ----------------- |
| Node.js            | 22.x              |
| PostgreSQL         | 17.x              |
| Redis              | 8.x               |
| Docker Compose     | v2 current stable |
| Connector protocol | 1.x               |

Database migrations are forward-only. Patch/minor releases must remain readable by the immediately previous application release unless release notes explicitly mark a maintenance window and restore-only rollback. Major upgrades must be rehearsed from a verified backup.

Release candidates run clean installation, migration-from-previous, v1 acceptance, dependency audit, container scan, and backup/restore drills. Release artifacts include checksums, SBOM, provenance, migration notes, and connector compatibility notes.
