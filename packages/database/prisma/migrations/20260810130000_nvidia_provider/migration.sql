ALTER TABLE tenants
  DROP CONSTRAINT tenant_ai_provider_check;

ALTER TABLE tenants
  ADD CONSTRAINT tenant_ai_provider_check
  CHECK (ai_provider IN ('fake', 'openai', 'anthropic', 'nvidia'));
