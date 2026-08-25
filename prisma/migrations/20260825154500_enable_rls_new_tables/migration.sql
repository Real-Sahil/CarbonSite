-- supplier_data_requests and dsar_requests were created after the linter
-- scan behind 20260825153826_enable_rls_missing_tables, so that migration
-- couldn't have covered them — they showed up as fresh rls_disabled_in_public
-- findings on the next scan. Same fix, same reasoning.

ALTER TABLE supplier_data_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_data_requests_org_access ON supplier_data_requests
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY supplier_data_requests_org_insert ON supplier_data_requests
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY supplier_data_requests_org_update ON supplier_data_requests
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY supplier_data_requests_org_delete ON supplier_data_requests
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- dsar_requests spans a person's data across every org they belong to (see
-- lib/compliance/pii-registry.ts) — it is not itself org-scoped the way
-- every other table here is, and organization_id is optional/nullable. No
-- legitimate PostgREST/Supabase-Auth caller exists for this table (DSAR
-- self-service goes through the app's own Better Auth session, not
-- PostgREST) — enable RLS with no policies, deny-all for that surface.
ALTER TABLE dsar_requests ENABLE ROW LEVEL SECURITY;
