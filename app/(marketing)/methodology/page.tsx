import type { Metadata } from "next";
import { METHODOLOGY_CHANGELOG } from "@/lib/calculation/methodology";
import { Body, ClosingCta, Eyebrow, H1, H3, Lead, ProductLoop, Section, SectionIntro, CheckList } from "@/components/marketing/kit";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How MetricOra calculates emissions: factor libraries and licences, factor selection, Scope 2 dual reporting, spend conversion, uncertainty and methodology versions.",
  alternates: { canonical: "/methodology" },
};

const LIBRARIES = [
  { name: "DEFRA / DESNZ 2026.1", scope: "UK conversion factors, including heat and steam", licence: "Open Government Licence v3.0" },
  { name: "DEFRA / DESNZ 2025.2", scope: "UK conversion factors for 2025 periods", licence: "Open Government Licence v3.0" },
  { name: "US EPA GHG Emission Factors Hub 2025", scope: "US fuels and electricity", licence: "US Government work" },
  { name: "EPA USEEIO 1.3", scope: "Spend factors for 1,016 NAICS-6 industries, 2022 USD", licence: "US Government work" },
  { name: "ADEME Base Carbone 2025", scope: "French and European factors, heat networks, EUR spend by NAF", licence: "Licence Ouverte 2.0" },
  { name: "Defra UK spend multipliers 2023", scope: "Spend factors for 111 UK SIC groups, 2015 to 2023", licence: "Open Government Licence v3.0" },
];

const STEPS = [
  { title: "Normalise the unit", text: "Each record's quantity is converted to the unit its factor uses, and the original is kept. Net calorific value quantities only match net-CV factors." },
  { title: "Select the factor", text: "Your organisation's own factors are tried first. Otherwise the run's library is matched on category, country, date, fuel and Scope 2 method, and the reason is stored." },
  { title: "Compute CO₂e", text: "Gas-by-gas factors use IPCC AR6 100-year GWPs (CH₄ 27.9, N₂O 273). The formula string is saved with the result." },
  { title: "Store the result", text: "Calculations are never edited. A new run creates new rows, and the snapshot you publish points at one run." },
];

export default function MethodologyPage() {
  return (
    <>
      <Section tone="dark" size="lg" video="/marketing/loops/calc.mp4" poster="/marketing/loops/calc.jpg" className="pt-36 sm:pt-40">
        <div className="flex max-w-3xl flex-col gap-6">
          <Eyebrow tone="dark">Methodology</Eyebrow>
          <H1>How a figure is calculated.</H1>
          <Lead tone="dark">
            MetricOra follows the GHG Protocol Corporate Standard. This page lists the factor sources, the rules that turn a record into CO₂e and the version
            history of those rules.
          </Lead>
        </div>
      </Section>

      <Section tone="light">
        <SectionIntro eyebrow="Factor libraries" title="Sources and licences." lead="A calculation run is pinned to one library. For each period, the newest DEFRA set whose year is not after the period's end is suggested." />
        <div className="mt-10 overflow-x-auto rounded-[12px] border border-mk-line">
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-mk-line bg-mk-paper font-mono text-[12px] uppercase tracking-[0.1em] text-mk-text-3">
                <th className="px-5 py-3 font-medium">Library</th>
                <th className="px-5 py-3 font-medium">Covers</th>
                <th className="px-5 py-3 font-medium">Licence</th>
              </tr>
            </thead>
            <tbody>
              {LIBRARIES.map((l) => (
                <tr key={l.name} className="border-b border-mk-line last:border-0">
                  <td className="px-5 py-4 font-medium">{l.name}</td>
                  <td className="px-5 py-4 text-mk-text-2">{l.scope}</td>
                  <td className="px-5 py-4 text-mk-text-2">{l.licence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[14px] text-mk-text-3">Every report and CSV export carries the attribution each licence requires.</p>
      </Section>

      <Section tone="paper">
        <SectionIntro eyebrow="Calculation" title="Four steps for every record." />
        <ol className="mt-12 grid gap-px overflow-hidden rounded-[12px] border border-mk-line bg-mk-line sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 bg-mk-surface p-7">
              <span className="font-mono text-[13px] text-mk-accent">{String(i + 1).padStart(2, "0")}</span>
              <H3>{s.title}</H3>
              <Body>{s.text}</Body>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="dark" video="/marketing/loops/record.mp4" poster="/marketing/loops/record.jpg">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <SectionIntro eyebrow="Rules" tone="dark" title="The judgement calls, written down." />
            <CheckList
              tone="dark"
              items={[
                "Headline totals use location-based Scope 2. Market-based is shown beside it and never added.",
                "Market-based electricity draws on certificates and PPAs, then green tariffs, supplier rates and the residual mix. A certificate is never claimed twice.",
                "Spend is converted at the ECB rate for the record's date and deflated to the factor's price year with UK CPI, US CPI-U or euro area HICP.",
                "HVO and biomass carry their biogenic CO₂ beside the inventory, not in it.",
                "Each run reports a Monte Carlo 95% range from each record's data quality.",
              ]}
            />
          </div>
          <ProductLoop src="/marketing/loops/record.mp4" poster="/marketing/loops/record.jpg" label="Activity record with its calculations" tone="dark" />
        </div>
      </Section>

      <Section tone="light">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <SectionIntro
            eyebrow="Versions"
            title="Methodology history."
            lead="The version changes only when a rule would change a figure from the same records and library. Published snapshots keep the version they were calculated under."
          />
          <div className="flex flex-col divide-y divide-mk-line border-y border-mk-line">
            {METHODOLOGY_CHANGELOG.map((m) => (
              <div key={m.name} className="py-6">
                <p className="font-mono text-[14px] font-medium">{m.name}</p>
                <p className="mt-1 text-[13px] text-mk-text-3">
                  Effective {new Date(m.effective).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · GWP {m.gwp}
                </p>
                <ul className="mt-3 grid gap-2 text-[15px] leading-relaxed text-mk-text-2">
                  {m.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <ClosingCta title="Check the numbers yourself." lead="Every report ships with a CSV that lists each record, factor and formula used." />
    </>
  );
}
