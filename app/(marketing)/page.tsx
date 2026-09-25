import type { Metadata } from "next";
import { PLAY_URL } from "@/components/marketing/brand-marks";
import { PLAN_PRICES } from "@/lib/billing/limits";
import { withSocial } from "@/lib/seo/page-meta";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Body,
  ButtonLink,
  CheckList,
  ClosingCta,
  Eyebrow,
  H1,
  H3,
  Lead,
  ProductLoop,
  ProductShot,
  Section,
  SectionIntro,
  TextLink,
} from "@/components/marketing/kit";

export const metadata: Metadata = withSocial({
  title: { absolute: "MetricOra | Carbon evidence and reporting for UK contractors" },
  description:
    "Carbon figures that hold up when a tender evaluator, verifier or main contractor checks them. Guided PPN 006 Carbon Reduction Plan, SECR and GHG Protocol reports from one set of reviewed records.",
  alternates: { canonical: "/" },
});

const STEPS = [
  {
    step: "Collect",
    text: "Site teams photograph tickets and receipts in the field app, offline if they need to. Office teams import meter, fuel card and spend files.",
    img: "/marketing/screens/submissions.jpg",
    alt: "Field submissions queue with waste tickets, fuel receipts and a delivery note",
  },
  {
    step: "Review",
    text: "Each submission shows what the phone read beside what was sent. Reviewers claim, query or approve, and every decision is logged.",
    img: "/marketing/screens/submission-review.jpg",
    alt: "Waste ticket under review with a query about the net weight",
  },
  {
    step: "Calculate",
    text: "A run is pinned to one factor library and one methodology version. Warnings and an uncertainty range appear before anything is published.",
    img: "/marketing/screens/calc-run.jpg",
    alt: "Calculation run with warnings and a Monte Carlo uncertainty range",
  },
  {
    step: "Publish",
    text: "Publishing freezes a versioned snapshot. Reports and the dashboard read from it, with a CSV calculation trail for your auditor.",
    img: "/marketing/screens/report-picker.jpg",
    alt: "Reports page with published snapshots, the recommended report types and generated PPN 006 and bid carbon pack reports",
  },
];

const AREAS = [
  { href: "/product#evidence", title: "Evidence capture", text: "Field app, imports and a review queue, with OCR results checked against what was submitted." },
  { href: "/product#carbon", title: "Carbon accounting", text: "Scope 1, 2 and 3 against DEFRA, EPA, ADEME and spend factors, with location- and market-based Scope 2." },
  { href: "/product#reporting", title: "Reporting and assurance", text: "Versioned snapshots, reports with a verification code, a hash-chained audit trail and a readiness score." },
  { href: "/product#compliance", title: "Compliance", text: "One dataset mapped to SECR, ESRS E1, GHG Protocol, GRI 305, IFRS S2 and CDP, with a regulatory calendar." },
  { href: "/product#planning", title: "Targets and planning", text: "Base year and recalculation policy, pathway, transition plan checklist and an internal carbon price." },
  { href: "/product#operations", title: "Supply chain and site operations", text: "Supplier data requests, social value, embodied carbon, plant, waste, water and environmental registers." },
];

const AUDIENCES = [
  { href: "/solutions/construction", title: "Main contractors", text: "Sites, plant, materials and subcontractor evidence in one inventory." },
  { href: "/solutions/waste-haulage", title: "Waste and haulage", text: "Tickets, EWC codes, weights and routes captured where the lorry is." },
  { href: "/solutions/public-sector", title: "Public-sector suppliers", text: "Carbon Reduction Plans and social value for public tenders." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "MetricOra Ltd",
      url: "https://www.metricora.co.uk",
      logo: "https://www.metricora.co.uk/icon-512.png",
      email: "hello@metricora.co.uk",
      sameAs: [PLAY_URL],
    },
    {
      "@type": "WebSite",
      name: "MetricOra",
      url: "https://www.metricora.co.uk",
      inLanguage: "en-GB",
    },
    {
      "@type": "WebApplication",
      name: "MetricOra",
      url: "https://www.metricora.co.uk",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: [
        { "@type": "Offer", name: "Starter", price: String(PLAN_PRICES.starter.monthly), priceCurrency: "GBP" },
        { "@type": "Offer", name: "Growth", price: String(PLAN_PRICES.growth.monthly), priceCurrency: "GBP" },
      ],
    },
    {
      "@type": "MobileApplication",
      name: "MetricOra field app",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Android",
      installUrl: PLAY_URL,
      offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    },
  ],
};

