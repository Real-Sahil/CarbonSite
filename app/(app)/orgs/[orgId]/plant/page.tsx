export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadPlant } from "@/lib/plant/load";
import { PLANT_EDITORS } from "@/lib/plant/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddMachineForm, ReadingsUpload } from "./plant-actions";

interface Props {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ days?: string }>;
}

const WINDOWS = [30, 90, 365];
const n = (v: number | null | undefined, dp = 0) =>
  v == null ? "–" : v.toLocaleString("en-GB", { maximumFractionDigits: dp, minimumFractionDigits: dp });
const pct = (v: number | null) => (v == null ? "–" : `${(v * 100).toFixed(0)}%`);

export default async function PlantPage({ params, searchParams }: Props) {
  const { orgId } = await params;
  const { days: daysParam } = await searchParams;

  let role;
  try {
    role = (await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember)).membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    if (err instanceof AuthError) notFound();
    throw err;
  }
  const canEdit = PLANT_EDITORS.includes(role);

  const days = WINDOWS.includes(Number(daysParam)) ? Number(daysParam) : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const [plant, sites] = await Promise.all([
    loadPlant(orgId, from, to),
    prisma.site.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const { totals, assets, reconciliation, factors } = plant;
  const hasReadings = totals.hours > 0 || totals.fuelLitres > 0;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-[42px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Plant</h1>
          <p className="mt-2 max-w-[65ch] text-sm text-[#374151]">
            Engine hours, idling and fuel from your machines&apos; telematics, with the carbon that fuel represents and
            the savings from HVO. These are monitoring figures: your inventory counts the fuel you record, and the
            reconciliation below shows where the two disagree.
          </p>
        </div>
        <nav className="flex gap-1 rounded-md border border-[#E5E7EB] p-1 text-sm" aria-label="Time window">
          {WINDOWS.map((w) => (
            <Link
              key={w}
              href={`/orgs/${orgId}/plant?days=${w}`}
              aria-current={w === days ? "page" : undefined}
              className={`rounded px-3 py-1 ${w === days ? "bg-[#111827] text-white" : "text-[#374151] hover:bg-[#F3F4F6]"}`}
            >
              {w === 365 ? "12 months" : `${w} days`}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Fuel burnt" value={`${n(totals.fuelLitres)} L`} note={`${n(totals.hours)} engine hours`} />
        <Kpi
          label="Carbon from that fuel"
          value={`${n(totals.co2eKg / 1000, 1)} tCO₂e`}
          note={totals.biogenicKg > 0 ? `plus ${n(totals.biogenicKg / 1000, 1)} t biogenic CO₂ (reported separately)` : factors ? factors.library : "No diesel factor in the library"}
        />
        <Kpi
          label="Idling"
          value={pct(totals.idleShare)}
          note={totals.idleHours > 0 ? `${n(totals.idleHours)} of ${n(totals.hours)} hours` : "No idle hours reported"}
          tone={totals.idleShare != null && totals.idleShare > 0.3 ? "warn" : undefined}
        />
        <Kpi
          label="HVO share"
          value={pct(totals.hvoShare)}
          note={totals.hvoSavingKg > 0 ? `${n(totals.hvoSavingKg / 1000, 1)} tCO₂e avoided against diesel` : "Set a machine's fuel to HVO to track this"}
          tone={totals.hvoSavingKg > 0 ? "good" : undefined}
        />
      </div>

      {totals.withoutFactor.length > 0 && (
        <p className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No factor for the fuel of {totals.withoutFactor.join(", ")}, so their carbon is left out of the total.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Machines</CardTitle>
          <CardDescription>
            {hasReadings ? `Last ${days} days, highest fuel first.` : "No telematics readings in this window yet. Connect a feed or upload an export below."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <p className="text-sm text-[#374151]">No machines registered. Add one below, or send a telematics feed and machines are added as they report.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#374151]">
                    <th className="py-2 pr-3 font-normal">Machine</th>
                    <th className="py-2 pr-3 font-normal">Site</th>
                    <th className="py-2 pr-3 font-normal">Fuel</th>
                    <th className="py-2 pr-3 text-right font-normal">Hours</th>
                    <th className="py-2 pr-3 text-right font-normal">Idle</th>
                    <th className="py-2 pr-3 text-right font-normal">L/hour</th>
                    <th className="py-2 pr-3 text-right font-normal">Fuel (L)</th>
                    <th className="py-2 text-right font-normal">tCO₂e</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {assets.map((a) => (
                    <tr key={a.asset.id} className="border-b border-[#F3F4F6]">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-[#111827]">{a.asset.name}</p>
                        <p className="text-xs text-[#6B7280]">
                          {[a.asset.category, a.asset.ownership === "hired" ? "Hired" : null].filter(Boolean).join(" · ")}
                          {a.asset.autoRegistered && <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-amber-800">Added by feed, check details</span>}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 text-[#374151]">{a.asset.siteName ?? "Unassigned"}</td>
                      <td className="py-2.5 pr-3 text-[#374151]">{a.asset.fuelType}</td>
                      <td className="py-2.5 pr-3 text-right">{n(a.hours, 1)}</td>
                      <td className={`py-2.5 pr-3 text-right ${a.idleShare != null && a.idleShare > 0.3 ? "text-amber-700" : ""}`}>{pct(a.idleShare)}</td>
                      <td className="py-2.5 pr-3 text-right">{n(a.litresPerHour, 1)}</td>
                      <td className="py-2.5 pr-3 text-right">{n(a.fuelLitres)}</td>
                      <td className="py-2.5 text-right">{a.co2eKg == null ? "–" : n(a.co2eKg / 1000, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {reconciliation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fuel reconciliation by site</CardTitle>
            <CardDescription>
              Diesel and HVO burnt by each site&apos;s machines against approved fuel records for the site. More burnt than recorded
              usually means a missing delivery note or fuel card; more recorded than burnt is normal when some plant has no telematics.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#374151]">
                  <th className="py-2 pr-3 font-normal">Site</th>
                  <th className="py-2 pr-3 text-right font-normal">Burnt (L)</th>
                  <th className="py-2 pr-3 text-right font-normal">Recorded (L)</th>
                  <th className="py-2 text-right font-normal">Difference</th>
                </tr>
              </thead>
              <tbody>
                {reconciliation.map((r) => (
                  <tr key={r.siteId} className="border-b border-[#F3F4F6]">
                    <td className="py-2.5 pr-3 text-[#111827]">{r.siteName}</td>
                    <td className="py-2.5 pr-3 text-right">{n(r.telematicsLitres)}</td>
                    <td className="py-2.5 pr-3 text-right">{n(r.recordedLitres)}</td>
                    <td className={`py-2.5 text-right ${r.gapLitres > 0 && (r.gapShare == null || r.gapShare > 0.05) ? "font-medium text-red-600" : "text-[#374151]"}`}>
                      {r.gapLitres > 0 ? "+" : ""}{n(r.gapLitres)} L{r.gapShare != null ? ` (${r.gapShare > 0 ? "+" : ""}${(r.gapShare * 100).toFixed(0)}%)` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add a machine</CardTitle>
              <CardDescription>The serial number is how telematics readings find the machine.</CardDescription>
            </CardHeader>
            <CardContent>
              <AddMachineForm orgId={orgId} sites={sites} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Telematics data</CardTitle>
              <CardDescription>Upload a provider export, or push readings automatically.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ReadingsUpload orgId={orgId} />
              <div className="text-xs text-[#374151]">
                <p className="font-medium text-[#111827]">Automatic feed</p>
                <p className="mt-1">
                  POST an ISO 15143-3 (AEMP 2.0) fleet snapshot to{" "}
                  <code className="rounded bg-[#F3F4F6] px-1">/api/orgs/{orgId}/integrations/plant/ingest</code> with an API key
                  (Settings → API keys) as <code className="rounded bg-[#F3F4F6] px-1">{`{"format":"iso15143","snapshot":{...}}`}</code>.
                  Cumulative hours and fuel are differenced between snapshots; resending a snapshot changes nothing.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-[10px] border border-[#E5E7EB] bg-white p-4">
      <p className="text-xs text-[#374151]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[#111827]">{value}</p>
      {note && <p className={`mt-1 text-xs ${tone === "good" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "text-[#6B7280]"}`}>{note}</p>}
    </div>
  );
}
