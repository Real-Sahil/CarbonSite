import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileCheck2,
  MapPinned,
  Recycle,
  Scale,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard, PageHero, PublicShell } from "@/components/public-site";

export default function WasteHaulagePage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Waste and haulage"
        title="Turn waste tickets and carrier movements into traceable carbon records."
        text="CarbonSite connects transfer notes, EWC codes, load weights, carrier details, pickup and delivery postcodes, reviewer decisions, and report-ready evidence."
        image="/carbonsite-route-evidence.svg"
        imageAlt="CarbonSite route evidence and waste collection reporting"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/contact">
              Scope waste workflow
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="bg-white">
            <Link href="/field-app">Open field capture</Link>
          </Button>
        </div>
      </PageHero>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
              Built for the operational details behind waste and tipper reporting.
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              The workflow keeps the document, route, quantity, review decision, and calculation context together from capture through reporting.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FeatureCard icon={Recycle} title="Waste collections" text="Capture waste stream, transfer note, carrier, EWC code, and evidence status." />
            <FeatureCard icon={Scale} title="Weights and units" text="Review tonnes, kilograms, litres, trips, and other site-supplied units before approval." />
            <FeatureCard icon={Truck} title="Tipper movements" text="Record carrier movements with route postcodes, supplier notes, and load context." />
            <FeatureCard icon={MapPinned} title="Distance provenance" text="Store route distance, coordinates, and calculation method with the operational record." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid gap-5 lg:grid-cols-3">
          <Process title="Capture" icon={ClipboardList} text="Field workers or office teams attach evidence, enter quantities, and supply route postcodes." />
          <Process title="Review" icon={FileCheck2} text="Reviewers approve, reject, request more information, and attach comments before records are committed." />
          <Process title="Report" icon={Truck} text="Approved records flow into calculation runs, published snapshots, downloadable reports, and audit history." />
        </div>
      </section>
    </PublicShell>
  );
}

function Process({
  title,
  icon: Icon,
  text,
}: {
  title: string;
  icon: React.ElementType;
  text: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-50 text-green-800">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </article>
  );
}
