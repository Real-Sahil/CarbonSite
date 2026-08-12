-- Add RLS policies for organization-scoped tables

-- ============================================================================
-- api_keys: org members can access their org's API keys
-- ============================================================================

CREATE POLICY api_keys_org_access ON api_keys
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY api_keys_org_insert ON api_keys
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY api_keys_org_update ON api_keys
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY api_keys_org_delete ON api_keys
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- ============================================================================
-- audit_log: org members can read (not modify) their org's audit logs
-- ============================================================================

CREATE POLICY audit_log_org_read ON audit_log
FOR SELECT USING (is_org_member_for_rls(organization_id));

-- ============================================================================
-- billing_subscriptions: org members can view their org's billing
-- ============================================================================

CREATE POLICY billing_subscriptions_org_access ON billing_subscriptions
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY billing_subscriptions_org_insert ON billing_subscriptions
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY billing_subscriptions_org_update ON billing_subscriptions
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- ============================================================================
-- contracts: org members can access their org's contracts
-- ============================================================================

CREATE POLICY contracts_org_access ON contracts
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY contracts_org_insert ON contracts
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY contracts_org_update ON contracts
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY contracts_org_delete ON contracts
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- ============================================================================
-- emission_categories: globally readable (reference data)
-- ============================================================================

CREATE POLICY emission_categories_read ON emission_categories
FOR SELECT USING (true);

-- ============================================================================
-- evidence_classifications: org members can access classifications in their org
-- ============================================================================

CREATE POLICY evidence_classifications_org_access ON evidence_classifications
FOR SELECT USING (EXISTS (
  SELECT 1 FROM evidence_files
  WHERE evidence_files.id = evidence_classifications.evidence_file_id
  AND is_org_member_for_rls(evidence_files.organization_id)
));

CREATE POLICY evidence_classifications_org_insert ON evidence_classifications
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM evidence_files
  WHERE evidence_files.id = evidence_classifications.evidence_file_id
  AND is_org_member_for_rls(evidence_files.organization_id)
));

CREATE POLICY evidence_classifications_org_update ON evidence_classifications
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM evidence_files
  WHERE evidence_files.id = evidence_classifications.evidence_file_id
  AND is_org_member_for_rls(evidence_files.organization_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM evidence_files
  WHERE evidence_files.id = evidence_classifications.evidence_file_id
  AND is_org_member_for_rls(evidence_files.organization_id)
));

-- ============================================================================
-- invite_link: org members can access invitation links in their org
-- ============================================================================

CREATE POLICY invite_link_org_access ON invite_link
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY invite_link_org_insert ON invite_link
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY invite_link_org_update ON invite_link
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY invite_link_org_delete ON invite_link
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- ============================================================================
-- ocr_corrections: org members can access OCR corrections in their org
-- ============================================================================

CREATE POLICY ocr_corrections_org_access ON ocr_corrections
FOR SELECT USING (EXISTS (
  SELECT 1 FROM evidence_files
  WHERE evidence_files.id = ocr_corrections.evidence_file_id
  AND is_org_member_for_rls(evidence_files.organization_id)
));

CREATE POLICY ocr_corrections_org_insert ON ocr_corrections
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM evidence_files
  WHERE evidence_files.id = ocr_corrections.evidence_file_id
  AND is_org_member_for_rls(evidence_files.organization_id)
));

CREATE POLICY ocr_corrections_org_update ON ocr_corrections
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM evidence_files
  WHERE evidence_files.id = ocr_corrections.evidence_file_id
  AND is_org_member_for_rls(evidence_files.organization_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM evidence_files
  WHERE evidence_files.id = ocr_corrections.evidence_file_id
  AND is_org_member_for_rls(evidence_files.organization_id)
));

-- ============================================================================
-- platform_memberships: users can only see their own platform membership
-- ============================================================================

CREATE POLICY platform_memberships_user_isolation ON platform_memberships
FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY platform_memberships_user_update ON platform_memberships
FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- ============================================================================
-- staged_activity_records: org members can access their org's staged records
-- ============================================================================

CREATE POLICY staged_activity_records_org_access ON staged_activity_records
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY staged_activity_records_org_insert ON staged_activity_records
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY staged_activity_records_org_update ON staged_activity_records
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY staged_activity_records_org_delete ON staged_activity_records
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- ============================================================================
-- tenant_branding: org members can access their org's branding
-- ============================================================================

CREATE POLICY tenant_branding_org_access ON tenant_branding
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY tenant_branding_org_insert ON tenant_branding
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY tenant_branding_org_update ON tenant_branding
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- ============================================================================
-- webhook_deliveries: org members can view webhook deliveries via their webhooks
-- ============================================================================

CREATE POLICY webhook_deliveries_org_access ON webhook_deliveries
FOR SELECT USING (EXISTS (
  SELECT 1 FROM webhooks
  WHERE webhooks.id = webhook_deliveries.webhook_id
  AND is_org_member_for_rls(webhooks.organization_id)
));

CREATE POLICY webhook_deliveries_org_insert ON webhook_deliveries
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM webhooks
  WHERE webhooks.id = webhook_deliveries.webhook_id
  AND is_org_member_for_rls(webhooks.organization_id)
));

-- ============================================================================
-- webhooks: org members can access their org's webhooks
-- ============================================================================

CREATE POLICY webhooks_org_access ON webhooks
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY webhooks_org_insert ON webhooks
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY webhooks_org_update ON webhooks
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY webhooks_org_delete ON webhooks
FOR DELETE USING (is_org_member_for_rls(organization_id));
