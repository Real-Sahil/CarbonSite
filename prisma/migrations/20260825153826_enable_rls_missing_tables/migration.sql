-- Fixes 17 Supabase linter ERROR findings (rls_disabled_in_public,
-- sensitive_columns_exposed): these tables had NO row-level security at
-- all — not "inert policies" like rls_policies.sql documents, but RLS
-- never enabled in the first place. Combined with the blanket
-- `GRANT ... TO authenticated` in rls_policies.sql, any caller holding a
-- valid Supabase Auth JWT (issued by Supabase Auth directly — a separate
-- service from this app's own Better Auth, reachable at the project's
-- default API URL regardless of what this codebase does) could read or
-- write every row of these tables via PostgREST, including
-- integration_connections.access_token/refresh_token and the raw invite
-- token on supplier_invites. That is a real, externally reachable gap —
-- unlike the STATUS note in rls_policies.sql, which is about whether RLS
-- drives *this app's own* request flow (it doesn't, and still won't after
-- this migration; requireOrgMember()/requirePlatformMember() remain the
-- real enforcement layer for the app itself).
--
-- Why this is safe to enable: the app's Prisma connection authenticates as
-- the `postgres` role, which bypasses RLS by default on Supabase — this
-- migration does not change how the Next.js app or workers behave. It only
-- closes the PostgREST/direct-API surface. is_org_member_for_rls() (from
-- rls_policies.sql) will always evaluate false for a genuine Supabase Auth
-- caller here, since organization_membership.user_id values are Better
-- Auth user IDs, not Supabase Auth UIDs — so these policies amount to
-- deny-all for that surface today, which is the correct outcome.

-- ============================================================================
-- Organization-scoped tables — same is_org_member_for_rls(organization_id)
-- pattern as rls_policies.sql / add_remaining_rls_policies.sql.
-- ============================================================================

ALTER TABLE bulk_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY bulk_operations_org_access ON bulk_operations
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY bulk_operations_org_insert ON bulk_operations
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY bulk_operations_org_update ON bulk_operations
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY bulk_operations_org_delete ON bulk_operations
FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE epd_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY epd_records_org_access ON epd_records
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY epd_records_org_insert ON epd_records
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY epd_records_org_update ON epd_records
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY epd_records_org_delete ON epd_records
FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE embodied_carbon_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY embodied_carbon_records_org_access ON embodied_carbon_records
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY embodied_carbon_records_org_insert ON embodied_carbon_records
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY embodied_carbon_records_org_update ON embodied_carbon_records
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY embodied_carbon_records_org_delete ON embodied_carbon_records
FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_events_org_access ON usage_events
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY usage_events_org_insert ON usage_events
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

ALTER TABLE carbon_offsets ENABLE ROW LEVEL SECURITY;
CREATE POLICY carbon_offsets_org_access ON carbon_offsets
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY carbon_offsets_org_insert ON carbon_offsets
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY carbon_offsets_org_update ON carbon_offsets
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY carbon_offsets_org_delete ON carbon_offsets
FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_records_org_access ON compliance_records
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY compliance_records_org_insert ON compliance_records
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY compliance_records_org_update ON compliance_records
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY compliance_records_org_delete ON compliance_records
FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE carbon_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY carbon_budgets_org_access ON carbon_budgets
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY carbon_budgets_org_insert ON carbon_budgets
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY carbon_budgets_org_update ON carbon_budgets
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY carbon_budgets_org_delete ON carbon_budgets
FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE waste_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY waste_records_org_access ON waste_records
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY waste_records_org_insert ON waste_records
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY waste_records_org_update ON waste_records
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY waste_records_org_delete ON waste_records
FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE sbti_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY sbti_targets_org_access ON sbti_targets
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY sbti_targets_org_insert ON sbti_targets
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY sbti_targets_org_update ON sbti_targets
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY sbti_targets_org_delete ON sbti_targets
FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE calculation_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY calculation_schedules_org_access ON calculation_schedules
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY calculation_schedules_org_insert ON calculation_schedules
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY calculation_schedules_org_update ON calculation_schedules
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY calculation_schedules_org_delete ON calculation_schedules
FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE digest_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY digest_preferences_org_access ON digest_preferences
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY digest_preferences_org_insert ON digest_preferences
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY digest_preferences_org_update ON digest_preferences
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY digest_preferences_org_delete ON digest_preferences
FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE project_role_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_role_assignments_org_access ON project_role_assignments
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY project_role_assignments_org_insert ON project_role_assignments
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY project_role_assignments_org_update ON project_role_assignments
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY project_role_assignments_org_delete ON project_role_assignments
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- supplier_invites carries a bearer-style invite token — no SELECT policy
-- for the general org-member case beyond org scoping; still row-scoped by
-- organization_id like every other entry here.
ALTER TABLE supplier_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_invites_org_access ON supplier_invites
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY supplier_invites_org_insert ON supplier_invites
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY supplier_invites_org_update ON supplier_invites
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY supplier_invites_org_delete ON supplier_invites
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- integration_connections carries OAuth access_token/refresh_token —
-- the table flagged specifically for sensitive-column exposure.
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_connections_org_access ON integration_connections
FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY integration_connections_org_insert ON integration_connections
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY integration_connections_org_update ON integration_connections
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY integration_connections_org_delete ON integration_connections
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- ============================================================================
-- Indirectly org-scoped: carbon_budget_phases has no organization_id column
-- of its own — it's scoped via budget_id -> carbon_budgets.organization_id.
-- ============================================================================

ALTER TABLE carbon_budget_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY carbon_budget_phases_org_access ON carbon_budget_phases
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM carbon_budgets cb
    WHERE cb.id = carbon_budget_phases.budget_id
      AND is_org_member_for_rls(cb.organization_id)
  )
);
CREATE POLICY carbon_budget_phases_org_insert ON carbon_budget_phases
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM carbon_budgets cb
    WHERE cb.id = carbon_budget_phases.budget_id
      AND is_org_member_for_rls(cb.organization_id)
  )
);
CREATE POLICY carbon_budget_phases_org_update ON carbon_budget_phases
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM carbon_budgets cb
    WHERE cb.id = carbon_budget_phases.budget_id
      AND is_org_member_for_rls(cb.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM carbon_budgets cb
    WHERE cb.id = carbon_budget_phases.budget_id
      AND is_org_member_for_rls(cb.organization_id)
  )
);
CREATE POLICY carbon_budget_phases_org_delete ON carbon_budget_phases
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM carbon_budgets cb
    WHERE cb.id = carbon_budget_phases.budget_id
      AND is_org_member_for_rls(cb.organization_id)
  )
);

-- ============================================================================
-- Global reference data — not tenant-scoped, seeded by the platform.
-- Read-only for the authenticated role; writes stay app-only (postgres
-- role bypasses RLS for seed/admin scripts).
-- ============================================================================

ALTER TABLE embodied_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY embodied_materials_read ON embodied_materials
FOR SELECT USING (true);

-- ============================================================================
-- No tenant scope, no legitimate PostgREST use case — deny-all. The app's
-- own Prisma connection (postgres role) is unaffected by RLS.
-- ============================================================================

ALTER TABLE storage_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;