const CHECKERS = [
  {
    who: "Tender evaluators",
    asks: "Is the Carbon Reduction Plan complete, signed and consistent with your other answers?",
    answer:
      "The guided PPN 006 plan checks what an evaluator looks for before it can be generated: all five required Scope 3 categories reported or explained, a baseline and why it was chosen, net zero by 2050, and a director's sign-off.",
  },
  {
    who: "Auditors and verifiers",
    asks: "Can you show me how this total was calculated?",
    answer:
      "Every emissions report ships with a CSV calculation trail: each record's amount, factor, library and formula. Published figures cannot be edited; a correction creates a new version, and the change is logged.",
  },
  {
    who: "Main contractors and clients",
    asks: "What did this contract emit, and what social value did it deliver?",
    answer:
      "Activity is recorded against the contract it belongs to, so the bid carbon pack can show a contract's carbon, waste and National TOMs delivery side by side, from the same records.",
  },
];

const FIRST_DOCUMENTS = [
  {
    title: "Carbon Reduction Plan (PPN 006)",
    text: "For central government contracts of £5 million a year or more. A guided plan in the Cabinet Office format, section by section, with a check of every required item before you generate it.",
  },
  {
    title: "SECR report",
    text: "For the Directors' Report of large companies. UK energy in kWh taken from your records, Scope 1 and 2, an intensity ratio and your efficiency measures.",
  },
  {
    title: "GHG Protocol report",
    text: "Scope 1, 2 and 3 for customers, lenders and your board, with location- and market-based Scope 2 side by side.",
  },
];

