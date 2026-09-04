export const dynamic = "force-dynamic";

// The framework datapoint crosswalk: for every disclosure requirement across
// ESRS E1, GRI 305, CDP, SECR, IFRS S2 and the GHG Protocol, can this
// organisation actually answer it today, and from what. Resolved datapoints
// are checked live against the org's own data; narrative datapoints fall
// back to whatever a human has recorded as evidence.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { runResolver } from "@/lib/compliance/datapoint-resolvers";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const url = new URL(req.url);
    const frameworkFilter = url.searchParams.get("framework");

    const [datapoints, overrides] = await Promise.all([
      prisma.frameworkDatapoint.findMany({
        where: frameworkFilter ? { framework: frameworkFilter as never } : undefined,
        orderBy: [{ framework: "asc" }, { code: "asc" }],
      }),
      prisma.organizationDatapointStatus.findMany({
        where: { organizationId: orgId },
        include: { recordedBy: { select: { name: true, email: true } } },
      }),
    ]);

    const overrideByDatapoint = new Map(overrides.map((o) => [o.datapointId, o]));

    const results = await Promise.all(
      datapoints.map(async (dp) => {
        const override = overrideByDatapoint.get(dp.id);

        if (dp.resolverKey) {
          const resolved = await runResolver(dp.resolverKey, orgId, prisma);
          if (resolved) {
            return {
              ...dp,
              status: resolved.status,
              evidenceSummary: resolved.evidenceSummary,
              source: "automatic" as const,
              manualOverride: override
                ? { status: override.status, evidenceSummary: override.evidenceSummary, recordedBy: override.recordedBy }
                : null,
            };
          }
        }

        // Narrative datapoint, or a resolver key that no longer exists: fall
        // back to whatever a human has recorded, defaulting to a gap.
        return {
          ...dp,
          status: override?.status ?? "gap",
          evidenceSummary: override?.evidenceSummary ?? "No evidence recorded. This disclosure needs a manual entry.",
          source: "manual" as const,
          manualOverride: override
            ? { status: override.status, evidenceSummary: override.evidenceSummary, recordedBy: override.recordedBy }
            : null,
        };
      }),
    );

    const byFramework = new Map<string, typeof results>();
    for (const r of results) {
      const list = byFramework.get(r.framework) ?? [];
      list.push(r);
      byFramework.set(r.framework, list);
    }

    const frameworkSummaries = Array.from(byFramework.entries()).map(([framework, rows]) => {
      const applicable = rows.filter((r) => r.status !== "not_applicable");
      const satisfied = applicable.filter((r) => r.status === "satisfied").length;
      const partial = applicable.filter((r) => r.status === "partial").length;
      const gap = applicable.filter((r) => r.status === "gap").length;
      return {
        framework,
        total: rows.length,
        applicable: applicable.length,
        satisfied,
        partial,
        gap,
        readinessPercent: applicable.length > 0 ? (satisfied / applicable.length) * 100 : 0,
      };
    });

    return Response.json({
      data: results,
      frameworkSummaries,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
