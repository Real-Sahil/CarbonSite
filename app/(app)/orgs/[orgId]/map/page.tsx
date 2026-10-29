export const dynamic = "force-dynamic";

import { mapStyleUrl } from "@/lib/map/style";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { orgFormat } from "@/lib/i18n/org-format";
import { loadSnapshotRefs, loadSnapshotSites } from "@/lib/map/load";
import { LazySiteMap as SiteMap } from "@/components/map/site-map-lazy";

export default async function MapPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }
  const [org, snapshots] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { hqCountry: true, reportingCurrency: true } }),
    loadSnapshotRefs(orgId),
  ]);
  const locale = orgFormat(org ?? {}).locale;
  const latest = snapshots[snapshots.length - 1];
  const sites = latest ? await loadSnapshotSites(orgId, latest.id) : null;
  // Tiles come from OpenFreeMap unless the owner sets another style URL (lib/map/style.ts).
  const styleUrl = mapStyleUrl();

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
      <h1 className="text-2xl text-[#131d29]">Site map</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-[#41505F]">
        Where the emissions are, by site, from your published snapshots. Move the slider to see how the picture changed from one published period to the next. Figures are the published ones, never live.
      </p>
      <div className="mt-6">
        {latest && sites ? (
          <SiteMap orgId={orgId} snapshots={snapshots} initialSnapshotId={latest.id} initialSites={sites} styleUrl={styleUrl} locale={locale} />
        ) : (
          <p className="rounded-[10px] border border-[#E3E8EE] bg-white p-4 text-sm text-[#41505F]">
            Nothing is published yet. <Link href={`/orgs/${orgId}/calculations`} className="underline underline-offset-2">Run and publish a calculation</Link> to see your sites here.
          </p>
        )}
      </div>
    </div>
  );
}