const STANDARDS = ["GHG Protocol Corporate Standard", "DEFRA 2025 and 2026 factors", "US EPA and USEEIO 1.3", "ADEME Base Carbone", "IPCC AR6 GWPs"];

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Section tone="dark" size="lg" video="/marketing/loops/prove.mp4" poster="/marketing/loops/prove.jpg" className="pt-36 sm:pt-40">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.15fr]">
          <div className="flex flex-col gap-6">
            <Eyebrow tone="dark">Carbon evidence and reporting</Eyebrow>
            <H1>Carbon figures that hold up when someone checks them.</H1>
            <Lead tone="dark">
              Your Carbon Reduction Plan, SECR disclosure and tender answers come from one set of reviewed records. When an evaluator, verifier or main
              contractor asks where a number came from, you can show the ticket, the factor and the formula.
            </Lead>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/sign-up">Start a 30-day trial</ButtonLink>
              <ButtonLink href="/contact" variant="secondary" tone="dark">
                Book a pilot
              </ButtonLink>
            </div>
          </div>
          <ProductShot
            src="/marketing/screens/dashboard.jpg"
            alt="MetricOra dashboard showing a 4,710 tCO2e footprint, a 12.2% fall on the previous year, live Scope 1, 2 and 3 totals and a banner about unpublished changes"
            width={2400}
            height={1500}
            tone="dark"
            priority
          />
        </div>
      </Section>

      <div className="border-y border-mk-line bg-mk-paper">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:gap-10">
          <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-mk-text-2">Built on</p>
          <ul className="flex flex-col gap-2.5 text-[14px] text-mk-text-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {STANDARDS.map((s) => (
              <li key={s} className="flex items-center gap-2 whitespace-nowrap">
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-mk-accent" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Section tone="light">
        <SectionIntro
          eyebrow="Who checks your numbers"
          title="Written for the person who checks it."
          lead="Carbon figures are read by people whose job is to find the weak one. Each of them gets what they look for."
        />
        <div className="mt-12 grid gap-px overflow-hidden rounded-[12px] border border-mk-line bg-mk-line md:grid-cols-3">
          {CHECKERS.map((c) => (
            <div key={c.who} className="flex flex-col gap-3 bg-mk-surface p-7">
              <H3>{c.who}</H3>
              <p className="text-[15px] font-medium text-mk-text">{c.asks}</p>
              <Body>{c.answer}</Body>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="paper">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div className="flex flex-col gap-8">
            <SectionIntro
              eyebrow="Start here"
              title="The three documents most contractors need."
              lead="New accounts see these first. ESRS, CDP, CBAM, NHS Evergreen, BREEAM and National TOMs reports are there when a client asks for them."
            />
            <ProductLoop src="/marketing/loops/plan.mp4" poster="/marketing/loops/plan.jpg" label="Guided Carbon Reduction Plan, section by section from boundary to sign-off" />
            <div>
              <ButtonLink href="/sign-up?start=crp">Start your Carbon Reduction Plan</ButtonLink>
            </div>
          </div>
          <ol className="grid gap-4">
            {FIRST_DOCUMENTS.map((d, i) => (
              <li key={d.title} className="flex gap-4 rounded-[12px] border border-mk-line bg-mk-surface p-6">
                <span className="font-mono text-[13px] text-mk-accent">{String(i + 1).padStart(2, "0")}</span>
                <div className="flex flex-col gap-1.5">
                  <H3>{d.title}</H3>
                  <Body>{d.text}</Body>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section tone="light">
        <SectionIntro
          eyebrow="How it works"
          title="From site paperwork to a published figure."
          lead="Four stages, each one recorded. Nothing reaches a report without passing through review and a pinned calculation run."
        />
        <ol className="mt-14 grid gap-8 md:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.step} className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-[12px] border border-mk-line bg-mk-paper">
                <Image src={s.img} alt={s.alt} width={2400} height={1500} sizes="(min-width: 768px) 560px, 100vw" className="h-auto w-full" />
              </div>
              <div className="flex gap-4">
                <span className="font-mono text-[13px] text-mk-accent">{String(i + 1).padStart(2, "0")}</span>
                <div className="flex flex-col gap-1.5">
                  <H3>{s.step}</H3>
                  <Body>{s.text}</Body>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="dark" video="/marketing/loops/record.mp4" poster="/marketing/loops/record.jpg">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <SectionIntro
              eyebrow="Prove the number"
              tone="dark"
              title="Open any figure and see how it was made."
              lead="Every activity record keeps its calculations, and each one states the amount, the factor, the library it came from and the methodology version."
            />
            <div className="rounded-[12px] border border-white/10 bg-mk-ink-2 p-5 font-mono text-[13px] leading-relaxed text-mk-on-dark">
              <p className="text-mk-on-dark-3">Plant HVO trial, A61 corridor works, FY2025</p>
              <p className="mt-2">6,500 litre × 0.03558 kg CO₂e/litre = 231.27 kg CO₂e</p>
              <p className="mt-1 text-mk-on-dark-3">Biogenic CO₂ reported separately, outside the scopes</p>
              <p className="mt-2 text-mk-on-dark-3">DEFRA 2025.2 · ghg-protocol-v2026-02 · AR6</p>
            </div>
            <TextLink href="/methodology" tone="dark">
              Read the methodology
            </TextLink>
          </div>
          <ProductLoop
            src="/marketing/loops/record.mp4"
            poster="/marketing/loops/record.jpg"
            label="Activity record showing each calculation with its factor, library and formula"
            tone="dark"
          />
        </div>
      </Section>

      <Section tone="paper">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
          <ProductShot src="/marketing/screens/calc-run.jpg" alt="Calculation run detail with checks before publishing and an uncertainty range" width={2400} height={1500} />
          <div className="flex flex-col gap-6">
            <SectionIntro
              eyebrow="Before you publish"
              title="Checks you would otherwise do in a spreadsheet."
              lead="Each run lists what needed judgement, so a reviewer can see it before the figure is frozen."
            />
            <CheckList
              items={[
                "Unit conversions and spend deflation to the factor's price year, listed with the records they touched",
                "A Monte Carlo 95% range from each record's data quality, next to what a simple sum would claim",
                "Biogenic CO₂ from HVO and biomass reported beside the inventory, never inside it",
                "A warning on any factor marked unverified, and on records with no matching factor",
              ]}
            />
          </div>
        </div>
      </Section>

      <Section tone="light">
        <SectionIntro eyebrow="The platform" title="One dataset, from the site to the board report." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-[12px] border border-mk-line bg-mk-line sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map((a) => (
            <Link key={a.href} href={a.href} className="group flex flex-col gap-3 bg-mk-surface p-7 transition-colors hover:bg-mk-paper">
              <H3>{a.title}</H3>
              <Body>{a.text}</Body>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-medium text-mk-accent">
                Learn more <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section tone="dark" video="/marketing/loops/compliance.mp4" poster="/marketing/loops/compliance.jpg">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <SectionIntro
              eyebrow="Compliance"
              tone="dark"
              title="Answer each framework from the same numbers."
              lead="The crosswalk shows which disclosure points your data already satisfies, which are partly there and which need a person to write something."
            />
            <CheckList
              tone="dark"
              items={["SECR, ESRS E1, GHG Protocol, GRI 305, IFRS S2 and CDP", "ESRS E1 gap analysis with the next action for each point", "A regulatory calendar with the deadlines that apply to you"]}
            />
            <TextLink href="/product#compliance" tone="dark">
              See compliance features
            </TextLink>
          </div>
          <ProductLoop
            src="/marketing/loops/compliance.mp4"
            poster="/marketing/loops/compliance.jpg"
            label="Framework crosswalk showing coverage for each disclosure framework"
            tone="dark"
          />
        </div>
      </Section>

      <Section tone="light">
        <SectionIntro eyebrow="Who it is for" title="Built around how UK contractors work." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <Link key={a.href} href={a.href} className="group flex flex-col gap-3 rounded-[12px] border border-mk-line p-7 transition-colors hover:border-mk-text/30">
              <H3>{a.title}</H3>
              <Body>{a.text}</Body>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-medium text-mk-accent">
                Explore <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <ClosingCta
        title="Bring one site and one year of data."
        lead="Start a trial and import your own records, or book a pilot and we will set it up around a live project with you."
      />
    </>
  );
}
