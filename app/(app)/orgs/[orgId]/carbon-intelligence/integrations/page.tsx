export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plug } from "lucide-react";
import { AddCredentialButton, EditCredentialButton, DeleteCredentialButton } from "./integrations-actions";

interface Props {
  params: Promise<{ orgId: string }>;
}

const ADMIN_ROLES: OrgRole[] = ["admin", "sustainability_director"];

export default async function IntegrationsPage({ params }: Props) {
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

  const credentials = await prisma.externalApiCredential.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      provider: true,
      label: true,
      scopes: true,
      isActive: true,
      lastValidatedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF]">
              <Plug className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">Carbon Intelligence</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">External Integrations</h1>
              <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
                API credentials for external carbon data sources. Keys are encrypted at rest.
              </p>
            </div>
            <AddCredentialButton orgId={orgId} />
          </div>

          {credentials.length > 0 && (
            <div className="mt-6 flex gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-[#111827] tabular-nums">{credentials.length}</span>
                <span className="text-xs text-[#6B7280] uppercase tracking-wide font-medium">credentials</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-[#111827] tabular-nums">
                  {credentials.filter((c) => c.isActive).length}
                </span>
                <span className="text-xs text-[#6B7280] uppercase tracking-wide font-medium">active</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">
              Credentials
              <span className="ml-2 text-xs font-normal text-[#6B7280]">({credentials.length})</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#6B7280] mt-0.5">
              API keys are encrypted with AES-256-GCM and never returned in responses.
            </CardDescription>
          </CardHeader>
          <CardContent className={credentials.length === 0 ? "py-10" : "p-0"}>
            {credentials.length === 0 ? (
              <div className="text-center">
                <p className="text-sm text-[#6B7280]">No credentials configured. Add an API key to start ingesting carbon signals automatically.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3 pl-6">Provider</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Label</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Scopes</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Status</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Last validated</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Added</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3 pr-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credentials.map((c) => (
                      <TableRow key={c.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <TableCell className="py-3.5 pl-6">
                          <span className="text-sm font-mono font-medium text-[#111827]">{c.provider}</span>
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">{c.label ?? <span className="text-[#6B7280]">-</span>}</TableCell>
                        <TableCell className="py-3.5">
                          {c.scopes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {c.scopes.map((s) => (
                                <span key={s} className="inline-block rounded bg-[#F3F4F6] px-1.5 py-0.5 text-xs font-mono text-[#374151]">{s}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-[#6B7280]">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <Badge variant={c.isActive ? "default" : "outline"} className="text-xs">
                            {c.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-[#6B7280] tabular-nums py-3.5">
                          {c.lastValidatedAt
                            ? new Date(c.lastValidatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-[#6B7280] tabular-nums py-3.5">
                          {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="py-3.5 pr-6">
                          <div className="flex items-center gap-1">
                            <EditCredentialButton orgId={orgId} credential={c} />
                            <DeleteCredentialButton orgId={orgId} credentialId={c.id} provider={c.provider} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-8">
      <p className="text-sm text-red-600">You do not have permission to manage integrations.</p>
    </div>
  );
}
