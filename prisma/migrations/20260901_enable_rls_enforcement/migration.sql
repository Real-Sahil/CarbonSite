-- ============================================================================
-- CRITICAL SECURITY FIX: Enable Row-Level Security (RLS) Enforcement
-- ============================================================================
-- This migration enables RLS on all tables to prevent unauthorized data access.
-- Combined with application-level authorization checks (requireOrgMember()),
-- this provides defense-in-depth protection.
--
-- Status: ENFORCED - All tables will deny access by default until explicit
-- allow policies are created. This prevents public data exposure.
-- ============================================================================

-- ─── AUTH TABLES (User, Session, Account) ───────────────────────────────────
-- Deny public access; allow only via application auth context

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY users_deny_public ON "users" AS PERMISSIVE FOR SELECT
  USING (false);

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY sessions_deny_public ON "sessions" AS PERMISSIVE FOR SELECT
  USING (false);

ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY accounts_deny_public ON "accounts" AS PERMISSIVE FOR SELECT
  USING (false);

-- ─── ORGANIZATION TABLES ────────────────────────────────────────────────────
-- Deny public access to organization data and memberships

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
CREATE POLICY organizations_deny_public ON "organizations" AS PERMISSIVE FOR ALL
  USING (false);

ALTER TABLE "organization_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_memberships_deny_public ON "organization_memberships" AS PERMISSIVE FOR ALL
  USING (false);

-- ─── TENANT-SCOPED TABLES (activity_records, imports, calculations, etc.) ────
-- Deny public access to all org-owned data

ALTER TABLE "activity_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY activity_records_deny_public ON "activity_records" AS PERMISSIVE FOR ALL
  USING (false);

ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY import_batches_deny_public ON "import_batches" AS PERMISSIVE FOR ALL
  USING (false);

ALTER TABLE "staged_activity_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staged_activity_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY staged_activity_records_deny_public ON "staged_activity_records" AS PERMISSIVE FOR ALL
  USING (false);

ALTER TABLE "calculation_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calculation_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY calculation_runs_deny_public ON "calculation_runs" AS PERMISSIVE FOR ALL
  USING (false);

ALTER TABLE "emission_calculations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emission_calculations" FORCE ROW LEVEL SECURITY;
CREATE POLICY emission_calculations_deny_public ON "emission_calculations" AS PERMISSIVE FOR ALL
  USING (false);

ALTER TABLE "published_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "published_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY published_snapshots_deny_public ON "published_snapshots" AS PERMISSIVE FOR ALL
  USING (false);

ALTER TABLE "dashboard_aggregates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dashboard_aggregates" FORCE ROW LEVEL SECURITY;
CREATE POLICY dashboard_aggregates_deny_public ON "dashboard_aggregates" AS PERMISSIVE FOR ALL
  USING (false);

ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY reports_deny_public ON "reports" AS PERMISSIVE FOR ALL
  USING (false);

ALTER TABLE "field_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "field_submissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY field_submissions_deny_public ON "field_submissions" AS PERMISSIVE FOR ALL
  USING (false);

-- ─── SENSITIVE DATA TABLES ──────────────────────────────────────────────────
-- Deny public access to evidence files and audit logs

ALTER TABLE "evidence_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_files" FORCE ROW LEVEL SECURITY;
CREATE POLICY evidence_files_deny_public ON "evidence_files" AS PERMISSIVE FOR ALL
  USING (false);

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_deny_public ON "audit_logs" AS PERMISSIVE FOR SELECT
  USING (false);

-- ─── STORAGE AND FILE MANAGEMENT ────────────────────────────────────────────
-- Deny public access to storage metadata

ALTER TABLE "storage_objects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "storage_objects" FORCE ROW LEVEL SECURITY;
CREATE POLICY storage_objects_deny_public ON "storage_objects" AS PERMISSIVE FOR ALL
  USING (false);

-- ─── REVIEW AND COLLABORATION ──────────────────────────────────────────────
-- Deny public access to tasks, comments, and reviews

ALTER TABLE "review_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_tasks" FORCE ROW LEVEL SECURITY;
CREATE POLICY review_tasks_deny_public ON "review_tasks" AS PERMISSIVE FOR ALL
  USING (false);

ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comments" FORCE ROW LEVEL SECURITY;
CREATE POLICY comments_deny_public ON "comments" AS PERMISSIVE FOR ALL
  USING (false);

-- ─── COMPLIANCE AND ADMIN ────────────────────────────────────────────────────
-- Deny public access to DSAR requests, webhooks, and other sensitive settings

ALTER TABLE "dsar_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dsar_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY dsar_requests_deny_public ON "dsar_requests" AS PERMISSIVE FOR ALL
  USING (false);

ALTER TABLE "webhooks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhooks" FORCE ROW LEVEL SECURITY;
CREATE POLICY webhooks_deny_public ON "webhooks" AS PERMISSIVE FOR ALL
  USING (false);

-- ─── NOTE: PUBLIC ACCESS ────────────────────────────────────────────────────
-- Some endpoints need public access (report verification, supplier portal, etc.)
-- These are currently implemented via API routes with explicit auth checks.
-- Future: Create public schema tables for public-facing features to separate
-- from private tenant data, or add explicit ALLOW policies for specific cases.
