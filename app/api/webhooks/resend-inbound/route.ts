export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { receiveInboundEmail, verifySvix, type ReceivedEmail } from "@/lib/evidence/bill-inbox";

// POST /api/webhooks/resend-inbound
//
// Resend's `email.received` webhook for the bill inbox. Signed with Svix
// (RESEND_INBOUND_WEBHOOK_SECRET); anything unsigned is refused. A failure
// returns 500 so Resend retries; stored files dedupe on retry.
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ code: "NOT_CONFIGURED", message: "Bill inbox is not configured." }, { status: 503 });

  const raw = await req.text();
  const ok = verifySvix(
    secret,
    { id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") },
    raw,
  );
  if (!ok) return NextResponse.json({ code: "BAD_SIGNATURE", message: "Signature check failed." }, { status: 401 });

  let event: { type?: string; data?: ReceivedEmail };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Body is not JSON." }, { status: 400 });
  }
  if (event.type !== "email.received" || !event.data?.email_id) return NextResponse.json({ received: true, ignored: event.type ?? "unknown" });

  try {
    const outcome = await receiveInboundEmail(event.data);
    return NextResponse.json({ received: true, ...outcome });
  } catch (err) {
    const ref = Sentry.captureException(err);
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Could not store the attachments.", details: { ref } }, { status: 500 });
  }
}
