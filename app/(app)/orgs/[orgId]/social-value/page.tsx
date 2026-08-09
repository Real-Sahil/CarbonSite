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

  const [themes, records, contracts, periods] = await Promise.all([
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
  ]);

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
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      {/* Page header */}
      <div>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0F172A] bg-[#EEF2FF] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Social Value
        </p>
        <h1
          className="text-2xl font-bold tracking-tight text-[#0F172A]"
          style={{
            
            fontWeight: 300,
          }}
        >
          National TOMS Social Value
        </h1>
        <p className="text-sm text-[#475569] font-normal tracking-[-0.42px] mt-[7px]">
          Track and report social value delivered across contracts using the National TOMs framework.
        </p>
      </div>

      {/* Summary stats */}
      {records.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-[14px] border border-[#E2E8F0] bg-[#EEF2FF] px-6 py-4">
            <p className="text-xs text-[#0F172A] tracking-[-0.36px] font-normal">
              Total social value delivered
            </p>
            <p
              className="text-[32px] leading-[1.2] tracking-[-0.4px] text-[#0F172A] mt-1"
              style={{
                
                fontWeight: 300,
              }}
            >
              {formatGbp(totalPounds)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {themes.map((theme) => {
              const themePounds = themetotals[theme.code] ?? 0;
              return (
                <div
                  key={theme.code}
                  className="rounded-[14px] border border-[#E2E8F0] bg-white px-4 py-4 flex flex-col gap-1"
                >
                  <span className="text-xs font-medium text-[#0F172A] tracking-[-0.36px]">
                    {theme.code}
                  </span>
                  <span className="text-xs text-[#475569] tracking-[-0.36px] leading-[1.4]">
                    {theme.name}
                  </span>
                  <span className="text-base font-medium text-[#0F172A] tracking-[-0.4px] mt-1">
                    {formatGbp(themePounds)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add record card */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add social value record</CardTitle>
            <CardDescription>
              Record the social value delivered against a TOMS measure for a contract and reporting period.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Records{" "}
            <span className="text-sm font-normal text-[#475569]">({records.length})</span>
          </CardTitle>
          <CardDescription>
            Social value records submitted for this organisation. Up to 200 most recent shown.
          </CardDescription>
        </CardHeader>
        <CardContent className={records.length === 0 ? "pb-8" : "p-0 pb-2"}>
          {records.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date added</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Measure</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  {canEdit && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-[#475569] tabular-nums">
                      {record.createdAt.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-[#475569]">{record.contract.name}</TableCell>
                    <TableCell className="text-[#475569]">{record.reportingPeriod.label}</TableCell>
                    <TableCell className="text-[#475569]">
                      <span className="font-medium text-[#0F172A]">{record.measure.theme.code}</span>
                      {" "}
                      <span className="text-xs">{record.measure.theme.name}</span>
                    </TableCell>
                    <TableCell className="text-[#475569]">
                      <span className="font-medium">{record.measure.tomsCode}</span>
                      {" — "}
                      {record.measure.name}
                    </TableCell>
                    <TableCell className="text-[#475569] tabular-nums">
                      {Number(record.quantity).toLocaleString("en-GB")} {record.measure.unit}
                    </TableCell>
                    <TableCell className="text-right text-[#0F172A] font-medium tabular-nums">
                      {formatGbp(Number(record.valuePounds))}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <DeleteSocialValueRecordButton
                          orgId={orgId}
                          recordId={record.id}
                          label={`${record.measure.tomsCode} — ${record.contract.name}`}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-[42px]">
      <p className="text-sm text-[#475569] tracking-[-0.42px]">
        You do not have permission to view social value records.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF]">
        <Heart className="h-7 w-7 text-[#0F172A]" />
      </div>
      <div>
        <p className="font-normal text-[#0F172A] tracking-[-0.42px]">No social value records yet</p>
        <p className="text-sm text-[#475569] tracking-[-0.42px] mt-[7px] max-w-sm">
          Add your first record to begin tracking TOMS social value delivered across your contracts.
        </p>
      </div>
    </div>
  );
}
