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
import { Radio } from "lucide-react";
import { IngestSignalButton } from "./signals-actions";

interface Props {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ signalType?: string; source?: string }>;
}

const VIEW_ROLES: OrgRole[] = [
  "admin", "sustainability_director", "sustainability_manager",
  "editor", "reviewer", "viewer", "auditor",
];

const INGEST_ROLES: OrgRole[] = ["admin", "sustainability_director", "sustainability_manager", "editor"];

export default async function SignalsPage({ params, searchParams }: Props) {
  const { orgId } = await params;
  const { signalType, source } = await searchParams;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, ...VIEW_ROLES);
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    throw err;
  }

  const canIngest = INGEST_ROLES.includes(role);

  const [signals, signalTypes] = await Promise.all([
    prisma.carbonSignal.findMany({
      where: {
        organizationId: orgId,
        ...(signalType && { signalType }),
        ...(source && { source }),
      },
      orderBy: { recordedAt: "desc" },
      take: 200,
    }),
    prisma.carbonSignal.findMany({
      where: { organizationId: orgId },
      select: { signalType: true, source: true },
      distinct: ["signalType"],
      orderBy: { signalType: "asc" },
    }),
  ]);

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF]">
              <Radio className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">Carbon Intelligence</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Carbon Signals</h1>
              <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
                Real-time and near-real-time carbon data ingested from external sources.
              </p>
            </div>
            {canIngest && <IngestSignalButton orgId={orgId} signalTypes={signalTypes.map((s) => s.signalType)} />}
          </div>

          {signals.length > 0 && (
            <div className="mt-6 flex gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-[#111827] tabular-nums">{signals.length}</span>
                <span className="text-xs text-[#6B7280] uppercase tracking-wide font-medium">signals</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-[#111827] tabular-nums">{signalTypes.length}</span>
                <span className="text-xs text-[#6B7280] uppercase tracking-wide font-medium">types</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">
              Signals
              <span className="ml-2 text-xs font-normal text-[#6B7280]">({signals.length})</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#6B7280] mt-0.5">
              Up to 200 most recent shown, ordered by recorded date.
            </CardDescription>
          </CardHeader>
          <CardContent className={signals.length === 0 ? "py-10" : "p-0"}>
            {signals.length === 0 ? (
              <div className="text-center">
                <p className="text-sm text-[#6B7280]">No signals ingested yet. Connect an integration or manually ingest a signal.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3 pl-6">Signal type</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Source</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Region</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3 text-right">Value</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3 pr-6">Recorded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {signals.map((s) => (
                      <TableRow key={s.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <TableCell className="py-3.5 pl-6">
                          <span className="text-sm font-mono font-medium text-[#111827]">{s.signalType}</span>
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">{s.source}</TableCell>
                        <TableCell className="text-sm text-[#6B7280] py-3.5">{s.region ?? "-"}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-[#111827] tabular-nums py-3.5">
                          {Number(s.value).toLocaleString("en-GB", { maximumFractionDigits: 6 })}{" "}
                          <span className="text-xs font-normal text-[#6B7280]">{s.unit}</span>
                        </TableCell>
                        <TableCell className="text-sm text-[#6B7280] tabular-nums py-3.5 pr-6">
                          {new Date(s.recordedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
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
      <p className="text-sm text-red-600">You do not have permission to view carbon signals.</p>
    </div>
  );
}
