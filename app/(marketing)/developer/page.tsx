import type { Metadata } from "next";
import { Body, ClosingCta, Eyebrow, H1, H3, Lead, Section, SectionIntro } from "@/components/marketing/kit";

export const metadata: Metadata = {
  title: "Developers",
  description: "MetricOra API keys, data ingest endpoints, snapshot export and signed outbound webhooks.",
  alternates: { canonical: "/developer" },
};

const BASE = "https://www.metricora.co.uk";

const ENDPOINTS = [
  {
    method: "POST",
    path: "/api/orgs/{orgId}/integrations/{utilities|fleet|corporate-cards|webhooks}/ingest",
    text: "Send supplier, fleet, card or generic rows. They are normalised and staged as an import for a person to review and commit. Resending an identical payload returns the first batch.",
  },
  {
    method: "POST",
    path: "/api/orgs/{orgId}/integrations/plant/ingest",
    text: "Plant telematics snapshots in ISO 15143-3 (AEMP 2.0) form. Cumulative hours and fuel are differenced per machine.",
  },
  {
    method: "GET",
    path: "/api/orgs/{orgId}/reports/export?snapshotId=…&format=json|csv",
    text: "Figures from a published snapshot, with includeLineItems=true for every calculation row.",
  },
  {
    method: "GET",
    path: "/api/orgs/{orgId}/reports/xbrl-export?snapshotId=…",
    text: "Inline XBRL of a published snapshot for digital tagging.",
  },
  {
    method: "POST / GET",
    path: "/api/orgs/{orgId}/supplier-portal/pact-import · pact-export",
    text: "Product carbon footprints in the PACT data exchange format.",
  },
];

const EVENTS = ["calculation_run.completed", "report.ready", "field_submission.approved", "field_submission.rejected", "import.committed"];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-[12px] border border-white/10 bg-mk-ink-2 p-5 font-mono text-[13px] leading-relaxed text-mk-on-dark">
      <code>{children}</code>
    </pre>
  );
}

export default function DeveloperPage() {
  return (
    <>
      <Section tone="dark" size="lg" video="/marketing/loops/reports.mp4" poster="/marketing/loops/reports.jpg" className="pt-36 sm:pt-40">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Eyebrow tone="dark">Developers</Eyebrow>
            <H1>Send data in, take figures out.</H1>
            <Lead tone="dark">
              Organisation API keys push activity data into the review queue and pull published figures into your own systems. Webhooks tell you when
              something changes.
            </Lead>
          </div>
          <Code>{`curl "${BASE}/api/orgs/{orgId}/reports/export?snapshotId={id}&format=csv" \\
  -H "Authorization: Bearer csk_…"`}</Code>
        </div>
      </Section>

      <Section tone="light">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="flex flex-col gap-2">
            <H3>API keys</H3>
            <Body>An admin creates keys under Settings, then API keys. Keys start with csk_, belong to one organisation and are shown once.</Body>
          </div>
          <div className="flex flex-col gap-2">
            <H3>Authentication</H3>
            <Body>Send the key as a bearer token. A key for one organisation is refused on another organisation&apos;s endpoints.</Body>
          </div>
          <div className="flex flex-col gap-2">
            <H3>Nothing skips review</H3>
            <Body>Ingested rows arrive as an import batch. Someone in your team commits it before it becomes activity records.</Body>
          </div>
        </div>
      </Section>

      <Section tone="paper">
        <SectionIntro eyebrow="Endpoints" title="What an API key can call." lead={`All paths are relative to ${BASE}.`} />
        <div className="mt-10 divide-y divide-mk-line overflow-hidden rounded-[12px] border border-mk-line bg-mk-surface">
          {ENDPOINTS.map((e) => (
            <div key={e.path} className="grid gap-2 p-6 md:grid-cols-[110px_1fr]">
              <span className="font-mono text-[13px] font-medium text-mk-accent">{e.method}</span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <code className="break-all font-mono text-[14px] text-mk-text">{e.path}</code>
                <p className="text-[15px] leading-relaxed text-mk-text-2">{e.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="dark">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <SectionIntro
              eyebrow="Webhooks"
              tone="dark"
              title="Signed events to your endpoint."
              lead="Add an HTTPS endpoint under Settings, then Webhooks, and choose the events. Each delivery carries an X-MetricOra-Signature header: the HMAC-SHA256 of the raw body with your endpoint's secret."
            />
            <ul className="flex flex-wrap gap-2">
              {EVENTS.map((e) => (
                <li key={e} className="rounded-[8px] border border-white/15 px-2.5 py-1 font-mono text-[13px] text-mk-on-dark-2">
                  {e}
                </li>
              ))}
            </ul>
          </div>
          <Code>{`import crypto from "node:crypto";

const expected = crypto
  .createHmac("sha256", process.env.METRICORA_WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");

if (expected !== req.headers["x-metricora-signature"]) {
  return res.status(401).end();
}`}</Code>
        </div>
      </Section>

      <ClosingCta title="Need an endpoint that is not here?" lead="Tell us what you want to connect and we will look at it with you." />
    </>
  );
}
