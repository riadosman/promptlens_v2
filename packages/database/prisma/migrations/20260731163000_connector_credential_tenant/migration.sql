ALTER TABLE connector_credentials ADD COLUMN tenant_id uuid;
UPDATE connector_credentials AS credential
SET tenant_id = installation.tenant_id
FROM connector_installations AS installation
WHERE installation.id = credential.installation_id;
ALTER TABLE connector_credentials ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX connector_credentials_tenant_id_created_at_idx
  ON connector_credentials (tenant_id, created_at);
