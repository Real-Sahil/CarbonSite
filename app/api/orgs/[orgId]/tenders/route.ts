export const dynamic = "force-dynamic";

/** GET /api/orgs/{orgId}/tenders?status=open|all|dismissed&cursor= : matched Find a Tender notices. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { TENDER_READERS } from "@/lib/tenders/fts";
import { handleRouteError } from "@/lib/validation/api";

const PAGE = 50;

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...TENDER_READERS);
    const status = req.nextUrl.searchParams.get("status") ?? "open";
    const cursor = req.nextUrl.searchParams.get("cursor");
    const where = {
      organizationId: orgId,
      ...(status === "dismissed" ? { status: "dismissed" } : status === "all" ? {} : { status: { not: "dismissed" }, OR: [{ deadline: null }, { deadline: { gt: new Date() } }] }),
    };
    const rows = await prisma.tenderOpportunity.findMany({
      where,
      orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const more = rows.length > PAGE;
    const data = more ? rows.slice(0, PAGE) : rows;
    return NextResponse.json({ data, nextCursor: more ? data[data.length - 1].id : null });
  } catch (err) {
    return handleRouteError(err);
  }
}
