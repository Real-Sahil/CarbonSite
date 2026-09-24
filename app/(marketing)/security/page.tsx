import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
import { Body, ButtonLink, ClosingCta, Eyebrow, H1, H3, Lead, ProductShot, Section, SectionIntro, CheckList } from "@/components/marketing/kit";

export const metadata: Metadata = withSocial({
  title: "Security",
  description: "How MetricOra isolates each organisation's data, controls access by role, records every change and backs up your records.",
  alternates: { canonical: "/security" },
});

const CONTROLS = [
  {
    title: "Organisation isolation",
    text: "Every record belongs to one organisation, and every query is scoped to it after the user's membership is checked on the server. Automated tests try to read and write across organisations on each change.",
  },
  {
    title: "Six roles",
    text: "Admin, editor, reviewer, viewer, auditor and field worker. Roles are read from the membership record, never from anything the browser or phone sends.",
  },
  {
    title: "Files and downloads",
    text: "Evidence, imports and reports sit in private storage. Download links are created on the server after the access check and expire after an hour.",
  },
  {
    title: "Append-only audit trail",
    text: "Sign-ins, role changes, imports, record edits, calculation runs, publications, report downloads and reviews are recorded. Each entry includes a hash of the one before it, so a gap or edit shows.",
  },
  {
    title: "Immutable snapshots",
    text: "Publishing freezes a calculation run. Reports from that snapshot always reproduce the same figures, and recalculating creates a new version.",
  },
  {
    title: "Database access",
    text: "The application connects to PostgreSQL through its own server code only. Row-level security denies the database's public API roles on every table.",
  },
  {
    title: "Rate limits and headers",
    text: "Sign-in, upload and write endpoints are rate-limited. Responses carry frame protection, a strict referrer policy, a permissions policy and strict transport security.",
  },
  {
    title: "Backups",
    text: "The database is dumped nightly, encrypted with AES-256 and stored privately, with daily copies kept 35 days and monthly copies kept longer. A restore is rehearsed every week.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <Section tone="dark" size="lg" video="/marketing/loops/prove.mp4" poster="/marketing/loops/prove.jpg" className="pt-36 sm:pt-40">
        <div className="flex max-w-3xl flex-col gap-6">
          <Eyebrow tone="dark">Security</Eyebrow>
          <H1>Built to be audited, including by your IT team.</H1>
          <Lead tone="dark">Carbon figures end up in annual reports and tenders, so the controls around them need to be as checkable as the numbers.</Lead>
        </div>
      </Section>

      <Section tone="light">
        <SectionIntro eyebrow="Controls" title="What protects your data." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-[12px] border border-mk-line bg-mk-line sm:grid-cols-2">
          {CONTROLS.map((c) => (
            <div key={c.title} className="flex flex-col gap-2 bg-mk-surface p-7">
              <H3>{c.title}</H3>
              <Body>{c.text}</Body>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="paper">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <SectionIntro
              eyebrow="Where it runs"
              title="Infrastructure and people."
              lead="MetricOra is a hosted service. The web app runs on Vercel and data is held in a managed PostgreSQL database and private object storage."
            />
            <CheckList
              items={[
                "Sign-in sessions are stored in our own database, not a separate identity provider",
                "Enterprise plans can sign in with SAML or OpenID Connect",
                "Error monitoring uses Sentry's EU region",
                "You choose how long evidence files are kept under Settings, then Data retention",
                "Subject access exports and erasure requests are handled in the product",
              ]}
            />
            <Body>Ask us for our data processing agreement, sub-processor list and hosting regions.</Body>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/dpa" variant="secondary">
                Data processing agreement
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary">
                Ask a security question
              </ButtonLink>
            </div>
          </div>
          <ProductShot src="/marketing/screens/audit-trail.jpg" alt="Audit trail listing reviews, imports and calculation runs" width={2400} height={1500} />
        </div>
      </Section>

      <ClosingCta title="Walk through the controls with us." lead="We can take your IT or procurement team through access, retention and hosting on a call." />
    </>
  );
}
