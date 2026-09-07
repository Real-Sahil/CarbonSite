/**
 * DocuSeal webhook handler — processes signature lifecycle events.
 *
 * Configure in DocuSeal → Account → Webhooks:
 *   URL: https://your-domain/api/webhooks/docuseal
 *   Events: submission.completed, submission.declined, submission.expired
 *   Secret: $DOCUSEAL_WEBHOOK_SECRET
 *
 * Signature verification uses HMAC-SHA256 on the raw request body.
 * The header name is X-DocuSeal-Signature.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { verifyWebhookSignature } from "@/lib/integrations/docuseal";

type DocuSealEvent = {
  event_type:
    | "submission.completed"
    | "submission.declined"
    | "submission.expired"
    | "submitter.completed"
    | "submitter.opened"
    | string;
  data: {
    id: number;
    status: string;
    submitters?: Array<{
      id: number;
      email: string;
      status: string;
      completed_at?: string;
    }>;
  };
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-docuseal-signature") ?? "";

  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  if (secret) {
    const valid = await verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      console.warn("[webhook/docuseal] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn("[webhook/docuseal] DOCUSEAL_WEBHOOK_SECRET not set — skipping signature verification");
  }

  let event: DocuSealEvent;
  try {
    event = JSON.parse(rawBody) as DocuSealEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const submissionId = event.data?.id;
  if (!submissionId) {
    return NextResponse.json({ received: true });
  }

  const record = await prisma.documentSignatureRequest.findFirst({
    where: { docusealSubmissionId: submissionId },
    select: { id: true, organizationId: true, reportId: true, status: true },
  });

  if (!record) {
    // Unknown submission — acknowledge without error (DocuSeal retries on non-2xx)
    return NextResponse.json({ received: true });
  }

  // Ignore if already in a terminal state
  if (record.status === "signed" || record.status === "declined") {
    return NextResponse.json({ received: true });
  }

  let newStatus: "signed" | "declined" | "expired" | null = null;
  let signedAt: Date | null = null;
  let declinedAt: Date | null = null;

  switch (event.event_type) {
    case "submission.completed": {
      newStatus = "signed";
      const completedSubmitter = event.data.submitters?.find(
        (s) => s.status === "completed",
      );
      signedAt = completedSubmitter?.completed_at
        ? new Date(completedSubmitter.completed_at)
        : new Date();
      break;
    }
    case "submission.declined":
      newStatus = "declined";
      declinedAt = new Date();
      break;
    case "submission.expired":
      newStatus = "expired";
      break;
    default:
      // submitter.opened, submitter.completed — no DB state change needed
      return NextResponse.json({ received: true });
  }

  if (newStatus) {
    await prisma.documentSignatureRequest.update({
      where: { id: record.id },
      data: {
        status: newStatus,
        ...(signedAt && { signedAt }),
        ...(declinedAt && { declinedAt }),
      },
    });

    await writeAuditLog({
      organizationId: record.organizationId,
      actorUserId: null,
      action: `report.signature_${newStatus}`,
      resourceType: "document_signature_request",
      resourceId: record.id,
      metadata: { docusealSubmissionId: submissionId, reportId: record.reportId },
    });

    console.log(
      `[webhook/docuseal] submission=${submissionId} record=${record.id} → ${newStatus}`,
    );
  }

  return NextResponse.json({ received: true });
}
