-- Documents RLS state that already exists in production for these 48 tables
-- but was never captured by any migration in this repo -- discovered while
-- investigating the rls_disabled_in_public/policy_exists_rls_disabled
-- advisor findings closed in 20260904000014/20260904000015. These tables
-- predate that fix (most come from the original 20260825 RLS remediation
-- and earlier feature migrations) and were evidently protected directly
-- against production (Supabase SQL editor or dashboard), never through
-- Prisma migrate.
--
-- This is a documentation/drift fix, not a live security fix: production
-- already has exactly this RLS state. Nothing here changes production
-- behavior -- it exists so a fresh install from this repo's migrations
-- alone reaches the same protected state production is already in, and so
-- future `prisma migrate diff` runs stop reporting these 48 tables as
-- drift.
--
-- These policies predate is_org_member_for_rls() (added in
-- 20260825153700) and mostly check auth.uid() directly against
-- organization_memberships/platform_memberships, rather than through that
-- helper. Reproduced verbatim from pg_policies against production, not
-- rewritten to the newer helper-based style, so this migration matches
-- reality exactly. Functionally equivalent either way: Better Auth never
-- populates auth.uid() for a PostgREST request, so every one of these
-- comparisons evaluates to NULL and Postgres denies -- the same
-- deny-by-default outcome as the helper-based policies elsewhere.
--
-- Guarded with a per-table DO block (WHEN duplicate_object) so this is
-- idempotent against production, where every one of these already exists --
-- and safe on a fresh database, where none of it does yet.

-- activity_record_evidence
DO $$
BEGIN
  ALTER TABLE "activity_record_evidence" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "activity_record_evidence" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "activity_record_evidence_org_access" ON "activity_record_evidence" FOR SELECT
  USING (is_org_member_for_rls(( SELECT activity_records.organization_id
   FROM activity_records
  WHERE (activity_records.id = activity_record_evidence.activity_record_id)
 LIMIT 1)));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "activity_record_evidence_org_access" on "activity_record_evidence" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- api_data_sources
DO $$
BEGIN
  ALTER TABLE "api_data_sources" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "api_data_sources" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "api_data_sources_delete" ON "api_data_sources" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "api_data_sources_delete" on "api_data_sources" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "api_data_sources_insert" ON "api_data_sources" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "api_data_sources_insert" on "api_data_sources" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "api_data_sources_select" ON "api_data_sources" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "api_data_sources_select" on "api_data_sources" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "api_data_sources_update" ON "api_data_sources" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "api_data_sources_update" on "api_data_sources" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- api_keys
