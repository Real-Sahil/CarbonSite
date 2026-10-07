import { GuideLinks } from "@/components/marketing/guide-links";
import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
import { METHODOLOGY_CHANGELOG } from "@/lib/calculation/methodology";
import { Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "@/components/reui/timeline";
import { Body, ClosingCta, Eyebrow, H1, H3, Lead, ProductLoop, Section, SectionIntro, CheckList, reveal } from "@/components/marketing/kit";

export const metadata: Metadata = withSocial({
  title: "DEFRA factors and carbon calculation method",
  description:
    "What you can check in a MetricOra figure: the calculation promises, how to verify a number, factor sources and licences, and how the rules are versioned.",
  alternates: { canonical: "/methodology" },
});

const LIBRARIES = [
  { name: "DEFRA / DESNZ 2026.1", scope: "UK conversion factors, including heat and steam", licence: "Open Government Licence v3.0" },
  { name: "DEFRA / DESNZ 2025.2", scope: "UK conversion factors for 2025 periods", licence: "Open Government Licence v3.0" },
  { name: "US EPA GHG Emission Factors Hub 2025", scope: "US fuels and electricity", licence: "US Government work" },
  { name: "EPA USEEIO 1.3", scope: "Spend factors for 1,016 NAICS-6 industries, 2022 USD", licence: "US Government work" },
  { name: "ADEME Base Carbone 2025", scope: "French and European factors, heat networks, EUR spend by NAF", licence: "Licence Ouverte 2.0" },
  { name: "Defra UK spend multipliers 2023", scope: "Spend factors for 111 UK SIC groups, 2015 to 2023", licence: "Open Government Licence v3.0" },
];

const PROMISES = [
  { title: "Rules that stay put", text: "A calculation run is pinned to one factor library and one methodology version, so the rules behind a figure never change underneath it." },
  { title: "Every figure traces back", text: "Open any total and follow it to the record, the factor, the formula and the evidence behind it." },
  { title: "Published figures do not change", text: "A correction creates a new version of the report. The earlier one stays as it was, and the change is logged." },
  { title: "Uncertainty is shown", text: "Totals carry a range, not only a single number, and anything that needed judgement is listed for the reviewer before publishing." },
];

const STEPS = [
  { title: "Normalise the unit", text: "Each quantity is converted to the unit its factor uses, and the original is kept." },
  { title: "Select the factor", text: "Your own factors are used first. Otherwise the best match from the run's library is chosen, and the reason is stored with the result." },
  { title: "Compute CO₂e", text: "Gases use IPCC AR6 100-year warming potentials. The formula is saved with the result." },
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
            MetricOra follows the GHG Protocol Corporate Standard. This page shows what you can check in every figure, where the factors come from and how the
            rules are versioned.
          </Lead>
        </div>
      </Section>

      <Section tone="light">
        <SectionIntro eyebrow="Our promises" title="What holds for every figure." />
        <ol className="mt-12 grid gap-px overflow-hidden rounded-[12px] border border-mk-line bg-mk-line sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((p, i) => (
            <li key={p.title} {...reveal(i, "inner")} className="flex flex-col gap-2 bg-mk-surface p-7">
              <span className="font-mono text-[13px] text-mk-accent">{String(i + 1).padStart(2, "0")}</span>
              <H3>{p.title}</H3>
              <Body>{p.text}</Body>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="dark" video="/marketing/loops/record.mp4" poster="/marketing/loops/record.jpg">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <SectionIntro eyebrow="Verify it yourself" tone="dark" title="Built for the person who checks it." />
            <CheckList
              tone="dark"
              items={[
                "Trace a figure from the published total down to the record, factor and formula",
                "Every emissions report ships with a CSV of each record, factor and formula used",
                "An assurance pack for auditors: the calculations, the factors, the evidence index and the audit log, with a checksum list",
                "An auditor role with read-only access to the figures and the evidence behind them",
              ]}
            />
          </div>
          <ProductLoop src="/marketing/loops/record.mp4" poster="/marketing/loops/record.jpg" label="Activity record with its calculations" tone="dark" />
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
            <li key={s.title} {...reveal(i, "inner")} className="flex flex-col gap-2 bg-mk-surface p-7">
              <span className="font-mono text-[13px] text-mk-accent">{String(i + 1).padStart(2, "0")}</span>
              <H3>{s.title}</H3>
              <Body>{s.text}</Body>
            </li>
          ))}
        </ol>
        <div className="mt-12 max-w-3xl">
          <H3>The judgement calls, written down.</H3>
          <div className="mt-4">
            <CheckList
              items={[
                "Headline totals use location-based Scope 2. Market-based is shown beside it and never added.",
                "Market-based electricity follows the GHG Protocol order, and a certificate is never claimed twice.",
                "Spend is converted at the exchange rate for the record's date and adjusted for inflation to the factor's price year.",
                "HVO and biomass carry their biogenic CO₂ beside the inventory, not in it.",
                "Every total carries an uncertainty range.",
              ]}
            />
          </div>
        </div>
      </Section>

      <Section tone="light">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <SectionIntro
            eyebrow="Versions"
            title="Methodology history."
            lead="The version changes only when a rule would change a figure from the same records and library. Published snapshots keep the version they were calculated under. The full account of each change is in the app and the assurance pack."
          />
          <Timeline value={0} className="pt-1">
            {METHODOLOGY_CHANGELOG.map((m, i) => (
              <TimelineItem key={m.name} step={i + 1} className="ms-7 not-last:pb-10">
                <TimelineHeader>
                  <TimelineSeparator className="-left-[1.75rem] bg-mk-line" />
                  <TimelineIndicator className="-left-[1.75rem] border-mk-accent bg-mk-surface" />
                  <TimelineDate dateTime={String(m.effective).slice(0, 10)} className="text-[13px] text-mk-text-3">
                    Effective {new Date(m.effective).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · GWP {m.gwp}
                  </TimelineDate>
                  <TimelineTitle className="font-mono text-[15px] font-medium text-mk-text">{m.name}</TimelineTitle>
                </TimelineHeader>
                <TimelineContent className="mt-3">
                  <p className="text-[15px] leading-relaxed text-mk-text-2">{m.summary}</p>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        </div>
      </Section>

      <GuideLinks links={[
        { href: "/blog/uk-ghg-conversion-factors-2026-what-changed", title: "UK conversion factors 2026", text: "What changed and which set to use for which period." },
        { href: "/blog/location-and-market-based-scope-2", title: "Location-based and market-based Scope 2", text: "The two methods, with one office as the example." },
        { href: "/blog/spend-based-scope-3-sourced-factors", title: "Spend-based Scope 3", text: "Pricing supplier spend with factors you can source." },
      ]} />

      <ClosingCta title="Check the numbers yourself." lead="Every report ships with a CSV that lists each record, factor and formula used." />
    </>
  );
}
