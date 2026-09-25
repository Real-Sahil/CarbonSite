import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
import type { ReactNode } from "react";
import {
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
  type Tone,
} from "@/components/marketing/kit";

export const metadata: Metadata = withSocial({
  title: "Platform",
  description:
    "Evidence capture, carbon accounting, reporting and assurance, compliance, targets and supply-chain modules in one MetricOra dataset.",
  alternates: { canonical: "/product" },
});

function Feature({
  id,
  tone,
  eyebrow,
  title,
  lead,
  points,
  media,
  link,
  flip,
  video,
}: {
  id: string;
  tone: Tone;
  eyebrow: string;
  title: string;
  lead: string;
  points: ReactNode[];
  media: ReactNode;
  link?: { href: string; label: string };
  flip?: boolean;
  video?: string;
}) {
  return (
    <Section id={id} tone={tone} video={video} poster={video?.replace(".mp4", ".jpg")}>
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div className={flip ? "lg:order-2" : undefined}>
          <div className="flex flex-col gap-6">
            <SectionIntro eyebrow={eyebrow} title={title} lead={lead} tone={tone} />
            <CheckList items={points} tone={tone} />
            {link ? (
              <TextLink href={link.href} tone={tone}>
                {link.label}
              </TextLink>
            ) : null}
          </div>
        </div>
        <div className={flip ? "lg:order-1" : undefined}>{media}</div>
      </div>
    </Section>
  );
}

const OPERATIONS = [
  { title: "Supplier data requests", text: "Send a request by category and period. Suppliers answer in a portal without a full account, and you accept the answer before it becomes a record." },
  { title: "Spend-based Scope 3", text: "Priced by the supplier's industry code against Defra UK multipliers, EPA USEEIO or ADEME ratios, converted at the ECB rate for the date and deflated to the factor's price year." },
  { title: "Social value (TOMs)", text: "National TOMs commitments against contracts and periods, with delivery logged as activities." },
  { title: "Embodied carbon and PAS 2080", text: "Material records from ICE factors or supplier EPDs, carbon management plans per project and a reduction opportunity log." },
  { title: "Plant and telematics", text: "Plant register and ISO 15143-3 feeds for hours, idling and fuel, reconciled against approved diesel and HVO records." },
  { title: "Environmental registers", text: "Permits, incidents, legal register, aspects and impacts, a waste duty-of-care register, water and biodiversity net gain." },
];

