import { GuideLinks } from "@/components/marketing/guide-links";
import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
import { Check, Minus } from "lucide-react";
import { PLAN_ANNUAL_TOTAL, PLAN_PRICES } from "@/lib/billing/limits";
import { ButtonLink, ClosingCta, Eyebrow, H1, H3, Lead, Section, SectionIntro, reveal } from "@/components/marketing/kit";
import { cn } from "@/lib/utils";
import { StripeNote } from "@/components/marketing/brand-marks";

export const metadata: Metadata = withSocial({
  title: "Carbon reporting software pricing",
  description: "Priced per organisation by sites and web users. Essentials £199 a year for a PPN 006 Carbon Reduction Plan, Starter £99 a month, Growth £299 a month, Enterprise from £750 a month. 30-day trial.",
  alternates: { canonical: "/pricing" },
});

type Tier = {
  name: string;
  price: string;
  period: string;
  note: string;
  forWho: string;
  cta: { href: string; label: string };
  features: { name: string; included: boolean }[];
  highlight?: boolean;
};

// Features follow PLAN_FEATURES and limits follow PLAN_LIMITS in lib/billing/limits.ts.
const TIERS: Tier[] = [
  {
    name: "Essentials",
    price: `£${PLAN_ANNUAL_TOTAL.essentials}`,
    period: "per year",
    note: "Billed yearly",
    forWho: "For an SME that needs a PPN 006 Carbon Reduction Plan for a tender.",
    cta: { href: "/sign-up?start=crp", label: "Start your plan" },
    features: [
      { name: "1 site and 2 web users", included: true },
      { name: "Unlimited field workers on the mobile app", included: true },
      { name: "Scope 1, 2 and 3 with DEFRA, EPA, ADEME and spend factors", included: true },
      { name: "Guided PPN 006 Carbon Reduction Plan, checked before it is generated", included: true },
      { name: "GHG Protocol report with the auditor's CSV calculation trail", included: true },
      { name: "Email support", included: true },
      { name: "SECR and the other report types", included: false },
      { name: "Management systems (ISO 14001, 45001, 9001)", included: false },
    ],
  },
  {
    name: "Starter",
    price: `£${PLAN_PRICES.starter.monthly}`,
    period: "per month",
    note: `or £${PLAN_ANNUAL_TOTAL.starter.toLocaleString("en-GB")} a year, two months free`,
    forWho: "For one business reporting SECR and answering tender questions.",
    cta: { href: "/sign-up", label: "Start a 30-day trial" },
    features: [
      { name: "Up to 3 sites and 5 web users", included: true },
      { name: "Unlimited field workers on the mobile app", included: true },
      { name: "Scope 1, 2 and 3 with DEFRA, EPA, ADEME and spend factors", included: true },
      { name: "Guided PPN 006 Carbon Reduction Plan and SECR report", included: true },
      { name: "Emissions reports with the auditor's CSV calculation trail", included: true },
      { name: "One management system framework, such as ISO 14001, with shared registers", included: true },
      { name: "Email support", included: true },
      { name: "Social value (TOMs) tracking", included: false },
      { name: "Bid carbon pack and PAS 2080", included: false },
      { name: "Xero sync", included: false },
    ],
  },
  {
    name: "Growth",
    price: `£${PLAN_PRICES.growth.monthly}`,
    period: "per month",
    note: `or £${PLAN_ANNUAL_TOTAL.growth.toLocaleString("en-GB")} a year, two months free`,
    forWho: "For contractors bidding for public work and managing several sites.",
    cta: { href: "/sign-up", label: "Start a 30-day trial" },
    highlight: true,
    features: [
      { name: "Up to 15 sites or contracts and 25 web users", included: true },
      { name: "Unlimited field workers and supplier logins", included: true },
      { name: "Everything in Starter", included: true },
      { name: "Social value (TOMs) tracking", included: true },
      { name: "Bid carbon pack, PAS 2080 and project carbon budgets", included: true },
      { name: "Xero sync", included: true },
      { name: "Up to 5 management system frameworks, for example ISO 9001, 14001 and 45001 as one system", included: true },
      { name: "Priority support and an onboarding call", included: true },
    ],
  },
  {
    name: "Enterprise",
    price: `£${PLAN_PRICES.enterprise.monthly}`,
    period: "per month",
    note: "From this, billed annually by invoice",
    forWho: "For groups with many sites, entities and IT requirements.",
    cta: { href: "/contact", label: "Talk to us" },
    features: [
      { name: "Unlimited sites, entities and users", included: true },
      { name: "Everything in Growth", included: true },
      { name: "Every management system framework in the catalogue", included: true },
      { name: "Single sign-on (SAML or OpenID Connect)", included: true },
      { name: "Invoice anomaly detection", included: true },
      { name: "Live dashboard updates", included: true },
      { name: "Named contact and priority support", included: true },
    ],
  },
];

