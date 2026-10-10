/**
 * Scheduled monitoring jobs. Called by the Supabase pg_cron schedule in
 * migrations 20260922000010, 20260923000005, 20260923000016, 20260926000045 and 20260927000050 (daily), 20261005000076 (monthly). Each job only alerts once per record or per
 * threshold day, so a repeated or late call is safe.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import {
  dispatchAccountPolicies,
  dispatchEnforcementNoticeMonitoring,
  dispatchPermitExpiryMonitoring,
  dispatchSubmissionSlaMonitoring,
} from "@/lib/jobs/dispatch";
import { processCarbonBudgetAlerts } from "@/lib/project-carbon/burndown-alerts";
import { runTenderWatches } from "@/lib/tenders/watch";
import { processManagementSystemReminders } from "@/lib/management-systems/reminders";
import { processWasteDocumentReminders } from "@/lib/waste/reminders";
import { anonymiseExpiredAuditRows } from "@/lib/audit/anonymise";
import { processMonthlyChecklistReminders } from "@/lib/completeness/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOBS: Record<string, () => Promise<"queued" | "processed">> = {
  "submission-sla": dispatchSubmissionSlaMonitoring,
  "permit-expiry": dispatchPermitExpiryMonitoring,
  "enforcement-notices": dispatchEnforcementNoticeMonitoring,
  // Acts only on orgs that switched supplier policies on in settings.
  "account-policies": () => dispatchAccountPolicies({}),
  // Pure database reads plus notifications; runs inline in either mode.
  "carbon-budgets": async () => {
    await processCarbonBudgetAlerts();
    return "processed";
  },
  // Reads Find a Tender once and records matches for every enabled watch
  // (migration 20260926000045).
  tenders: async () => {
    await runTenderWatches();
    return "processed";
  },
  // Review, due, expiry and certificate dates across the management system
  // registers (migration 20260927000050); each reminder is sent once.
  "management-systems": async () => {
    await processManagementSystemReminders();
    return "processed";
  },
  // The 3rd of each month: editors told what is outstanding for the month just ended
  // (migration 20261005000076); one notification per person per month.
  // Mondays: licences and permits ending soon or just lapsed (migration 20261008000088).
  "waste-documents": async () => {
    await processWasteDocumentReminders();
    return "processed";
  },
  // Monthly: personal fields removed from audit rows past six years (migration 20261012000093).
  "audit-anonymise": async () => {
    await anonymiseExpiredAuditRows();
    return "processed";
  },
  "monthly-checklist": async () => {
    await processMonthlyChecklistReminders();
    return "processed";
  },
};

async function handle(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { job } = await params;
  const run = JOBS[job];
  if (!run) return NextResponse.json({ error: "Unknown job" }, { status: 404 });

  const startedAt = Date.now();
  try {
    const outcome = await run();
    return NextResponse.json({ job, outcome, ms: Date.now() - startedAt });
  } catch (err) {
    console.error(`[schedule/monitors] ${job} failed:`, err);
    return NextResponse.json({ job, error: "Job failed" }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