export default function ProductPage() {
  return (
    <>
      <Section tone="dark" size="lg" video="/marketing/loops/prove.mp4" poster="/marketing/loops/prove.jpg" className="pt-36 sm:pt-40">
        <div className="flex max-w-3xl flex-col gap-6">
          <Eyebrow tone="dark">Platform</Eyebrow>
          <H1>One dataset from site evidence to board report.</H1>
          <Lead tone="dark">
            Evidence, calculation, reporting and compliance share the same records, so a figure in a tender answer, an SECR disclosure and the dashboard all
            come from one published snapshot.
          </Lead>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/sign-up">Start a 30-day trial</ButtonLink>
            <ButtonLink href="/pricing" variant="secondary" tone="dark">
              See pricing
            </ButtonLink>
          </div>
        </div>
      </Section>

      <Feature
        id="evidence"
        tone="light"
        eyebrow="Evidence capture"
        title="Evidence checked before it counts."
        lead="Field teams submit from the app, office teams import files, and nothing becomes an activity record until someone has reviewed it."
        points={[
          "Field app for tickets, delivery notes and fuel receipts, with on-device text recognition and an offline queue",
          "CSV and Excel imports with row-level errors, duplicate warnings and no partial commits",
          "Review screen shows what the phone read next to what was submitted, so edited values stand out",
          "Claim, query or approve, with comments kept against the submission",
        ]}
        media={<ProductLoop src="/marketing/loops/review.mp4" poster="/marketing/loops/review.jpg" label="Reviewing a waste ticket submitted from site" />}
        link={{ href: "/field-app", label: "About the field app" }}
      />

      <Feature
        id="carbon"
        tone="dark"
        video="/marketing/loops/calc.mp4"
        eyebrow="Carbon accounting"
        title="Scope 1, 2 and 3 with named factors."
        lead="Each calculation run uses one factor library and one methodology version, and stores the formula for every record."
        points={[
          "DEFRA 2025.2 and 2026.1, US EPA, EPA USEEIO 1.3, ADEME Base Carbone and Defra UK spend multipliers",
          "Your own organisation factors are matched first, then the run's library",
          "Location- and market-based Scope 2, with REGOs, PPAs, green tariffs and residual mix in GHG Protocol order",
          "HVO and biomass handled with biogenic CO₂ kept outside the inventory",
          "Monte Carlo uncertainty range and data-quality scores for every run",
        ]}
        media={<ProductLoop src="/marketing/loops/calc.mp4" poster="/marketing/loops/calc.jpg" label="Calculation run detail" tone="dark" />}
        link={{ href: "/methodology", label: "Read the methodology" }}
        flip
      />

      <Feature
        id="reporting"
        tone="light"
        eyebrow="Reporting and assurance"
        title="Reports that hold up when they are checked."
        lead="A published snapshot never changes. Recalculating creates a new version, and the dashboard tells you when live data has moved away from the last one. Every report reads from that frozen snapshot."
        points={[
          "A guided PPN 006 Carbon Reduction Plan that checks each item an evaluator looks for before it can be generated",
          "SECR, GHG Protocol and Carbon Reduction Plan first; ESRS, CDP, CBAM and the rest one click away",
          "PDF reports with a CSV calculation trail, a SHA-256 checksum and a code to verify the report online",
          "Hash-chained audit trail of imports, reviews, calculations, publications and downloads",
          "Assurance readiness score and an evidence export for your verifier",
          "Factor licence attribution printed on every report",
        ]}
        media={<ProductShot src="/marketing/screens/crp-check.jpg" alt="Carbon Reduction Plan check listing each PPN 006 item as complete, with one recommendation outstanding" width={2400} height={1500} />}
      />

      <Feature
        id="compliance"
        tone="paper"
        eyebrow="Compliance"
        title="Know what each framework still needs."
        lead="The crosswalk maps your data to each framework's disclosure points and marks what is covered, partial or missing."
        points={[
          "SECR, ESRS E1, GHG Protocol, GRI 305, IFRS S2 and CDP from the same dataset",
          "ESRS E1 gap analysis with the next action for each disclosure",
          "Regulatory calendar covering SBTi, ESOS and CSRD dates",
          "Bid carbon pack with a PPN 006 Carbon Reduction Plan for public tenders",
        ]}
        media={<ProductShot src="/marketing/screens/esrs-e1.jpg" alt="ESRS E1 gap analysis with coverage and actions" width={2400} height={1500} />}
        flip
      />

      <Feature
        id="planning"
        tone="light"
        eyebrow="Targets and planning"
        title="A base year you can defend, and a plan to beat it."
        lead="Set the base year and recalculation threshold, then plan reductions against it with costs in pounds per tonne."
        points={[
          "Base year with structural changes and a restatement register",
          "Decarbonisation pathway against a 1.5°C benchmark and your own target",
          "Transition plan checklist aligned to ESRS E1-1 and the UK Transition Plan Taskforce",
          "Internal carbon price applied to appraisals and the abatement cost curve",
        ]}
        media={<ProductShot src="/marketing/screens/base-year.jpg" alt="Base year and recalculation policy page" width={2400} height={1500} />}
      />

      <Section id="operations" tone="paper">
        <SectionIntro
          eyebrow="Supply chain and site operations"
          title="The rest of what a contractor reports on."
          lead="These modules sit on the same organisation, sites and people, so there is one place to manage access and one audit trail."
        />
        <div className="mt-12 grid gap-px overflow-hidden rounded-[12px] border border-mk-line bg-mk-line sm:grid-cols-2 lg:grid-cols-3">
          {OPERATIONS.map((o) => (
            <div key={o.title} className="flex flex-col gap-2 bg-mk-surface p-7">
              <H3>{o.title}</H3>
              <p className="text-[15px] leading-relaxed text-mk-text-2">{o.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <ClosingCta title="See it with your own records." lead="The trial includes every Growth feature. Import a year of data and publish your first snapshot." />
    </>
  );
}
