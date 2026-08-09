import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Heart } from "lucide-react";
import {
  CreateSocialValueRecordForm,
  DeleteSocialValueRecordButton,
  type ThemeWithMeasures,
} from "./social-value-actions";

interface Props {
  params: Promise<{ orgId: string }>;
}

function formatGbp(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const EDIT_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "contract_manager",
  "editor",
];

const VIEW_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "contract_manager",
  "editor",
  "reviewer",
  "viewer",
  "auditor",
];

export default async function SocialValuePage({ params }: Props) {
  const { orgId } = await params;

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

  const canEdit = EDIT_ROLES.includes(role);

  const queryResult = await Promise.all([
    prisma.socialValueTheme.findMany({
      orderBy: { code: "asc" },
      include: {
        measures: { orderBy: { tomsCode: "asc" } },
      },
    }),
    prisma.socialValueRecord.findMany({
      where: { organizationId: orgId },
      include: {
        measure: {
          include: { theme: { select: { code: true, name: true } } },
        },
        contract: { select: { name: true } },
        reportingPeriod: { select: { label: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.contract.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true },
      orderBy: [{ startDate: "desc" }],
    }),
  ]).catch((dbErr: unknown) => {
    console.error("[SocialValuePage] DB error:", dbErr);
    return null;
  });

  if (!queryResult) {
    return <DbErrorState />;
  }

  const [themes, records, contracts, periods] = queryResult;

  // Compute totals
  const totalPounds = records.reduce((sum, r) => sum + Number(r.valuePounds), 0);

  // Per-theme totals (keyed by theme code)
  const themetotals: Record<string, number> = {};
  for (const r of records) {
    const code = r.measure.theme.code;
    themetotals[code] = (themetotals[code] ?? 0) + Number(r.valuePounds);
  }

  // Serialise measures for client component (Decimal -> number)
  const themesForClient: ThemeWithMeasures[] = themes.map((t) => ({
    code: t.code,
    name: t.name,
    measures: t.measures.map((m) => ({
      id: m.id,
      tomsCode: m.tomsCode,
      name: m.name,
      unit: m.unit,
      valuePerUnit: Number(m.valuePerUnit),
    })),
  }));

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF]">
              <Heart className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
              Social Value
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            National TOMS Social Value
          </h1>
          <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
            Track and report social value delivered across contracts using the National TOMs framework.
          </p>

          {/* Summary stats */}
          {records.length > 0 && (
            <div className="mt-6 flex flex-col gap-4">
              <div className="inline-flex items-baseline gap-2">
                <span className="text-xs text-[#9CA3AF] uppercase tracking-wide font-medium">Total social value delivered</span>
                <span className="text-2xl font-bold text-[#111827] tabular-nums">{formatGbp(totalPounds)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {themes.map((theme) => {
                  const themePounds = themetotals[theme.code] ?? 0;
                  return (
                    <div
                      key={theme.code}
                      className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 flex flex-col gap-1"
                    >
                      <span className="text-xs font-semibold text-[#0EA5E9]">
                        {theme.code}
                      </span>
                      <span className="text-xs text-[#9CA3AF] leading-[1.4]">
                        {theme.name}
                      </span>
                      <span className="text-sm font-semibold text-[#111827] tabular-nums mt-1">
                        {formatGbp(themePounds)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Add record card */}
        {canEdit && (
          <Card className="border-[#E5E7EB] shadow-none">
            <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
              <CardTitle className="text-sm font-semibold text-[#111827]">Add social value record</CardTitle>
              <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
                Record the social value delivered against a TOMS measure for a contract and reporting period.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <CreateSocialValueRecordForm
                orgId={orgId}
                themes={themesForClient}
                contracts={contracts}
                periods={periods}
              />
            </CardContent>
          </Card>
        )}

        {/* Records table card */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">
              Records
              <span className="ml-2 text-xs font-normal text-[#9CA3AF]">({records.length})</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
              Social value records submitted for this organisation. Up to 200 most recent shown.
            </CardDescription>
          </CardHeader>
          <CardContent className={records.length === 0 ? "pb-8" : "p-0"}>
            {records.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pl-6">Date added</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Contract</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Period</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Theme</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Measure</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Quantity</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 text-right">Value</TableHead>
                      {canEdit && <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pr-6" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <TableCell className="text-sm text-[#9CA3AF] tabular-nums py-3.5 pl-6">
                          {record.createdAt.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">{record.contract.name}</TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">{record.reportingPeriod.label}</TableCell>
                        <TableCell className="py-3.5">
                          <span className="text-sm font-medium text-[#111827]">{record.measure.theme.code}</span>
                          {" "}
                          <span className="text-xs text-[#9CA3AF]">{record.measure.theme.name}</span>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <span className="text-sm font-medium text-[#374151]">{record.measure.tomsCode}</span>
                          {" - "}
                          <span className="text-sm text-[#374151]">{record.measure.name}</span>
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] tabular-nums py-3.5">
                          {Number(record.quantity).toLocaleString("en-GB")} {record.measure.unit}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-[#111827] tabular-nums py-3.5">
                          {formatGbp(Number(record.valuePounds))}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="py-3.5 pr-6">
                            <DeleteSocialValueRecordButton
                              orgId={orgId}
                              recordId={record.id}
                              label={`${record.measure.tomsCode} - ${record.contract.name}`}
                            />
                          </TableCell>
                        )}
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

function DbErrorState() {
  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB] flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 mx-auto mb-4">
          <Heart className="h-6 w-6 text-red-400" />
        </div>
        <p className="font-medium text-[#111827] tracking-[-0.42px]">Could not load Social Value data</p>
        <p className="text-sm text-[#374151] tracking-[-0.42px] mt-2">
          There was a problem reading from the database. This may mean the social value tables need to be set up.
          Run <code className="bg-[#F3F4F6] px-1.5 py-0.5 rounded text-xs">pnpm prisma migrate deploy</code> then{" "}
          <code className="bg-[#F3F4F6] px-1.5 py-0.5 rounded text-xs">pnpm prisma db seed</code> to initialise TOMS data,
          then refresh the page.
        </p>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-8">
      <p className="text-sm text-red-600">You do not have permission to view social value records.</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F9FF]">
        <Heart className="h-7 w-7 text-[#111827]" />
      </div>
      <div>
        <p className="font-normal text-[#111827] tracking-[-0.42px]">No social value records yet</p>
        <p className="text-sm text-[#374151] tracking-[-0.42px] mt-[7px] max-w-sm">
          Add your first record to begin tracking TOMS social value delivered across your contracts.
        </p>
      </div>
    </div>
  );
}
