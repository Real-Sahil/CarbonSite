import Link from "next/link";
import { ArrowRight, Factory, FileText, Recycle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard, PageHero, PublicShell } from "@/components/public-site";

export default function ConstructionSolutionPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Construction solution"
        title="Materials, waste, and haulage reporting for live project teams."
        text="CarbonSite is shaped around UK construction operations: supplier deliveries, waste transfer notes, tipper movements, subcontractor evidence, and project reporting periods."
        image="/carbonsite-route-evidence.svg"
        imageAlt="Construction route evidence and postcode distance map"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/contact">
              Discuss a pilot
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="bg-white">
            <Link href="/product#field-capture">View field capture</Link>
          </Button>
        </div>
      </PageHero>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">Built around the documents site teams already handle.</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              The first production wedge focuses on activity that tends to arrive late, messy, or fragmented across inboxes, site folders, and supplier portals.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FeatureCard icon={Factory} title="Materials delivered" text="Concrete, aggregate, steel, fuels, and project purchases captured against periods and categories." />
            <FeatureCard icon={Recycle} title="Waste collections" text="Waste tickets, EWC codes, weights, transfer notes, and evidence files move through review." />
            <FeatureCard icon={Truck} title="Tipper and haulage" text="Pickup and delivery postcodes calculate distance for trips, loads, and subcontractor movements." />
            <FeatureCard icon={FileText} title="Supplier files" text="CSV and XLSX uploads stage rows with validation before activity records are committed." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            ["Site teams", "Capture evidence quickly on mobile and keep offline submissions queued until the device reconnects."],
            ["Carbon reviewers", "Approve, reject, request more information, assign tasks, and link evidence to records."],
            ["Commercial leaders", "Read published snapshots, report artefacts, and audit logs tied to real project activity."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
