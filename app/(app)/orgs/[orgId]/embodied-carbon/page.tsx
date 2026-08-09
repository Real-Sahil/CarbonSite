import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Layers, Plus, Package } from "lucide-react";
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
import { EmbodiedCarbonForm } from "./embodied-carbon-form";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

function fmtKgCo2e(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} tCO2e`;
  return `${kg.toFixed(2)} kgCO2e`;
}

export default async function EmbodiedCarbonPage({ params }: PageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8 text-sm text-zinc-500">
          You do not have permission to view embodied carbon data.
        </div>
      );
    }
    throw err;
  }

  const [records, materials, projects, reportingPeriods] = await Promise.all([
    prisma.embodiedCarbonRecord.findMany({
      where: { organizationId: orgId },
      include: {
        material: { select: { id: true, name: true, category: true } },
        epd: { select: { id: true, productName: true, manufacturer: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.embodiedMaterial.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.project.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const totalKgCo2e = records.reduce((s, r) => s + r.totalKgCo2e, 0);

  // Group by material category for the breakdown chart
  const byCategory = records.reduce<Record<string, number>>((acc, r) => {
    const cat = r.material?.category ?? "other";
    acc[cat] = (acc[cat] ?? 0) + r.totalKgCo2e;
    return acc;
  }, {});

  const categoryBreakdown = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([category, kgCo2e]) => ({ category, kgCo2e }));

  return (
    <div className="min-h-[100dvh] bg-[#f9fafb]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex items-start gap-3 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF] shrink-0 mt-0.5">
              <Layers className="h-4 w-4 text-[#111827]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">Carbon Accounting</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Embodied Carbon</h1>
              <p className="mt-1 text-sm text-zinc-500 max-w-[65ch]">
                Track cradle-to-gate embodied carbon for construction materials. Factors sourced from ICE Database v3.0 and project-specific EPDs.
              </p>
            </div>
          </div>

          {records.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-6">
              <StatPill label="Total embodied carbon" value={fmtKgCo2e(totalKgCo2e)} accent="green" />
              <StatPill label="Records" value={String(records.length)} />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-col gap-6">

        {/* Category breakdown */}
        {categoryBreakdown.length > 0 && (
          <Card className="border-[#E5E7EB] shadow-none">
            <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
              <CardTitle className="text-sm font-semibold text-zinc-900">Breakdown by material category</CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">kgCO2e A1-A3 cradle-to-gate</CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <div className="space-y-3">
                {categoryBreakdown.map(({ category, kgCo2e }) => {
                  const pct = totalKgCo2e > 0 ? (kgCo2e / totalKgCo2e) * 100 : 0;
                  return (
                    <div key={category} className="flex items-center gap-3">
                      <div className="w-28 shrink-0 text-xs text-zinc-600 capitalize font-medium">{category}</div>
                      <div className="flex-1 bg-[#f3f4f6] rounded-full h-2">
                        <div
                          className="bg-[#228B22] h-2 rounded-full transition-all"
                          style={{ width: `${pct.toFixed(1)}%` }}
                        />
                      </div>
                      <div className="w-28 shrink-0 text-right text-xs tabular-nums text-zinc-600">{fmtKgCo2e(kgCo2e)}</div>
                      <div className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-400">{pct.toFixed(0)}%</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add record form */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-zinc-400" />
              <CardTitle className="text-sm font-semibold text-zinc-900">Add material record</CardTitle>
            </div>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Select a material from the ICE library or upload a project-specific EPD.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <EmbodiedCarbonForm
              orgId={orgId}
              materials={materials.map((m) => ({
                id: m.id,
                name: m.name,
                category: m.category,
                gwpA1A3: m.gwpA1A3,
                declaredUnit: m.declaredUnit,
              }))}
              projects={projects}
              reportingPeriods={reportingPeriods}
            />
          </CardContent>
        </Card>

        {/* Records table */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-zinc-400" />
              <CardTitle className="text-sm font-semibold text-zinc-900">
                Records
                <span className="ml-2 text-xs font-normal text-zinc-400">({records.length})</span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F0F9FF] mb-4">
                  <Package className="h-6 w-6 text-[#111827]" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-1">No embodied carbon records yet</h3>
                <p className="text-sm text-zinc-500 max-w-sm">
                  Add the first material record using the form above. Factors come from ICE Database v3.0.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f9fafb] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-zinc-500 py-3 pl-6">Material</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3">Category</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3">Quantity</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3">Stages</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3">Project</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3">Source</TableHead>
                      <TableHead className="text-xs font-medium text-zinc-500 py-3 text-right pr-6">kgCO2e</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id} className="border-b border-[#f3f4f6] hover:bg-[#f9fafb] transition-colors">
                        <TableCell className="py-3.5 pl-6">
                          <span className="text-sm font-medium text-zinc-900">
                            {record.material?.name ?? record.epd?.productName ?? record.description ?? "Custom"}
                          </span>
                          {record.epd && (
                            <span className="ml-2 text-xs text-zinc-400">EPD</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <span className="text-xs capitalize text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                            {record.material?.category ?? "custom"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600 py-3.5 tabular-nums">
                          {record.quantity.toLocaleString("en-GB")} {record.unit}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <span className="text-xs text-zinc-500">{record.lifecycleStages.join(", ")}</span>
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500 py-3.5">
                          {record.project?.name ?? "-"}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <span className="text-xs text-zinc-500 capitalize">{record.source}</span>
                        </TableCell>
                        <TableCell className="py-3.5 pr-6 text-right tabular-nums">
                          <span className="text-sm font-semibold text-[#111827]">
                            {fmtKgCo2e(record.totalKgCo2e)}
                          </span>
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

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green";
}) {
  const colors = { green: "bg-[#F0F9FF] text-[#111827]" };
  const base = accent ? colors[accent] : "bg-white text-zinc-700 border border-[#E5E7EB]";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${base}`}>
      <span className="tabular-nums font-semibold">{value}</span>
      <span>{label}</span>
    </div>
  );
}
