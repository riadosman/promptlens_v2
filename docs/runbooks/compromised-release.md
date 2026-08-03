# Compromised release runbook

1. Stop promotion and mark the affected tag, image digests, connector archives, signatures, checksums, and distribution channels as compromised.
2. Revoke repository/package credentials and active CI identities; rotate affected signing or registry credentials. Keyless Sigstore identity compromise requires repository/provider escalation rather than a local key rotation.
3. Identify the last trusted commit and independently rebuild it in a clean runner. Compare source, lockfile, SBOM, provenance, image layers, package contents, and transparency-log entries.
4. Remove or quarantine compromised artifacts without reusing the version. Publish an advisory naming exact versions/digests and required token/provider-key rotations.
5. Cut a new reviewed version from the trusted base, run the complete release and clean-install gates, sign immutable digests, and verify installation from the public distribution path.
6. Preserve forensic evidence and publish a postmortem with impact, timeline, root cause, and preventive controls.
