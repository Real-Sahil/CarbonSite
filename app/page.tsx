import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileCheck2,
  MapPinned,
  ShieldCheck,
  Truck,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FeatureCard,
  LinkedPanel,
  PageHero,
  PublicShell,
} from "@/components/public-site";

export default function RootPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="UK construction carbon operations"
        title="Audit-ready carbon data from site activity, not spreadsheets after the fact."
        text="CarbonSite connects field evidence, postcode route distance, activity records, calculation runs, and board-ready reports for construction teams."
        image="/carbonsite-site-operations.svg"
        imageAlt="CarbonSite construction reporting workspace"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/sign-up">
              Create organisation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="bg-white">
            <Link href="/product">Explore product</Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Proof icon={Truck} label="Materials and haulage" />
          <Proof icon={UploadCloud} label="Field evidence capture" />
          <Proof icon={FileCheck2} label="Snapshot reports" />
        </div>
      </PageHero>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
              The public site now maps to real product areas.
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Each page explains a concrete workflow in the production system: field intake, distance provenance, review tasks, factor imports, reports, and tenant controls.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
            Read the pages behind the product.
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            No empty brochure routes. These pages are populated with the workflows, controls, media, and implementation choices CarbonSite is built around.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            href="/security"
            title="Security"
            text="Multi-tenant access control, audit trail, storage policy, job processing, and health checks."
          />
          <LinkedPanel
            href="/resources"
            title="Resources"
            text="Implementation guides for Vercel deployment, mobile setup, factor imports, and reporting."
          />
        </div>
      </section>
    </PublicShell>
  );
}

function Proof({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
      <Icon className="h-4 w-4 text-green-800" />
      <span>{label}</span>
    </div>
  );
}
