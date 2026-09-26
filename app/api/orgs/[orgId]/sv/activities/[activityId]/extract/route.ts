export const dynamic = "force-dynamic";

import { requireFeature } from "@/lib/billing/limits";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { llmClient } from "@/lib/llm/client";
import { aiAssistEnabled } from "@/lib/llm/org-consent";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";

const extractSchema = z.object({
  documentText: z.string().min(1).max(8000),
});

type ExtractedSvData = {
  title?: string;
  description?: string;
  activityDate?: string;
  quantityValue?: number;
  quantityUnit?: string;
  monetisedValue?: number;
  currency?: string;
  confidence: number;
  rawResponse: string;
};

async function extractSvData(documentText: string): Promise<ExtractedSvData> {
  const prompt = `You are a social value data extraction expert for UK construction and public sector contracts.
Extract social value activity data from the following document text.

Document:
"""
${documentText.slice(0, 4000)}
"""

Respond with ONLY these fields, one per line (omit lines you cannot determine):
TITLE: [short activity title, max 100 chars]
DESCRIPTION: [brief description of the social value delivered]
DATE: [YYYY-MM-DD format]
QUANTITY: [numeric value only, e.g. 3]
UNIT: [e.g. jobs, hours, people, training sessions, £]
MONETISED_VALUE: [numeric pounds sterling value if present]
CONFIDENCE: [0.0 to 1.0]

Example:
TITLE: Local employment - groundworks
DATE: 2026-08-15
QUANTITY: 2
UNIT: local jobs created
MONETISED_VALUE: 36200
CONFIDENCE: 0.87`;

  const result = await llmClient.complete(prompt, {
    model: "mistralai/mistral-nemo-12b-instruct",
    maxTokens: 400,
    temperature: 0.1,
  });

  const lines = result.text.split("\n").map((l) => l.trim());
  const get = (key: string) => {
    const line = lines.find((l) => l.startsWith(`${key}:`));
    return line ? line.slice(key.length + 1).trim() : undefined;
  };

  const quantityRaw = get("QUANTITY");
  const monetisedRaw = get("MONETISED_VALUE");
  const confidenceRaw = get("CONFIDENCE");

  return {
    title: get("TITLE"),
    description: get("DESCRIPTION"),
    activityDate: get("DATE"),
    quantityValue: quantityRaw ? parseFloat(quantityRaw) : undefined,
    quantityUnit: get("UNIT"),
    monetisedValue: monetisedRaw ? parseFloat(monetisedRaw) : undefined,
    currency: monetisedRaw ? "GBP" : undefined,
    confidence: confidenceRaw ? Math.min(1, Math.max(0, parseFloat(confidenceRaw))) : 0.5,
    rawResponse: result.text,
  };
}

type RouteContext = { params: Promise<{ orgId: string; activityId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, activityId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor, "contract_manager");
    const planGate = await requireFeature(orgId, "socialValue");
    if (planGate) return planGate;
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sv-extract", session.user.id),
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    if (!(await aiAssistEnabled(orgId))) {
      return apiError("AI_ASSIST_OFF", "AI assistance is off for this organisation. An admin can turn it on in Settings.", 409);
    }

    const activity = await prisma.svActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity not found.", 404);
    }

    const body = extractSchema.parse(await req.json());
    const extracted = await extractSvData(body.documentText);

    // Patch activity with extracted values (don't overwrite user-supplied non-null fields)
    const patch: Record<string, unknown> = {
      aiExtracted: true,
      aiConfidence: new Decimal(extracted.confidence),
      aiRawResponse: { text: extracted.rawResponse },
    };
    if (extracted.title && !activity.title) patch.title = extracted.title;
    if (extracted.description && !activity.description) patch.description = extracted.description;
    if (extracted.activityDate && !activity.activityDate) {
      try { patch.activityDate = new Date(extracted.activityDate); } catch { /* ignore */ }
    }
    if (extracted.quantityValue != null && activity.quantityValue == null) {
      patch.quantityValue = new Decimal(extracted.quantityValue);
    }
    if (extracted.quantityUnit && !activity.quantityUnit) patch.quantityUnit = extracted.quantityUnit;
    if (extracted.monetisedValue != null && activity.monetisedValue == null) {
      patch.monetisedValue = new Decimal(extracted.monetisedValue);
    }

    const updated = await prisma.svActivity.update({
      where: { id: activityId },
      data: patch,
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_activity.ai_extract",
      resourceType: "SvActivity",
      resourceId: activityId,
      metadata: { confidence: extracted.confidence, provider: "ai_assist" },
    });

    return NextResponse.json({ activity: updated, extracted });
  } catch (err) {
    return handleRouteError(err);
  }
}
