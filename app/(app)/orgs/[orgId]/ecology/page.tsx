export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { OrgRole } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Leaf, TreePine, Bird, ShieldAlert, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import Link from "next/link";
import { RunScanDialog, DeleteScanButton, SpeciesTable, type SpeciesRecord } from "./scan-actions";

const MANAGE_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "editor",
];

interface Props {
  params: Promise<{ orgId: string }>;
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatHa(value: unknown) {
  const n = Number(value ?? 0);
  if (!n) return "0 ha";
  return `${n.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ha`;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "running":
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
          Running
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

function Denied() {
  return (
    <div className="p-8 text-center">
      <p className="text-sm text-muted-foreground">
        You do not have permission to view this page.
      </p>
    </div>
  );
}

type DesignatedSite = {
  name: string;
  type: string;
  distanceKm: number | null;
  areaSqKm: number | null;
  notifiedOn: string | null;
  condition: string | null;
};

type WoodlandParcel = {
  name: string;
  type: string;
  areaHa: number;
  ifc: string | null;
};

export default async function EcologyPage({ params }: Props) {
  const { orgId } = await params;

  let role: OrgRole | null = null;
  let authErr: AuthError | null = null;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      authErr = err;
    } else {
      return (
        <div className="p-8">
          <p className="text-sm text-red-600">
            Failed to load page. Try refreshing.
          </p>
        </div>
      );
    }
  }

  if (authErr) {
    if (authErr.status === 401) redirect("/sign-in");
    return <Denied />;
  }

  const canManage = MANAGE_ROLES.includes(role!);

