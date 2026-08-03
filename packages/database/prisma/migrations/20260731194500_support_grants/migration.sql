CREATE TABLE support_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by_id uuid NOT NULL,
  approved_by_id uuid,
  reason varchar(500) NOT NULL,
  expires_at timestamptz(3),
  revoked_at timestamptz(3),
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  updated_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE INDEX support_grants_tenant_created_idx ON support_grants(tenant_id, created_at DESC);
CREATE INDEX support_grants_requester_expiry_idx ON support_grants(requested_by_id, expires_at);

ALTER TABLE support_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY support_grant_tenant_isolation ON support_grants
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());
