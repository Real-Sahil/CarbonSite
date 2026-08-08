import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: z.string().datetime().nullable().optional(),
});

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function redactKey(key: string): string {
  return key.slice(0, 12) + "..." + key.slice(-4);
}

// GET /api/orgs/[orgId]/api-keys
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin");

    const keys = await prisma.apiKey.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: keys });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/[orgId]/api-keys
// Returns the raw key once — it is never retrievable again.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request body", 400, parsed.error.flatten());
    }

    const existing = await prisma.apiKey.count({ where: { organizationId: orgId } });
    if (existing >= 10) {
      return apiError("LIMIT_EXCEEDED", "Maximum of 10 API keys per organisation", 400);
    }

    const raw = `csk_${crypto.randomBytes(32).toString("hex")}`;
    const prefix = raw.slice(0, 16);
    const hash = hashKey(raw);

    const key = await prisma.apiKey.create({
      data: {
        organizationId: orgId,
        name: parsed.data.name,
        keyHash: hash,
        prefix,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "api_key.created",
      resourceType: "ApiKey",
      resourceId: key.id,
      metadata: { name: key.name },
    });

    return NextResponse.json({ ...key, rawKey: raw }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
