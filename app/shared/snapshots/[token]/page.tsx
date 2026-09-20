import { notFound } from "next/navigation";
import { format } from "date-fns";

type Props = { params: Promise<{ token: string }> };

async function fetchSnapshot(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/public/snapshots/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.snapshot as SharedSnapshot;
}

type SharedSnapshot = {
  id: string;
  publishedAt: string;
  version: number;
  organization: { name: string; industry?: string; hqCountry?: string };
  reportingPeriod: { label: string; startDate: string; endDate: string };
  aggregates: {
    scope1Co2e?: number;
    scope2Co2e?: number;
    scope3Co2e?: number;
    totalCo2e?: number;
    biogenicCo2e?: number;
    recordCount?: number;
  }[];
};

export default async function SharedSnapshotPage({ params }: Props) {
  const { token } = await params;
  const snapshot = await fetchSnapshot(token);
  if (!snapshot) notFound();

  const agg = snapshot.aggregates[0] ?? {};
  const total = agg.totalCo2e ?? 0;
  const scopes = [
    { label: "Scope 1", value: agg.scope1Co2e, description: "Direct emissions" },
    { label: "Scope 2", value: agg.scope2Co2e, description: "Purchased electricity" },
    { label: "Scope 3", value: agg.scope3Co2e, description: "Value chain" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-10">
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-400 mb-2">
            GHG Emissions Disclosure
          </p>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">
            {snapshot.organization.name}
          </h1>
          <p className="text-zinc-500 text-sm">
            {snapshot.reportingPeriod.label} &bull; Published{" "}
            {format(new Date(snapshot.publishedAt), "d MMM yyyy")} &bull; v{snapshot.version}
          </p>
        </header>

        <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 mb-6">
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-400 mb-1">
            Total emissions
          </p>
          <p className="text-5xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
            {(total / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}
          </p>
          <p className="text-sm text-zinc-500 mt-1">tCO2e</p>
        </section>

        <section className="grid grid-cols-3 gap-4 mb-6">
          {scopes.map((s) => (
            <div
              key={s.label}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5"
            >
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-400 mb-1">
                {s.label}
              </p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">
                {s.value != null
                  ? (s.value / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })
                  : "-"}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">tCO2e</p>
              <p className="text-xs text-zinc-500 mt-1">{s.description}</p>
            </div>
          ))}
        </section>

        {agg.biogenicCo2e != null && agg.biogenicCo2e > 0 && (
          <section className="bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Biogenic CO2 (memo):
            </span>{" "}
            {(agg.biogenicCo2e / 1000).toLocaleString("en-GB", { maximumFractionDigits: 2 })} tCO2
            &mdash; reported separately per GHG Protocol; not included in totals above.
          </section>
        )}

        <footer className="text-xs text-zinc-400 text-center mt-8">
          Prepared with MetricOra &bull; GHG Protocol methodology &bull; AR6 GWP
        </footer>
      </div>
    </div>
  );
}
