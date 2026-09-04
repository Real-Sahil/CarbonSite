export const dynamic = "force-dynamic";

// The framework datapoint crosswalk. For every disclosure requirement across
// ESRS E1, GRI 305, CDP, SECR, IFRS S2 and the GHG Protocol: can this
// organisation answer it today, and from what.

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import { runResolver } from "@/lib/compliance/datapoint-resolvers";
import { CrosswalkView } from "./crosswalk-view";

const MANAGE_ROLES: OrgRole[] = ["admin", "sustainability_director", "sustainability_manager"];

const FRAMEWORK_LABEL: Record<string, string> = {
  esrs_e1: "ESRS E1 (CSRD)",
  gri_305: "GRI 305",
  cdp_climate: "CDP Climate",
  secr: "SECR",
  ifrs_s2: "IFRS S2",
  ghg_protocol: "GHG Protocol",
};

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function CrosswalkPage({ params }: PageProps) {
  const { orgId } = await params;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <Denied />;
    }
    throw err;
  }

  const [datapoints, overrides] = await Promise.all([
    prisma.frameworkDatapoint.findMany({ orderBy: [{ framework: "asc" }, { code: "asc" }] }),
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
            id: dp.id,
            framework: dp.framework,
            code: dp.code,
            title: dp.title,
            description: dp.description,
            category: dp.category,
            resolverKey: dp.resolverKey,
            status: resolved.status,
            evidenceSummary: resolved.evidenceSummary,
            source: "automatic" as const,
            manualEvidenceSummary: override?.evidenceSummary ?? null,
          };
        }
      }

      return {
        id: dp.id,
        framework: dp.framework,
        code: dp.code,
        title: dp.title,
        description: dp.description,
        category: dp.category,
        resolverKey: dp.resolverKey,
        status: override?.status ?? "gap",
        evidenceSummary: override?.evidenceSummary ?? "No evidence recorded. This disclosure needs a manual entry.",
        source: "manual" as const,
        manualEvidenceSummary: override?.evidenceSummary ?? null,
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
    return {
      framework,
      label: FRAMEWORK_LABEL[framework] ?? framework,
      total: rows.length,
      applicable: applicable.length,
      satisfied,
      partial: applicable.filter((r) => r.status === "partial").length,
      gap: applicable.filter((r) => r.status === "gap").length,
      readinessPercent: applicable.length > 0 ? (satisfied / applicable.length) * 100 : 0,
    };
  });

  return (
    <CrosswalkView
      orgId={orgId}
      canEdit={MANAGE_ROLES.includes(role)}
      frameworkSummaries={frameworkSummaries}
      datapoints={results}
    />
  );
}

function Denied() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-1 text-sm text-zinc-500">You do not have permission to view the crosswalk.</p>
    </div>
  );
}