const FAQ = [
  {
    q: "What does the trial include?",
    a: "30 days with the Growth features, so you can try social value, the bid carbon pack and PAS 2080. During the trial an organisation can have 2 sites, 3 web users and 2 generated reports a month. No card is needed to start.",
  },
  {
    q: "What is Essentials for?",
    a: "Organisations that need a PPN 006 Carbon Reduction Plan for a tender and little else. It covers one site and two web users, calculates Scope 1, 2 and 3 from your records and generates the Carbon Reduction Plan and a GHG Protocol report. It is billed yearly because the plan is renewed once a year. Move up to Starter for SECR, the other report types and management systems.",
  },
  {
    q: "Which accounting systems connect?",
    a: "Xero connects directly on Growth and Enterprise. For SAP, Sage, QuickBooks, Causeway, COINS and other ledgers, save an export profile once and import the ledger export each month: your account and cost code rules decide what counts as emissions, and nothing is recorded until you commit it.",
  },
  {
    q: "Who counts as a web user?",
    a: "Anyone who signs in to the web app: admins, editors, reviewers, viewers and auditors. Field workers using the mobile app and supplier portal logins are never counted.",
  },
  {
    q: "What counts as a management system framework?",
    a: "Each standard or law you adopt in Management systems, such as ISO 14001, ISO 45001, ISO 27001 or UK GDPR. Essentials includes none, Starter one, Growth five and Enterprise all of them; the trial includes three. The registers for risks, policies, audits, corrective actions and management reviews are shared by every framework and are not counted. A framework you withdraw stops counting and keeps its history.",
  },
  {
    q: "Can I change plan or cancel?",
    a: "Yes. Move between Essentials, Starter and Growth or cancel from Settings, then Billing. A cancelled plan runs to the end of the period you have paid for. There is no minimum term on monthly plans.",
  },
  {
    q: "Is VAT added?",
    a: "Prices are in pounds and exclude VAT. MetricOra is not VAT-registered at present, so no VAT is charged.",
  },
  {
    q: "Who owns the data?",
    a: "You do. You can export records, calculations and reports at any time, and we do not sell or share customer data.",
  },
];

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      name: "MetricOra",
      description: "Carbon evidence, accounting and reporting for UK contractors, priced per organisation.",
      brand: { "@type": "Brand", name: "MetricOra" },
      offers: [
        { "@type": "Offer", name: "Essentials, annual", price: String(PLAN_ANNUAL_TOTAL.essentials), priceCurrency: "GBP", url: "https://www.metricora.co.uk/pricing" },
        { "@type": "Offer", name: "Starter, monthly", price: String(PLAN_PRICES.starter.monthly), priceCurrency: "GBP", url: "https://www.metricora.co.uk/pricing" },
        { "@type": "Offer", name: "Starter, annual", price: String(PLAN_ANNUAL_TOTAL.starter), priceCurrency: "GBP", url: "https://www.metricora.co.uk/pricing" },
        { "@type": "Offer", name: "Growth, monthly", price: String(PLAN_PRICES.growth.monthly), priceCurrency: "GBP", url: "https://www.metricora.co.uk/pricing" },
        { "@type": "Offer", name: "Growth, annual", price: String(PLAN_ANNUAL_TOTAL.growth), priceCurrency: "GBP", url: "https://www.metricora.co.uk/pricing" },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export default function PricingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }} />
      <Section tone="dark" size="lg" video="/marketing/loops/reports.mp4" poster="/marketing/loops/reports.jpg" className="pt-36 sm:pt-40">
        <div className="flex max-w-3xl flex-col gap-6">
          <Eyebrow tone="dark">Pricing</Eyebrow>
          <H1>Priced by sites and web users, not by field workers.</H1>
          <Lead tone="dark">One price per organisation. Everyone on site can capture evidence on the app at no extra cost.</Lead>
        </div>
      </Section>

      <Section tone="paper" className="-mt-px">
        <h2 className="sr-only">Plans</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((t, i) => (
            <div
              key={t.name}
              {...reveal(i, "self", 4)}
              className={cn(
                "flex flex-col gap-6 rounded-[12px] border bg-mk-surface p-7",
                t.highlight ? "border-mk-accent shadow-[0_24px_48px_-24px_rgba(194,65,12,0.35)]" : "border-mk-line",
              )}
            >
              <div className="flex items-center justify-between">
                <H3 className="text-[20px]">{t.name}</H3>
                {t.highlight ? (
                  <span className="rounded-full bg-mk-accent-soft px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-mk-accent-hover">Most chosen</span>
                ) : null}
              </div>
              <p className="text-[15px] text-mk-text-2">{t.forWho}</p>
              <div>
                <p className="flex items-baseline gap-2">
                  <span className="text-[40px] font-semibold tracking-[-0.03em]">{t.price}</span>
                  <span className="text-[15px] text-mk-text-3">{t.period}</span>
                </p>
                <p className="text-[13px] text-mk-text-3">{t.note}</p>
              </div>
              <ButtonLink href={t.cta.href} variant={t.highlight ? "primary" : "secondary"}>
                {t.cta.label}
              </ButtonLink>
              <ul className="grid gap-3 border-t border-mk-line pt-6">
                {t.features.map((f) => (
                  <li key={f.name} className={cn("flex gap-3 text-[14px] leading-snug", f.included ? "text-mk-text-2" : "text-mk-text-3")}>
                    {f.included ? (
                      <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-mk-accent" />
                    ) : (
                      <Minus aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {f.included ? null : <span className="sr-only">Not included: </span>}
                      {f.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[14px] text-mk-text-3">Prices in GBP, excluding VAT. MetricOra is not currently VAT-registered.</p>
          <StripeNote />
        </div>
      </Section>

      <Section tone="light">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <SectionIntro eyebrow="Questions" title="Before you choose a plan." />
          <dl className="divide-y divide-mk-line border-y border-mk-line">
            {FAQ.map((f) => (
              <div key={f.q} className="py-6">
                <dt className="text-[16px] font-semibold">{f.q}</dt>
                <dd className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-mk-text-2">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <GuideLinks links={[
        { href: "/blog/ppn-006-carbon-reduction-plan-guide", title: "PPN 006 Carbon Reduction Plans", text: "What the Essentials plan produces and what bidders must publish." },
        { href: "/blog/secr-reporting-guide-for-contractors", title: "SECR reporting", text: "Who must report and what to disclose." },
        { href: "/blog/scope-1-2-3-emissions-for-contractors", title: "Scope 1, 2 and 3 for contractors", text: "What counts in each scope." },
      ]} />

      <ClosingCta title="Try it on your own data." lead="Import a year of meter, fuel and spend data, publish a snapshot and generate a report inside the trial." />
    </>
  );
}
