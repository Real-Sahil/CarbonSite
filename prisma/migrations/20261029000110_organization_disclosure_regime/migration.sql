-- Disclosure regime the Executive Summary reports readiness against. Additive and nullable: no deployed code depends on it.
ALTER TABLE "organizations" ADD COLUMN "disclosure_regime" TEXT;
