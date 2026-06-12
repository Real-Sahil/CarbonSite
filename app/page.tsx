import Link from "next/link";
import {
  BarChart3,
  ClipboardCheck,
  MapPinned,
  ShieldCheck,
} from "lucide-react";
import {
  FeatureCard,
  LinkedPanel,
  PublicFooter,
} from "@/components/public-site";
import { HeroSection } from "@/components/hero-section";

export default function RootPage() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-black text-white">
      {/* Full-screen video hero */}
      <HeroSection />

      {/* Feature section */}
      <div className="bg-[#fffefc] text-[#000000]">
        <section className="border-y border-[#e5e7eb]">
          <div className="mx-auto max-w-7xl px-5 py-14">
            <div className="max-w-2xl mb-[42px]">
              <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
                Platform
              </p>
              <h2
                className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
                style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
              >
                One workspace for evidence, review, calculation, and reporting.
              </h2>
              <p className="mt-[7px] text-sm leading-7 text-[#222222] tracking-[-0.42px]">
                CarbonSite follows the operational trail from field documents and supplier files
                through review, calculation snapshots, and downloadable reporting packs.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FeatureCard
                icon={ClipboardCheck}
                title="Review before approval"
                text="Field submissions land in a triage queue with reviewer assignment, evidence, comments, and approval status."
              />
              <FeatureCard
                icon={MapPinned}
                title="Distance with provenance"
                text="Pickup and delivery postcodes resolve to cached route distance with coordinates and route source stored."
              />
              <FeatureCard
                icon={BarChart3}
                title="Calculated aggregates"
                text="Dashboards read from calculation aggregates and published snapshots, not manual marketing totals."
              />
              <FeatureCard
                icon={ShieldCheck}
                title="Tenant-scoped control"
                text="Operational records, tasks, invites, evidence files, audit logs, and reports are organisation scoped."
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14">
          <div className="max-w-2xl mb-[42px]">
            <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
              Workflows
            </p>
            <h2
              className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
              style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
            >
              Explore the core workflows.
            </h2>
            <p className="mt-[7px] text-sm leading-7 text-[#222222] tracking-[-0.42px]">
              Each area is written for the teams who collect, check, approve, and report
              construction carbon data.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <LinkedPanel
              href="/product"
              title="Product"
              text="Field capture, import centre, route distance, review tasks, calculations, and reports."
            />
            <LinkedPanel
              href="/solutions/construction"
              title="Construction"
              text="Materials, waste collections, tipper haulage, supplier evidence, and site teams."
            />
            <LinkedPanel
              href="/solutions/waste-haulage"
              title="Waste and haulage"
              text="Waste tickets, transfer notes, carrier movements, route distance, and review evidence."
            />
            <LinkedPanel
              href="/field-app"
              title="Field app"
              text="Mobile capture for site teams with offline queueing, OCR extraction, postcodes, and evidence upload."
            />
            <LinkedPanel
              href="/security"
              title="Security"
              text="Tenant access, protected evidence, audit history, review controls, and operational assurance."
            />
            <LinkedPanel
              href="/resources"
              title="Resources"
              text="Pilot planning, field evidence standards, factor governance, and reporting guidance."
            />
          </div>
        </section>

        <PublicFooter />
      </div>
    </main>
  );
}
