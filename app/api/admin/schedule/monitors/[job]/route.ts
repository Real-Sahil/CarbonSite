/**
 * Scheduled monitoring jobs. Called by the Supabase pg_cron schedule in
 * migrations 20260922000010 and 20260923000005 (worker sessions every 5
 * minutes, the rest daily). Each job only alerts once per record or per
 * threshold day, so a repeated or late call is safe.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import {
  dispatchAccountPolicies,
  dispatchEnforcementNoticeMonitoring,
  dispatchPermitExpiryMonitoring,
  dispatchSubmissionSlaMonitoring,
  dispatchWorkerSessionMonitoring,
} from "@/lib/jobs/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOBS: Record<string, () => Promise<"queued" | "processed">> = {
  "worker-sessions": dispatchWorkerSessionMonitoring,
  "submission-sla": dispatchSubmissionSlaMonitoring,
  "permit-expiry": dispatchPermitExpiryMonitoring,
  "enforcement-notices": dispatchEnforcementNoticeMonitoring,
  // Acts only on orgs that switched supplier policies on in settings.
  "account-policies": () => dispatchAccountPolicies({}),
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
