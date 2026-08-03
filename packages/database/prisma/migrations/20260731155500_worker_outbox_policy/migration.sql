DROP POLICY outbox_tenant_isolation ON outbox_events;
CREATE POLICY outbox_tenant_isolation ON outbox_events
  USING (tenant_id = app_current_tenant_id() OR current_user = 'promptlens_worker')
  WITH CHECK (tenant_id = app_current_tenant_id() OR current_user = 'promptlens_worker');