  const [projects, scansRaw] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, postcode: true },
    }),
    prisma.ecologicalScan.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
  ]);

  const scansByProject = new Map<string, typeof scansRaw>();
  for (const scan of scansRaw) {
    const arr = scansByProject.get(scan.projectId) ?? [];
    arr.push(scan);
    scansByProject.set(scan.projectId, arr);
  }

  const projectsWithPostcode = projects.filter((p) => p.postcode);
  const projectsWithoutPostcode = projects.filter((p) => !p.postcode);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Leaf className="h-6 w-6 text-green-600" />
          Ecology Scans
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live flora, fauna, habitat designations, and woodland data fetched from
          NBN Atlas, Natural England MAGIC, and the Forestry Commission.
        </p>
      </div>

      {projects.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No projects in this organisation. Create a project first, then add
            its UK postcode to run ecology scans.
          </CardContent>
        </Card>
      )}

      {projectsWithoutPostcode.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Projects missing a postcode
            </CardTitle>
            <CardDescription>
              Add a UK postcode to each project to enable ecology scans.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {projectsWithoutPostcode.map((p) => (
                <li key={p.id} className="text-amber-800 dark:text-amber-300">
                  {p.name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {projectsWithPostcode.map((project) => {
        const scans = scansByProject.get(project.id) ?? [];
        const latest = scans[0] ?? null;

        return (
          <Card key={project.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <CardDescription>
                    Postcode: <span className="font-mono">{project.postcode}</span>
                    {latest && (
                      <> &middot; Last scan: {formatDate(latest.scannedAt ?? latest.createdAt)}</>
                    )}
                  </CardDescription>
                </div>
                {canManage && (
                  <RunScanDialog
                    orgId={orgId}
                    projectId={project.id}
                    defaultPostcode={project.postcode}
                  />
                )}
              </div>
            </CardHeader>

            {scans.length === 0 && (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No scans yet.{" "}
                  {canManage
                    ? "Run the first scan above."
                    : "An editor or admin can run a scan."}
                </p>
              </CardContent>
            )}

            {scans.length > 0 && (
              <CardContent className="space-y-4">
                {scans.map((scan, idx) => (
                  <details
                    key={scan.id}
                    open={idx === 0}
                    className="group rounded-lg border bg-card"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm select-none hover:bg-muted/50 rounded-lg">
                      <StatusBadge status={scan.status} />
                      <span className="font-medium">
                        {formatDate(scan.scannedAt ?? scan.createdAt)}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {scan.postcode} &middot; {Number(scan.radiusKm)} km
                      </span>
                      {scan.status === "completed" && (
                        <span className="text-muted-foreground">
                          {scan.totalSpeciesCount.toLocaleString()} species records
                        </span>
                      )}
                    </summary>

                    <div className="px-4 pb-4 space-y-6 border-t mt-0 pt-4">
                      {scan.status === "failed" && (
                        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200">
                          <p className="text-sm text-red-700 dark:text-red-400">
                            {scan.errorMessage ?? "Scan failed."}
                          </p>
                        </div>
                      )}

                      {scan.status === "completed" && (
                        <>
                          {/* Species breakdown */}
                          <div>
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                              <Bird className="h-4 w-4 text-sky-600" />
                              Species breakdown (within {Number(scan.radiusKm)} km)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {[
                                { label: "Plants", value: scan.plantSpeciesCount },
                                { label: "Birds", value: scan.birdSpeciesCount },
                                { label: "Mammals", value: scan.mammalSpeciesCount },
                                { label: "Invertebrates", value: scan.invertSpeciesCount },
                                { label: "Reptiles", value: scan.reptileSpeciesCount },
                                { label: "Amphibians", value: scan.amphibianSpeciesCount },
                                { label: "Other", value: scan.otherSpeciesCount },
                              ].map(({ label, value }) => (
                                <div
                                  key={label}
                                  className="rounded-lg border bg-background p-3 text-center"
                                >
                                  <p className="text-2xl font-semibold tabular-nums">
                                    {value.toLocaleString()}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Species records table — paginated, sorted high-risk first */}
                          {Array.isArray(scan.speciesRecords) &&
                            (scan.speciesRecords as unknown as SpeciesRecord[]).length > 0 && (
                              <div>
                                <h3 className="text-sm font-semibold mb-2">
                                  Species inventory ({(scan.speciesRecords as unknown as SpeciesRecord[]).length} species — sorted by conservation risk)
                                </h3>
                                <SpeciesTable species={scan.speciesRecords as unknown as SpeciesRecord[]} />
                              </div>
                            )}

                          {/* Designated sites */}
                          <div>
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                              <ShieldAlert className="h-4 w-4 text-amber-600" />
                              Designated sites (within 5 km minimum)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                              {[
                                { label: "SSSI", value: scan.sssiCount },
                                { label: "SAC", value: scan.sacCount },
                                { label: "SPA", value: scan.spaCount },
                                { label: "NNR", value: scan.nvrCount },
                                { label: "Ancient Woodland", value: scan.ancientWoodlandCount },
                              ].map(({ label, value }) => (
                                <div
                                  key={label}
                                  className="rounded-lg border bg-background p-3 text-center"
                                >
                                  <p className="text-2xl font-semibold tabular-nums">{value}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                                </div>
                              ))}
                            </div>
                            {Array.isArray(scan.designatedSites) &&
                              (scan.designatedSites as unknown as DesignatedSite[]).length > 0 && (
                                <div className="rounded-md border overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Notified</TableHead>
                                        <TableHead>Condition</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {(scan.designatedSites as unknown as DesignatedSite[]).map(
                                        (s, i) => (
                                          <TableRow key={i}>
                                            <TableCell className="font-medium">{s.name}</TableCell>
                                            <TableCell>
                                              <Badge variant="outline">{s.type}</Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                              {s.notifiedOn ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                              {s.condition ?? "—"}
                                            </TableCell>
                                          </TableRow>
                                        )
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                          </div>

                          {/* Woodland */}
                          <div>
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                              <TreePine className="h-4 w-4 text-green-700" />
                              Woodland cover (National Forest Inventory)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                              {[
                                { label: "Total woodland", value: formatHa(scan.woodlandTotalHa) },
                                { label: "Broadleaf", value: formatHa(scan.broadleafHa) },
                                { label: "Conifer", value: formatHa(scan.coniferHa) },
                                { label: "Mixed", value: formatHa(scan.mixedWoodlandHa) },
                              ].map(({ label, value }) => (
                                <div
                                  key={label}
                                  className="rounded-lg border bg-background p-3 text-center"
                                >
                                  <p className="text-xl font-semibold tabular-nums">{value}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                                </div>
                              ))}
                            </div>
                            {Array.isArray(scan.woodlandData) &&
                              (scan.woodlandData as unknown as WoodlandParcel[]).length > 0 && (
                                <div className="rounded-md border overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Parcel name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Area (ha)</TableHead>
                                        <TableHead>IFC status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {(scan.woodlandData as unknown as WoodlandParcel[]).map((w, i) => (
                                        <TableRow key={i}>
                                          <TableCell className="font-medium">{w.name}</TableCell>
                                          <TableCell>
                                            <Badge variant="outline">{w.type}</Badge>
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums">
                                            {w.areaHa.toLocaleString("en-GB", { maximumFractionDigits: 2 })}
                                          </TableCell>
                                          <TableCell className="text-muted-foreground">
                                            {w.ifc ?? "—"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Scanned by {scan.createdBy.name ?? scan.createdBy.email}
                        </p>
                        <div className="flex items-center gap-2">
                          {scan.status === "completed" && (
                            <Link href={`/orgs/${orgId}/reports`}>
                              <Button variant="outline" size="sm" className="gap-1.5">
                                <FileText className="h-3.5 w-3.5" />
                                Generate Report
                              </Button>
                            </Link>
                          )}
                          {canManage && (
                            <DeleteScanButton
                              orgId={orgId}
                              projectId={project.id}
                              scanId={scan.id}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