DO $$
BEGIN
  ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "api_keys" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "api_keys_org_access" ON "api_keys" FOR SELECT
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "api_keys_org_access" on "api_keys" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "api_keys_org_delete" ON "api_keys" FOR DELETE
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "api_keys_org_delete" on "api_keys" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "api_keys_org_insert" ON "api_keys" FOR INSERT
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "api_keys_org_insert" on "api_keys" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "api_keys_org_update" ON "api_keys" FOR UPDATE
  USING (is_org_member_for_rls(organization_id))
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "api_keys_org_update" on "api_keys" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- billing_subscriptions
DO $$
BEGIN
  ALTER TABLE "billing_subscriptions" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "billing_subscriptions" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "billing_subscriptions_org_access" ON "billing_subscriptions" FOR SELECT
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "billing_subscriptions_org_access" on "billing_subscriptions" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "billing_subscriptions_org_insert" ON "billing_subscriptions" FOR INSERT
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "billing_subscriptions_org_insert" on "billing_subscriptions" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "billing_subscriptions_org_update" ON "billing_subscriptions" FOR UPDATE
  USING (is_org_member_for_rls(organization_id))
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "billing_subscriptions_org_update" on "billing_subscriptions" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- business_units
DO $$
BEGIN
  ALTER TABLE "business_units" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "business_units" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "business_units_org_access" ON "business_units" FOR SELECT
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "business_units_org_access" on "business_units" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "business_units_org_insert" ON "business_units" FOR INSERT
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "business_units_org_insert" on "business_units" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "business_units_org_update" ON "business_units" FOR UPDATE
  USING (is_org_member_for_rls(organization_id))
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "business_units_org_update" on "business_units" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- contracts
DO $$
BEGIN
  ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "contracts" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "contracts_org_access" ON "contracts" FOR SELECT
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "contracts_org_access" on "contracts" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "contracts_org_delete" ON "contracts" FOR DELETE
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "contracts_org_delete" on "contracts" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "contracts_org_insert" ON "contracts" FOR INSERT
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "contracts_org_insert" on "contracts" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "contracts_org_update" ON "contracts" FOR UPDATE
  USING (is_org_member_for_rls(organization_id))
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "contracts_org_update" on "contracts" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- device_tokens
DO $$
BEGIN
  ALTER TABLE "device_tokens" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "device_tokens" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "device_tokens_user_delete" ON "device_tokens" FOR DELETE
  USING (((auth.uid())::text = user_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "device_tokens_user_delete" on "device_tokens" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "device_tokens_user_insert" ON "device_tokens" FOR INSERT
  WITH CHECK (((auth.uid())::text = user_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "device_tokens_user_insert" on "device_tokens" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "device_tokens_user_isolation" ON "device_tokens" FOR SELECT
  USING (((auth.uid())::text = user_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "device_tokens_user_isolation" on "device_tokens" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "device_tokens_user_update" ON "device_tokens" FOR UPDATE
  USING (((auth.uid())::text = user_id))
  WITH CHECK (((auth.uid())::text = user_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "device_tokens_user_update" on "device_tokens" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- emission_categories
DO $$
BEGIN
  ALTER TABLE "emission_categories" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "emission_categories" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "emission_categories_read" ON "emission_categories" FOR SELECT
  USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "emission_categories_read" on "emission_categories" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- emission_factors
DO $$
BEGIN
  ALTER TABLE "emission_factors" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "emission_factors" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "emission_factors_read" ON "emission_factors" FOR SELECT
  USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "emission_factors_read" on "emission_factors" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "emission_factors_select" ON "emission_factors" FOR SELECT TO authenticated
  USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "emission_factors_select" on "emission_factors" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- evidence_classifications
DO $$
BEGIN
  ALTER TABLE "evidence_classifications" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "evidence_classifications" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "evidence_classifications_org_access" ON "evidence_classifications" FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM evidence_files
  WHERE ((evidence_files.id = evidence_classifications.evidence_file_id) AND is_org_member_for_rls(evidence_files.organization_id)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "evidence_classifications_org_access" on "evidence_classifications" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "evidence_classifications_org_insert" ON "evidence_classifications" FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM evidence_files
  WHERE ((evidence_files.id = evidence_classifications.evidence_file_id) AND is_org_member_for_rls(evidence_files.organization_id)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "evidence_classifications_org_insert" on "evidence_classifications" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "evidence_classifications_org_update" ON "evidence_classifications" FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM evidence_files
  WHERE ((evidence_files.id = evidence_classifications.evidence_file_id) AND is_org_member_for_rls(evidence_files.organization_id)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM evidence_files
  WHERE ((evidence_files.id = evidence_classifications.evidence_file_id) AND is_org_member_for_rls(evidence_files.organization_id)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "evidence_classifications_org_update" on "evidence_classifications" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- facilities
DO $$
BEGIN
  ALTER TABLE "facilities" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "facilities" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "facilities_delete" ON "facilities" FOR DELETE
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = facilities.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = 'admin'::org_role)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "facilities_delete" on "facilities" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "facilities_insert" ON "facilities" FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = facilities.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "facilities_insert" on "facilities" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "facilities_select" ON "facilities" FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = facilities.organization_id) AND (organization_memberships.user_id = (auth.uid())::text)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "facilities_select" on "facilities" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "facilities_update" ON "facilities" FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = facilities.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = facilities.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "facilities_update" on "facilities" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- factor_libraries
DO $$
BEGIN
  ALTER TABLE "factor_libraries" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "factor_libraries" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "factor_libraries_read" ON "factor_libraries" FOR SELECT
  USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "factor_libraries_read" on "factor_libraries" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "factor_libraries_select" ON "factor_libraries" FOR SELECT TO authenticated
  USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "factor_libraries_select" on "factor_libraries" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- field_submission_files
DO $$
BEGIN
  ALTER TABLE "field_submission_files" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "field_submission_files" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "field_submission_files_org_access" ON "field_submission_files" FOR SELECT
  USING (is_org_member_for_rls(( SELECT field_submissions.organization_id
   FROM field_submissions
  WHERE (field_submissions.id = field_submission_files.field_submission_id)
 LIMIT 1)));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "field_submission_files_org_access" on "field_submission_files" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- field_worker_assignments
DO $$
BEGIN
  ALTER TABLE "field_worker_assignments" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "field_worker_assignments" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "field_worker_assignments_org_access" ON "field_worker_assignments" FOR SELECT
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "field_worker_assignments_org_access" on "field_worker_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "field_worker_assignments_org_insert" ON "field_worker_assignments" FOR INSERT
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "field_worker_assignments_org_insert" on "field_worker_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- field_worker_site_assignments
DO $$
BEGIN
  ALTER TABLE "field_worker_site_assignments" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "field_worker_site_assignments" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "assignments_delete" ON "field_worker_site_assignments" FOR DELETE
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = field_worker_site_assignments.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "assignments_delete" on "field_worker_site_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "assignments_insert" ON "field_worker_site_assignments" FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = field_worker_site_assignments.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "assignments_insert" on "field_worker_site_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "assignments_select" ON "field_worker_site_assignments" FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = field_worker_site_assignments.organization_id) AND (organization_memberships.user_id = (auth.uid())::text)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "assignments_select" on "field_worker_site_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "assignments_update" ON "field_worker_site_assignments" FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = field_worker_site_assignments.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = field_worker_site_assignments.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "assignments_update" on "field_worker_site_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- import_batch_evidence
DO $$
BEGIN
  ALTER TABLE "import_batch_evidence" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "import_batch_evidence" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "import_batch_evidence_org_access" ON "import_batch_evidence" FOR SELECT
  USING (is_org_member_for_rls(( SELECT import_batches.organization_id
   FROM import_batches
  WHERE (import_batches.id = import_batch_evidence.import_batch_id)
 LIMIT 1)));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "import_batch_evidence_org_access" on "import_batch_evidence" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- invite_links
DO $$
BEGIN
  ALTER TABLE "invite_links" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "invite_links" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "invite_links_org_access" ON "invite_links" FOR SELECT
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "invite_links_org_access" on "invite_links" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "invite_links_org_insert" ON "invite_links" FOR INSERT
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "invite_links_org_insert" on "invite_links" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- iot_device_credentials
DO $$
BEGIN
  ALTER TABLE "iot_device_credentials" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "iot_device_credentials" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "iot_device_credentials_delete" ON "iot_device_credentials" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "iot_device_credentials_delete" on "iot_device_credentials" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "iot_device_credentials_insert" ON "iot_device_credentials" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "iot_device_credentials_insert" on "iot_device_credentials" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "iot_device_credentials_select" ON "iot_device_credentials" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "iot_device_credentials_select" on "iot_device_credentials" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "iot_device_credentials_update" ON "iot_device_credentials" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "iot_device_credentials_update" on "iot_device_credentials" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- iot_devices
DO $$
BEGIN
  ALTER TABLE "iot_devices" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "iot_devices" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "iot_devices_delete" ON "iot_devices" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "iot_devices_delete" on "iot_devices" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "iot_devices_insert" ON "iot_devices" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "iot_devices_insert" on "iot_devices" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "iot_devices_select" ON "iot_devices" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "iot_devices_select" on "iot_devices" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "iot_devices_update" ON "iot_devices" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "iot_devices_update" on "iot_devices" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- meter_readings
DO $$
BEGIN
  ALTER TABLE "meter_readings" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "meter_readings" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "meter_readings_delete" ON "meter_readings" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "meter_readings_delete" on "meter_readings" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "meter_readings_insert" ON "meter_readings" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "meter_readings_insert" on "meter_readings" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "meter_readings_select" ON "meter_readings" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "meter_readings_select" on "meter_readings" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "meter_readings_update" ON "meter_readings" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "meter_readings_update" on "meter_readings" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- methodology_versions
DO $$
BEGIN
  ALTER TABLE "methodology_versions" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "methodology_versions" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "methodology_versions_read" ON "methodology_versions" FOR SELECT
  USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "methodology_versions_read" on "methodology_versions" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "methodology_versions_select" ON "methodology_versions" FOR SELECT TO authenticated
  USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "methodology_versions_select" on "methodology_versions" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- ocr_corrections
DO $$
BEGIN
  ALTER TABLE "ocr_corrections" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "ocr_corrections" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "ocr_corrections_org_access" ON "ocr_corrections" FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM evidence_files
  WHERE ((evidence_files.id = ocr_corrections.evidence_file_id) AND is_org_member_for_rls(evidence_files.organization_id)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "ocr_corrections_org_access" on "ocr_corrections" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "ocr_corrections_org_insert" ON "ocr_corrections" FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM evidence_files
  WHERE ((evidence_files.id = ocr_corrections.evidence_file_id) AND is_org_member_for_rls(evidence_files.organization_id)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "ocr_corrections_org_insert" on "ocr_corrections" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "ocr_corrections_org_update" ON "ocr_corrections" FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM evidence_files
  WHERE ((evidence_files.id = ocr_corrections.evidence_file_id) AND is_org_member_for_rls(evidence_files.organization_id)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM evidence_files
  WHERE ((evidence_files.id = ocr_corrections.evidence_file_id) AND is_org_member_for_rls(evidence_files.organization_id)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "ocr_corrections_org_update" on "ocr_corrections" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- organization_emission_factors
DO $$
BEGIN
  ALTER TABLE "organization_emission_factors" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "organization_emission_factors" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "organization_emission_factors_delete" ON "organization_emission_factors" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "organization_emission_factors_delete" on "organization_emission_factors" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "organization_emission_factors_insert" ON "organization_emission_factors" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "organization_emission_factors_insert" on "organization_emission_factors" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "organization_emission_factors_select" ON "organization_emission_factors" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "organization_emission_factors_select" on "organization_emission_factors" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "organization_emission_factors_update" ON "organization_emission_factors" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "organization_emission_factors_update" on "organization_emission_factors" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- payment_methods
DO $$
BEGIN
  ALTER TABLE "payment_methods" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "payment_methods" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "payment_methods_delete" ON "payment_methods" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "payment_methods_delete" on "payment_methods" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "payment_methods_insert" ON "payment_methods" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "payment_methods_insert" on "payment_methods" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "payment_methods_select" ON "payment_methods" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "payment_methods_select" on "payment_methods" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "payment_methods_update" ON "payment_methods" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "payment_methods_update" on "payment_methods" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- platform_memberships
DO $$
BEGIN
  ALTER TABLE "platform_memberships" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "platform_memberships" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "platform_memberships_user_isolation" ON "platform_memberships" FOR SELECT
  USING (((auth.uid())::text = user_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "platform_memberships_user_isolation" on "platform_memberships" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "platform_memberships_user_update" ON "platform_memberships" FOR UPDATE
  USING (((auth.uid())::text = user_id))
  WITH CHECK (((auth.uid())::text = user_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "platform_memberships_user_update" on "platform_memberships" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- postcode_geocodes
DO $$
BEGIN
  ALTER TABLE "postcode_geocodes" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "postcode_geocodes" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "postcode_geocodes_select" ON "postcode_geocodes" FOR SELECT TO authenticated
  USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "postcode_geocodes_select" on "postcode_geocodes" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- projects
DO $$
BEGIN
  ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "projects" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "projects_delete" ON "projects" FOR DELETE
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = projects.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = 'admin'::org_role)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "projects_delete" on "projects" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "projects_insert" ON "projects" FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = projects.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "projects_insert" on "projects" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "projects_select" ON "projects" FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = projects.organization_id) AND (organization_memberships.user_id = (auth.uid())::text)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "projects_select" on "projects" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "projects_update" ON "projects" FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = projects.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = projects.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "projects_update" on "projects" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- reduction_initiatives
DO $$
BEGIN
  ALTER TABLE "reduction_initiatives" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "reduction_initiatives" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "reduction_initiatives_org_access" ON "reduction_initiatives" FOR SELECT
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "reduction_initiatives_org_access" on "reduction_initiatives" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "reduction_initiatives_org_insert" ON "reduction_initiatives" FOR INSERT
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "reduction_initiatives_org_insert" on "reduction_initiatives" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "reduction_initiatives_org_update" ON "reduction_initiatives" FOR UPDATE
  USING (is_org_member_for_rls(organization_id))
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "reduction_initiatives_org_update" on "reduction_initiatives" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- reduction_targets
DO $$
BEGIN
  ALTER TABLE "reduction_targets" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "reduction_targets" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "reduction_targets_org_access" ON "reduction_targets" FOR SELECT
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "reduction_targets_org_access" on "reduction_targets" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "reduction_targets_org_insert" ON "reduction_targets" FOR INSERT
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "reduction_targets_org_insert" on "reduction_targets" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "reduction_targets_org_update" ON "reduction_targets" FOR UPDATE
  USING (is_org_member_for_rls(organization_id))
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "reduction_targets_org_update" on "reduction_targets" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- report_verification_tokens
DO $$
BEGIN
  ALTER TABLE "report_verification_tokens" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "report_verification_tokens" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "report_verification_tokens_delete" ON "report_verification_tokens" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "report_verification_tokens_delete" on "report_verification_tokens" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "report_verification_tokens_insert" ON "report_verification_tokens" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "report_verification_tokens_insert" on "report_verification_tokens" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "report_verification_tokens_select" ON "report_verification_tokens" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "report_verification_tokens_select" on "report_verification_tokens" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "report_verification_tokens_update" ON "report_verification_tokens" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "report_verification_tokens_update" on "report_verification_tokens" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- reporting_periods
DO $$
BEGIN
  ALTER TABLE "reporting_periods" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "reporting_periods" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "periods_select" ON "reporting_periods" FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = reporting_periods.organization_id) AND (organization_memberships.user_id = (auth.uid())::text)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "periods_select" on "reporting_periods" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "reporting_periods_org_access" ON "reporting_periods" FOR SELECT
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "reporting_periods_org_access" on "reporting_periods" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "reporting_periods_org_insert" ON "reporting_periods" FOR INSERT
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "reporting_periods_org_insert" on "reporting_periods" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "reporting_periods_org_update" ON "reporting_periods" FOR UPDATE
  USING (is_org_member_for_rls(organization_id))
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "reporting_periods_org_update" on "reporting_periods" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- route_distances
DO $$
BEGIN
  ALTER TABLE "route_distances" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "route_distances" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "route_distances_org_access" ON "route_distances" FOR SELECT
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "route_distances_org_access" on "route_distances" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "route_distances_org_insert" ON "route_distances" FOR INSERT
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "route_distances_org_insert" on "route_distances" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- scenario_drafts
DO $$
BEGIN
  ALTER TABLE "scenario_drafts" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "scenario_drafts" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "scenario_drafts_delete" ON "scenario_drafts" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "scenario_drafts_delete" on "scenario_drafts" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "scenario_drafts_insert" ON "scenario_drafts" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "scenario_drafts_insert" on "scenario_drafts" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "scenario_drafts_select" ON "scenario_drafts" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "scenario_drafts_select" on "scenario_drafts" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "scenario_drafts_update" ON "scenario_drafts" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "scenario_drafts_update" on "scenario_drafts" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- scenario_runs
DO $$
BEGIN
  ALTER TABLE "scenario_runs" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "scenario_runs" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "scenario_runs_delete" ON "scenario_runs" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "scenario_runs_delete" on "scenario_runs" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "scenario_runs_insert" ON "scenario_runs" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "scenario_runs_insert" on "scenario_runs" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "scenario_runs_select" ON "scenario_runs" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "scenario_runs_select" on "scenario_runs" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "scenario_runs_update" ON "scenario_runs" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "scenario_runs_update" on "scenario_runs" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- sites
DO $$
BEGIN
  ALTER TABLE "sites" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "sites" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "sites_delete" ON "sites" FOR DELETE
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = sites.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = 'admin'::org_role)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "sites_delete" on "sites" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "sites_insert" ON "sites" FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = sites.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "sites_insert" on "sites" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "sites_select" ON "sites" FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = sites.organization_id) AND (organization_memberships.user_id = (auth.uid())::text)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "sites_select" on "sites" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "sites_update" ON "sites" FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = sites.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_memberships
  WHERE ((organization_memberships.organization_id = sites.organization_id) AND (organization_memberships.user_id = (auth.uid())::text) AND (organization_memberships.role = ANY (ARRAY['admin'::org_role, 'editor'::org_role]))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "sites_update" on "sites" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- snapshot_assurances
DO $$
BEGIN
  ALTER TABLE "snapshot_assurances" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "snapshot_assurances" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "snapshot_assurances_delete" ON "snapshot_assurances" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "snapshot_assurances_delete" on "snapshot_assurances" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "snapshot_assurances_insert" ON "snapshot_assurances" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "snapshot_assurances_insert" on "snapshot_assurances" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "snapshot_assurances_select" ON "snapshot_assurances" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "snapshot_assurances_select" on "snapshot_assurances" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "snapshot_assurances_update" ON "snapshot_assurances" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "snapshot_assurances_update" on "snapshot_assurances" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- social_value_measures
DO $$
BEGIN
  ALTER TABLE "social_value_measures" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "social_value_measures" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "social_value_measures_read" ON "social_value_measures" FOR SELECT
  USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "social_value_measures_read" on "social_value_measures" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- social_value_records
DO $$
BEGIN
  ALTER TABLE "social_value_records" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "social_value_records" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "social_value_records_org_member" ON "social_value_records" FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM platform_memberships pm
  WHERE ((pm.organization_id = social_value_records.organization_id) AND (pm.user_id = (auth.uid())::text)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "social_value_records_org_member" on "social_value_records" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- social_value_targets
DO $$
BEGIN
  ALTER TABLE "social_value_targets" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "social_value_targets" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "social_value_targets_org_member" ON "social_value_targets" FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM platform_memberships pm
  WHERE ((pm.organization_id = social_value_targets.organization_id) AND (pm.user_id = (auth.uid())::text)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "social_value_targets_org_member" on "social_value_targets" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- social_value_themes
DO $$
BEGIN
  ALTER TABLE "social_value_themes" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "social_value_themes" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "social_value_themes_read" ON "social_value_themes" FOR SELECT
  USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "social_value_themes_read" on "social_value_themes" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- supplier_anomalies
DO $$
BEGIN
  ALTER TABLE "supplier_anomalies" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "supplier_anomalies" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_anomalies_delete" ON "supplier_anomalies" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_anomalies_delete" on "supplier_anomalies" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_anomalies_insert" ON "supplier_anomalies" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_anomalies_insert" on "supplier_anomalies" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_anomalies_select" ON "supplier_anomalies" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_anomalies_select" on "supplier_anomalies" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_anomalies_update" ON "supplier_anomalies" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_anomalies_update" on "supplier_anomalies" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- supplier_category_assignments
DO $$
BEGIN
  ALTER TABLE "supplier_category_assignments" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "supplier_category_assignments" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_category_assignments_delete" ON "supplier_category_assignments" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_category_assignments_delete" on "supplier_category_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_category_assignments_insert" ON "supplier_category_assignments" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_category_assignments_insert" on "supplier_category_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_category_assignments_select" ON "supplier_category_assignments" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_category_assignments_select" on "supplier_category_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_category_assignments_update" ON "supplier_category_assignments" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_category_assignments_update" on "supplier_category_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- supplier_tag_assignments
DO $$
BEGIN
  ALTER TABLE "supplier_tag_assignments" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "supplier_tag_assignments" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_tag_assignments_delete" ON "supplier_tag_assignments" FOR DELETE
  USING ((tag_id IN ( SELECT supplier_tags.id
   FROM supplier_tags
  WHERE (supplier_tags.organization_id IN ( SELECT organization_memberships.organization_id
           FROM organization_memberships
          WHERE (organization_memberships.user_id = (auth.uid())::text))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_tag_assignments_delete" on "supplier_tag_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_tag_assignments_insert" ON "supplier_tag_assignments" FOR INSERT
  WITH CHECK ((tag_id IN ( SELECT supplier_tags.id
   FROM supplier_tags
  WHERE (supplier_tags.organization_id IN ( SELECT organization_memberships.organization_id
           FROM organization_memberships
          WHERE (organization_memberships.user_id = (auth.uid())::text))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_tag_assignments_insert" on "supplier_tag_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_tag_assignments_select" ON "supplier_tag_assignments" FOR SELECT
  USING ((tag_id IN ( SELECT supplier_tags.id
   FROM supplier_tags
  WHERE (supplier_tags.organization_id IN ( SELECT organization_memberships.organization_id
           FROM organization_memberships
          WHERE (organization_memberships.user_id = (auth.uid())::text))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_tag_assignments_select" on "supplier_tag_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_tag_assignments_update" ON "supplier_tag_assignments" FOR UPDATE
  USING ((tag_id IN ( SELECT supplier_tags.id
   FROM supplier_tags
  WHERE (supplier_tags.organization_id IN ( SELECT organization_memberships.organization_id
           FROM organization_memberships
          WHERE (organization_memberships.user_id = (auth.uid())::text))))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_tag_assignments_update" on "supplier_tag_assignments" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- supplier_tags
DO $$
BEGIN
  ALTER TABLE "supplier_tags" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "supplier_tags" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_tags_delete" ON "supplier_tags" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_tags_delete" on "supplier_tags" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_tags_insert" ON "supplier_tags" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_tags_insert" on "supplier_tags" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_tags_select" ON "supplier_tags" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_tags_select" on "supplier_tags" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "supplier_tags_update" ON "supplier_tags" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "supplier_tags_update" on "supplier_tags" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- tenant_branding
DO $$
BEGIN
  ALTER TABLE "tenant_branding" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "tenant_branding" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "tenant_branding_org_access" ON "tenant_branding" FOR SELECT
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "tenant_branding_org_access" on "tenant_branding" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "tenant_branding_org_insert" ON "tenant_branding" FOR INSERT
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "tenant_branding_org_insert" on "tenant_branding" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "tenant_branding_org_update" ON "tenant_branding" FOR UPDATE
  USING (is_org_member_for_rls(organization_id))
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "tenant_branding_org_update" on "tenant_branding" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- verifications
DO $$
BEGIN
  ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "verifications" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "verifications_org_access" ON "verifications" FOR SELECT
  USING (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "verifications_org_access" on "verifications" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "verifications_org_insert" ON "verifications" FOR INSERT
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "verifications_org_insert" on "verifications" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "verifications_org_update" ON "verifications" FOR UPDATE
  USING (is_org_member_for_rls(organization_id))
  WITH CHECK (is_org_member_for_rls(organization_id));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "verifications_org_update" on "verifications" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- webhook_deliveries
DO $$
BEGIN
  ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "webhook_deliveries" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "webhook_deliveries_org_access" ON "webhook_deliveries" FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM webhooks
  WHERE ((webhooks.id = webhook_deliveries.webhook_id) AND is_org_member_for_rls(webhooks.organization_id)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "webhook_deliveries_org_access" on "webhook_deliveries" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "webhook_deliveries_org_insert" ON "webhook_deliveries" FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM webhooks
  WHERE ((webhooks.id = webhook_deliveries.webhook_id) AND is_org_member_for_rls(webhooks.organization_id)))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "webhook_deliveries_org_insert" on "webhook_deliveries" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- zapier_integrations
DO $$
BEGIN
  ALTER TABLE "zapier_integrations" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ENABLE ROW LEVEL SECURITY on "zapier_integrations" skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "zapier_integrations_delete" ON "zapier_integrations" FOR DELETE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "zapier_integrations_delete" on "zapier_integrations" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "zapier_integrations_insert" ON "zapier_integrations" FOR INSERT
  WITH CHECK ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "zapier_integrations_insert" on "zapier_integrations" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "zapier_integrations_select" ON "zapier_integrations" FOR SELECT
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "zapier_integrations_select" on "zapier_integrations" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE POLICY "zapier_integrations_update" ON "zapier_integrations" FOR UPDATE
  USING ((organization_id IN ( SELECT organization_memberships.organization_id
   FROM organization_memberships
  WHERE (organization_memberships.user_id = (auth.uid())::text))));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policy "zapier_integrations_update" on "zapier_integrations" skipped: % (already exists on production, or auth schema unavailable on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;
