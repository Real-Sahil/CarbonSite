import { loadLiveSites } from "@/lib/map/load";
import { SiteHero } from "@/components/dashboard/site-hero";

// Loads the live site figures on their own so the rest of the dashboard is not held up by them.
export async function SiteHeroSection({
  orgId,
  periodId,
  periodLabel,
  filters,
  projects,
  locale,
}: {
  orgId: string;
  periodId: string | null;
  periodLabel: string;
  filters: Record<string, string>;
  projects: { id: string; label: string }[];
  locale: string;
}) {
  let sites: Awaited<ReturnType<typeof loadLiveSites>> = [];
  let failed = false;
  if (periodId) {
    try {
      sites = await loadLiveSites(orgId, periodId);
    } catch {
      failed = true;
    }
  }
  return <SiteHero orgId={orgId} sites={sites} failed={failed} projects={projects} filters={filters} periodLabel={periodLabel} locale={locale} />;
}
