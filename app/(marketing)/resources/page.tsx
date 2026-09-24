import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Body, ClosingCta, Eyebrow, H1, H3, Lead, Section, SectionIntro } from "@/components/marketing/kit";

export const metadata: Metadata = {
  title: "Guides",
  description: "Practical guides for a first MetricOra reporting period: planning a pilot, keeping evidence, and choosing a Scope 2 method.",
  alternates: { canonical: "/resources" },
};

const GUIDES = [
  {
    id: "pilot",
    title: "Planning a first reporting period",
    body: [
      "Pick one reporting period you already have invoices for, usually the last full financial year. A published year becomes your comparison point.",
      "Set up the sites that consumed fuel or electricity, then invite the people who will review evidence. Field workers can be added later without affecting your plan's user count.",
      "Import meter, fuel card and supplier spend exports first. Add field capture once the office data is in, so reviewers are not learning two things at once.",
      "Run a calculation, read the warnings, then publish. Generate a report from the snapshot and check it against your own records.",
    ],
  },
  {
    id: "evidence",
    title: "What evidence to keep",
    body: [
      "Keep the document that shows the quantity: a fuel card statement, a meter reading, a weighbridge ticket, a delivery note. Invoices that only show cost support spend-based figures.",
      "Attach evidence to the submission or record rather than a shared drive, so the auditor can open it from the figure.",
      "When a value is estimated, write the assumption on the record. The CSV trail carries it into the report appendix.",
      "Check your retention setting under Settings, then Data retention. UK company records are normally kept for six years.",
    ],
  },
  {
    id: "scope2",
    title: "Location-based or market-based Scope 2",
    body: [
      "Location-based uses the grid average for where the electricity was used. MetricOra always reports it, and it is the headline figure.",
      "Market-based reflects what you bought. Add REGOs, PPAs, green tariffs or supplier-specific rates under Settings, then Electricity contracts, for the sites and dates they cover.",
      "Anything not covered by a contract falls back to the residual mix or the library factor, and the calculation says so.",
      "SECR asks for location-based. Reporting market-based beside it shows the effect of your purchasing.",
    ],
  },
];

const LINKS = [
  { href: "/methodology", title: "Methodology", text: "Factor libraries, licences and version history." },
  { href: "/blog", title: "Blog", text: "Longer articles on how the calculations work." },
  { href: "/developer", title: "Developers", text: "API keys, ingest endpoints and webhooks." },
];

export default function ResourcesPage() {
  return (
    <>
      <Section tone="dark" size="lg" video="/marketing/loops/calc.mp4" poster="/marketing/loops/calc.jpg" className="pt-36 sm:pt-40">
        <div className="flex max-w-3xl flex-col gap-6">
          <Eyebrow tone="dark">Guides</Eyebrow>
          <H1>Getting a first year right.</H1>
          <Lead tone="dark">Short, practical notes for the people setting MetricOra up.</Lead>
        </div>
      </Section>

      <Section tone="light">
        <div className="grid gap-12 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Guides" className="lg:sticky lg:top-24 lg:self-start">
            <ul className="grid gap-2">
              {GUIDES.map((g) => (
                <li key={g.id}>
                  <a href={`#${g.id}`} className="text-[15px] text-mk-text-2 hover:text-mk-accent">
                    {g.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col divide-y divide-mk-line">
            {GUIDES.map((g) => (
              <article key={g.id} id={g.id} className="scroll-mt-24 py-10 first:pt-0">
                <h2 className="text-[26px] font-semibold tracking-[-0.02em]">{g.title}</h2>
                <ol className="mt-5 grid gap-4">
                  {g.body.map((p, i) => (
                    <li key={i} className="flex gap-4">
                      <span className="font-mono text-[13px] leading-[1.8] text-mk-accent">{String(i + 1).padStart(2, "0")}</span>
                      <Body className="text-[16px]">{p}</Body>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="paper">
        <SectionIntro eyebrow="More" title="Elsewhere on the site." />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="group flex flex-col gap-2 rounded-[12px] border border-mk-line bg-mk-surface p-7 hover:border-mk-text/30">
              <H3>{l.title}</H3>
              <Body>{l.text}</Body>
              <span className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-medium text-mk-accent">
                Open <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <ClosingCta title="Want help with the first import?" lead="Book a pilot and we will set up your sites and first import with you." />
    </>
  );
}
