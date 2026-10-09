export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { selectedProjectScope } from "@/lib/project/scope";
import { prisma } from "@/lib/db";
import { loadFuel } from "@/lib/fuel/load";
import { monthRange } from "@/lib/fuel/schemas";
import { PLANT_EDITORS } from "@/lib/plant/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddEntryForm, AddStoreForm, DeleteEntryButton, RetireStoreButton } from "./fuel-actions";

interface Props {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ month?: string; siteId?: string }>;
}

const n = (v: number | null | undefined, dp = 0) =>
  v == null ? "–" : v.toLocaleString("en-GB", { maximumFractionDigits: dp, minimumFractionDigits: dp });
const day = (d: Date) => d.toISOString().slice(0, 10);
const KIND = { delivery: "Delivery", issue: "Issue", dip: "Dip" } as const;

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

export default async function FuelPage({ params, searchParams }: Props) {
  const { orgId } = await params;
  const sp = await searchParams;

  let role;
  try {
    role = (await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember)).membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    if (err instanceof AuthError) notFound();
    throw err;
  }
  const canEdit = PLANT_EDITORS.includes(role);
  const { month, from, to } = monthRange(sp.month);
  const scope = await selectedProjectScope(orgId);
  const sites = await prisma.site.findMany({ where: { organizationId: orgId, ...(scope ? { id: { in: scope.siteIds } } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const siteId = sites.some((s) => s.id === sp.siteId) ? sp.siteId! : null;
  const { stores, machines, sites: siteRows, entries, assets } = await loadFuel(orgId, from, to, siteId, scope?.siteIds ?? null);
  const storeName = new Map(stores.map((s) => [s.store.id, s.store.name]));
  const qs = (m: string) => `?month=${m}${siteId ? `&siteId=${siteId}` : ""}`;
  const totalIn = stores.reduce((t, s) => t + s.litresIn, 0);
  const totalOut = stores.reduce((t, s) => t + s.litresOut, 0);
  const flagged = stores.filter((s) => s.flagged);
  const active = stores.filter((s) => s.store.active);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-[42px]">
      {scope && (
        <p className="rounded-lg bg-[#F9FAFB] px-4 py-2 text-sm text-[#374151]">
          Showing <span className="font-medium">{scope.project.name}</span> only{scope.siteIds.length === 0 ? ", which has no sites yet. Add a site to the project to see its fuel, machines and loads here" : ""}. Choose All projects in the sidebar to see everything.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Fuel</h1>
          <p className="mt-2 max-w-[65ch] text-sm text-[#374151]">
            Bowsers and tanks on your sites, what each received by fuel type, what was issued to which machine, and whether the
            levels you measure agree. Your inventory still counts the fuel on your receipts and bills; this page shows where it went
            and where the records disagree.
          </p>
        </div>
        <nav className="flex items-center gap-1 rounded-md border border-[#E5E7EB] p-1 text-sm" aria-label="Month">
          <Link className="rounded px-3 py-1 text-[#374151] hover:bg-[#F3F4F6]" href={qs(shiftMonth(month, -1))}>Earlier</Link>
          <span aria-current="page" className="rounded bg-[#111827] px-3 py-1 text-white">{month}</span>
          <Link className="rounded px-3 py-1 text-[#374151] hover:bg-[#F3F4F6]" href={qs(shiftMonth(month, 1))}>Later</Link>
        </nav>
      </div>

      {sites.length > 1 && (
        <nav className="flex flex-wrap gap-2 text-sm" aria-label="Site">
          <Link href={`?month=${month}`} aria-current={!siteId ? "page" : undefined} className={`rounded-full border px-3 py-1 ${!siteId ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] text-[#374151]"}`}>All sites</Link>
          {sites.map((s) => (
            <Link key={s.id} href={`?month=${month}&siteId=${s.id}`} aria-current={siteId === s.id ? "page" : undefined} className={`rounded-full border px-3 py-1 ${siteId === s.id ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] text-[#374151]"}`}>{s.name}</Link>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Stores" value={`${active.length}`} note={`${n(active.reduce((t, s) => t + s.store.capacityLitres, 0))} L capacity`} />
        <Kpi label="Delivered this month" value={`${n(totalIn)} L`} note={Object.entries(stores.reduce<Record<string, number>>((a, s) => { for (const [k, v] of Object.entries(s.inByType)) a[k] = (a[k] ?? 0) + v; return a; }, {})).map(([k, v]) => `${n(v)} L ${k}`).join(" · ") || "Nothing recorded"} />
        <Kpi label="Issued to machines" value={`${n(totalOut)} L`} note={`${machines.length} machines or vehicles`} />
        <Kpi label="Levels that disagree" value={`${flagged.length}`} note={flagged.length ? flagged.map((s) => s.store.name).join(", ") : "None flagged"} tone={flagged.length ? "warn" : "good"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stores</CardTitle>
          <CardDescription>
            Expected level is the previous dip plus deliveries less issues. A gap above 2% of the litres issued (and at least 20 L) is
            flagged: possible leak, theft or a missing entry.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {stores.length === 0 ? (
            <p className="text-sm text-[#374151]">No fuel stores yet. Add a bowser or tank below.</p>
          ) : (
            <table className="w-full min-w-[820px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#374151]">
                  <th className="py-2 pr-3 font-normal">Store</th>
                  <th className="py-2 pr-3 font-normal">Site</th>
                  <th className="py-2 pr-3 text-right font-normal">In (L)</th>
                  <th className="py-2 pr-3 text-right font-normal">Out (L)</th>
                  <th className="py-2 pr-3 text-right font-normal">Last dip (L)</th>
                  <th className="py-2 pr-3 text-right font-normal">Expected (L)</th>
                  <th className="py-2 pr-3 text-right font-normal">Gap (L)</th>
                  {canEdit && <th className="py-2 text-right font-normal"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.store.id} className={`border-b border-[#F3F4F6] ${s.store.active ? "" : "opacity-60"}`}>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-[#111827]">{s.store.name}</p>
                      <p className="text-xs text-[#6B7280]">{[s.store.kind.replace("_", " "), s.store.fuelType, `${n(s.store.capacityLitres)} L`, s.store.ownership === "hired" ? "Hired" : null, s.store.active ? null : "Retired"].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-[#374151]">{s.store.siteName ?? "No site"}</td>
                    <td className="py-2.5 pr-3 text-right">{n(s.litresIn)}</td>
                    <td className="py-2.5 pr-3 text-right">{n(s.litresOut)}</td>
                    <td className="py-2.5 pr-3 text-right">
                      {s.lastDip ? <>{n(s.lastDip.litres)}<span className="block text-xs text-[#6B7280]">{day(s.lastDip.on)}</span></> : "No dip"}
                      {s.overCapacity && <span className="block text-xs text-red-600">Over capacity</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-right">{n(s.expected)}</td>
                    <td className={`py-2.5 pr-3 text-right ${s.flagged ? "font-medium text-red-600" : "text-[#374151]"}`}>
                      {s.variance == null ? "Needs two dips" : `${s.variance > 0 ? "+" : ""}${n(s.variance)}`}
                    </td>
                    {canEdit && <td className="py-2.5 text-right"><RetireStoreButton orgId={orgId} storeId={s.store.id} active={s.store.active} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Machines</CardTitle>
          <CardDescription>Litres issued from your stores beside what each machine&apos;s telematics reported. Hired plant with no feed shows issues only.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {machines.length === 0 ? (
            <p className="text-sm text-[#374151]">Nothing issued this month, and no telematics readings.</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#374151]">
                  <th className="py-2 pr-3 font-normal">Machine</th>
                  <th className="py-2 pr-3 text-right font-normal">Issued (L)</th>
                  <th className="py-2 pr-3 text-right font-normal">Telematics (L)</th>
                  <th className="py-2 pr-3 text-right font-normal">Hours</th>
                  <th className="py-2 pr-3 text-right font-normal">L/hour</th>
                  <th className="py-2 text-right font-normal">Idle</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.id ?? m.label} className="border-b border-[#F3F4F6]">
                    <td className="py-2.5 pr-3 font-medium text-[#111827]">{m.label}{!m.id && <span className="ml-2 text-xs font-normal text-[#6B7280]">not in register</span>}</td>
                    <td className="py-2.5 pr-3 text-right">{n(m.issued)}</td>
                    <td className="py-2.5 pr-3 text-right">{n(m.telematicsLitres)}</td>
                    <td className="py-2.5 pr-3 text-right">{n(m.hours, 1)}</td>
                    <td className="py-2.5 pr-3 text-right">{m.hours && m.hours > 0 ? n((m.telematicsLitres ?? m.issued) / m.hours, 1) : "–"}</td>
                    <td className="py-2.5 text-right">{m.idleShare == null ? "–" : `${(m.idleShare * 100).toFixed(0)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {siteRows.some((r) => r.siteId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivered against recorded fuel, by site</CardTitle>
            <CardDescription>
              Litres delivered into each site&apos;s stores this month against approved diesel and HVO records for the site. A large
              difference usually means a delivery note or fuel card that has not been entered yet, or stock carried between months.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#374151]">
                  <th className="py-2 pr-3 font-normal">Site</th>
                  <th className="py-2 pr-3 text-right font-normal">Delivered (L)</th>
                  <th className="py-2 pr-3 text-right font-normal">Recorded (L)</th>
                  <th className="py-2 text-right font-normal">Difference</th>
                </tr>
              </thead>
              <tbody>
                {siteRows.filter((r) => r.siteId).map((r) => (
                  <tr key={r.siteId} className="border-b border-[#F3F4F6]">
                    <td className="py-2.5 pr-3 text-[#111827]">{r.siteName}</td>
                    <td className="py-2.5 pr-3 text-right">{n(r.delivered)}</td>
                    <td className="py-2.5 pr-3 text-right">{n(r.recorded)}</td>
                    <td className="py-2.5 text-right text-[#374151]">{r.gap == null ? "–" : `${r.gap > 0 ? "+" : ""}${n(r.gap)} L`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Entries this month</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {entries.length === 0 ? (
            <p className="text-sm text-[#374151]">No deliveries, issues or dips in {month}.</p>
          ) : (
            <table className="w-full min-w-[560px] text-sm tabular-nums">
              <tbody>
                {entries.map((e) => (
                  <tr key={`${e.kind}${e.id}`} className="border-b border-[#F3F4F6]">
                    <td className="py-2 pr-3 text-[#374151]">{day(e.on)}</td>
                    <td className="py-2 pr-3 font-medium text-[#111827]">{KIND[e.kind]}</td>
                    <td className="py-2 pr-3 text-[#374151]">{storeName.get(e.storeId) ?? ""}</td>
                    <td className="py-2 pr-3 text-right">{n(e.litres, 1)} L</td>
                    <td className="py-2 pr-3 text-[#374151]">{e.detail}</td>
                    {canEdit && <td className="py-2 text-right"><DeleteEntryButton orgId={orgId} kind={e.kind} id={e.id} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Record fuel</CardTitle><CardDescription>A delivery, an issue to a machine, or a dip.</CardDescription></CardHeader>
            <CardContent>
              {active.length === 0 ? <p className="text-sm text-[#374151]">Add a store first.</p> : <AddEntryForm orgId={orgId} stores={active.map((s) => ({ id: s.store.id, name: s.store.name }))} machines={assets} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Add a bowser or tank</CardTitle></CardHeader>
            <CardContent><AddStoreForm orgId={orgId} sites={sites} /></CardContent>
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
