ALTER TABLE tenants
  ADD COLUMN retention_days integer NOT NULL DEFAULT 365,
  ADD COLUMN ai_provider varchar(40) NOT NULL DEFAULT 'fake',
  ADD COLUMN ai_model varchar(160) NOT NULL DEFAULT 'deterministic-v1',
  ADD COLUMN ai_monthly_token_budget integer NOT NULL DEFAULT 1000000,
  ADD COLUMN deletion_scheduled_at timestamptz(3);

ALTER TABLE tenants
  ADD CONSTRAINT tenant_retention_days_check CHECK (retention_days BETWEEN 1 AND 3650),
  ADD CONSTRAINT tenant_ai_provider_check CHECK (ai_provider IN ('fake', 'openai', 'anthropic')),
  ADD CONSTRAINT tenant_ai_budget_check CHECK (ai_monthly_token_budget BETWEEN 1000 AND 2000000000);
