export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network, ChevronDown } from "lucide-react";
import { CreateFrameworkButton, EditFrameworkButton, DeleteFrameworkButton } from "./frameworks-actions";

interface Props {
  params: Promise<{ orgId: string }>;
}

const ADMIN_ROLES: OrgRole[] = ["admin", "sustainability_director"];

export default async function FrameworksPage({ params }: Props) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, ...ADMIN_ROLES);
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    throw err;
  }

  const frameworks = await prisma.svFramework.findMany({
    where: { organizationId: orgId },
    include: {
      themes: {
        orderBy: { sortOrder: "asc" },
        include: {
          outcomes: {
            orderBy: { sortOrder: "asc" },
            include: {
              measures: true,
              indicators: true,
            },
          },
        },
      },
      _count: { select: { commitments: true } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF7ED]">
              <Network className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
              Social Value
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Frameworks</h1>
              <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
                Define measurement frameworks (e.g. TOMS, PPN06/21, custom) with themes, outcomes, measures, and indicators.
              </p>
            </div>
            <CreateFrameworkButton orgId={orgId} />
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-4">
        {frameworks.length === 0 ? (
          <EmptyState />
        ) : (
          frameworks.map((fw) => (
            <Card key={fw.id} className="border-[#E5E7EB] shadow-none">
              <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold text-[#111827]">{fw.name}</CardTitle>
                      {fw.isDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                      {fw.version && (
                        <span className="text-xs text-[#9CA3AF]">v{fw.version}</span>
                      )}
                    </div>
                    {fw.description && (
                      <CardDescription className="text-xs text-[#9CA3AF] mt-0.5 max-w-[60ch]">
                        {fw.description}
                      </CardDescription>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-[#9CA3AF]">
                        <span className="font-medium text-[#374151]">{fw.themes.length}</span> themes
                      </span>
                      <span className="text-xs text-[#9CA3AF]">
                        <span className="font-medium text-[#374151]">{fw._count.commitments}</span> commitments
                      </span>
                      <span className="text-xs font-mono text-[#9CA3AF]">{fw.slug}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <EditFrameworkButton orgId={orgId} framework={fw} />
                    <DeleteFrameworkButton
                      orgId={orgId}
                      frameworkId={fw.id}
                      name={fw.name}
                      commitmentCount={fw._count.commitments}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {fw.themes.length === 0 ? (
                  <p className="px-6 py-4 text-xs text-[#9CA3AF]">No themes defined yet.</p>
                ) : (
                  <div className="divide-y divide-[#F3F4F6]">
                    {fw.themes.map((theme) => (
                      <details key={theme.id} className="group">
                        <summary className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-[#F9FAFB] list-none">
                          <div className="flex items-center gap-3">
                            <ChevronDown className="h-3.5 w-3.5 text-[#9CA3AF] group-open:rotate-180 transition-transform" />
                            <span className="text-sm font-medium text-[#111827]">{theme.name}</span>
                            {theme.code && (
                              <span className="text-xs text-[#9CA3AF] font-mono">{theme.code}</span>
                            )}
                          </div>
                          <span className="text-xs text-[#9CA3AF]">
                            {theme.outcomes.length} outcomes
                          </span>
                        </summary>
                        {theme.outcomes.length > 0 && (
                          <div className="px-6 pb-3 ml-6 border-l-2 border-[#F3F4F6] ml-10">
                            {theme.outcomes.map((outcome) => (
                              <div key={outcome.id} className="py-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    {outcome.code && (
                                      <span className="text-xs font-mono text-[#f97316]">{outcome.code}</span>
                                    )}
                                    <span className="text-xs text-[#374151]">{outcome.name}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-[#9CA3AF] flex-shrink-0">
                                    {outcome.measures.length > 0 && (
                                      <span>{outcome.measures.length} measures</span>
                                    )}
                                    {outcome.indicators.length > 0 && (
                                      <span>{outcome.indicators.length} indicators</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </details>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-[#E5E7EB] shadow-none">
      <CardContent className="pb-8 pt-8">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF7ED]">
            <Network className="h-7 w-7 text-[#111827]" />
          </div>
          <div>
            <p className="font-normal text-[#111827] tracking-[-0.42px]">No frameworks yet</p>
            <p className="text-sm text-[#374151] tracking-[-0.42px] mt-[7px] max-w-sm">
              Create a measurement framework to define how social value commitments are structured and measured.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AccessDenied() {
  return (
    <div className="p-8">
      <p className="text-sm text-red-600">Admin or Sustainability Director role required to manage frameworks.</p>
    </div>
  );
}
