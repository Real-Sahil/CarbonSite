import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
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
  Section,
  SectionIntro,
} from "@/components/marketing/kit";
import { GooglePlayBadge } from "@/components/marketing/brand-marks";

export const metadata: Metadata = withSocial({
  title: "Field app",
  description:
    "The MetricOra field app lets site teams and subcontractors photograph tickets, delivery notes and fuel receipts, read them on the phone and submit them offline.",
  alternates: { canonical: "/field-app" },
});

const STEPS = [
  { title: "Open the invite", text: "An admin sends a time-limited invite link by text or email. Opening it on the phone signs the worker in to your organisation." },
  { title: "Set a PIN", text: "A four-digit PIN protects the app. There is no username or password to remember." },
  { title: "Choose the site", text: "Workers see only the sites they have been assigned to." },
  { title: "Capture the document", text: "Waste ticket, delivery note, fuel receipt, water meter reading or other. Take a photo, pick one from the library or attach a file." },
  { title: "Check what was read", text: "Text recognition runs on the phone and fills the form. Each field carries a confidence score, and the worker corrects anything wrong." },
  { title: "Submit, with or without signal", text: "Submissions are saved on the phone first and sent in the background once there is a connection." },
];

const FIELDS = [
  { doc: "Waste ticket", fields: "Weight and unit, EWC code, date, vehicle registration, carrier" },
  { doc: "Delivery note", fields: "Material, quantity, date, supplier" },
  { doc: "Fuel receipt", fields: "Fuel type (including HVO), volume, date, vehicle registration, supplier" },
  { doc: "Water meter reading", fields: "Meter reading and date" },
];

export default function FieldAppPage() {
  return (
    <>
      <Section tone="dark" size="lg" video="/marketing/loops/review.mp4" poster="/marketing/loops/review.jpg" className="pt-36 sm:pt-40">
        <div className="flex max-w-3xl flex-col gap-6">
          <Eyebrow tone="dark">Field app</Eyebrow>
          <H1>Evidence captured where the work happens.</H1>
          <Lead tone="dark">
            Site teams, subcontractors and hauliers photograph the paperwork on the day. The phone reads it, the worker checks it, and it reaches your review
            queue even if they had no signal at the time.
          </Lead>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/sign-up">Start a 30-day trial</ButtonLink>
            <ButtonLink href="/solutions/construction" variant="secondary" tone="dark">
              Main contractors
            </ButtonLink>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <GooglePlayBadge />
            <p className="text-[14px] text-mk-on-dark-2">Android now. The iPhone app is in App Store review.</p>
          </div>
        </div>
      </Section>

      <Section tone="light">
        <SectionIntro eyebrow="On the phone" title="From invite to first submission." lead="Designed for people who are not carbon specialists and may be working in gloves." />
        <ol className="mt-12 grid gap-px overflow-hidden rounded-[12px] border border-mk-line bg-mk-line sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 bg-mk-surface p-7">
              <span className="font-mono text-[13px] text-mk-accent">{String(i + 1).padStart(2, "0")}</span>
              <H3>{s.title}</H3>
              <Body>{s.text}</Body>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="paper">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <SectionIntro
            eyebrow="What it reads"
            title="Fields pulled from each document."
            lead="Anything the phone cannot read with confidence is left for the worker to type. The original values stay with the submission."
          />
          <div className="overflow-x-auto rounded-[12px] border border-mk-line bg-mk-surface">
            <table className="w-full min-w-[480px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-mk-line font-mono text-[12px] uppercase tracking-[0.1em] text-mk-text-3">
                  <th className="px-5 py-3 font-medium">Document</th>
                  <th className="px-5 py-3 font-medium">Fields</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map((f) => (
                  <tr key={f.doc} className="border-b border-mk-line last:border-0">
                    <td className="px-5 py-4 font-medium">{f.doc}</td>
                    <td className="px-5 py-4 text-mk-text-2">{f.fields}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section tone="dark" video="/marketing/loops/review.mp4" poster="/marketing/loops/review.jpg">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <SectionIntro
              eyebrow="In the office"
              tone="dark"
              title="Reviewers see what the phone read."
              lead="Each submission shows the recognised values beside the submitted ones, the worker's location for the audit trail and any comments."
            />
            <CheckList
              tone="dark"
              items={[
                "Edited values are highlighted so a changed weight is easy to spot",
                "Pickup and delivery postcodes give a road distance for haulage",
                "Approving creates the activity record and keeps the link back to the evidence",
                "Delivery notes for materials can also create an embodied carbon record for the project",
              ]}
            />
          </div>
          <ProductLoop src="/marketing/loops/review.mp4" poster="/marketing/loops/review.jpg" label="Waste ticket review with recognised and submitted values" tone="dark" />
        </div>
      </Section>

      <Section tone="light">
        <div className="grid gap-12 lg:grid-cols-2">
          <SectionIntro
            eyebrow="Access"
            title="Subcontractors see their own work, nothing else."
            lead="The field worker role can submit evidence and follow its own submissions. It has no access to dashboards, calculations or anyone else's data, and this is checked on the server for every request."
          />
          <CheckList
            items={[
              "Field workers are never counted as paid web users",
              "Invites expire, and an admin can revoke access at any time",
              "Location is recorded for the audit trail and only used for distances when you choose",
            ]}
          />
        </div>
      </Section>

      <ClosingCta title="Put evidence capture in every van and site cabin." lead="Invite your first field worker in the trial. There is no charge per device." />
    </>
  );
}
