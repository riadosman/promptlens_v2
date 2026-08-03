# Release policy

PromptLens follows Semantic Versioning. Public API, connector protocol, database migration, and
documented configuration compatibility are release contracts.

- Patch releases contain compatible fixes and security updates.
- Minor releases may add optional API fields, connector capabilities, and forward-only migrations.
- Major releases may remove deprecated contracts after at least one minor release and 90 days of
  published notice.

Maintainers cut a release from a protected tag after CI, clean-install acceptance, upgrade/restore
drills, and security gates pass. The release workflow publishes multi-architecture images with
BuildKit SBOM/provenance attestations and keyless Sigstore signatures. Release notes list migration,
rollback, known-risk, and connector compatibility information.

Supported upgrade paths and connector protocol windows are listed in
[COMPATIBILITY.md](COMPATIBILITY.md). Security fixes may shorten deprecation windows when continuing
support would expose users to material risk.
