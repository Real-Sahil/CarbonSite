import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Database,
  FileCheck2,
  MapPinned,
  ScanLine,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard, PageHero, PublicShell } from "@/components/public-site";

export default function ProductPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Product"
        title="One operating system for construction carbon evidence."
        text="CarbonSite turns uploads, mobile submissions, route distance, review decisions, calculation runs, and report artefacts into one traceable workflow."
        image="/carbonsite-field-capture.svg"
        imageAlt="CarbonSite mobile field capture workflow"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/sign-up">
              Start pilot
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="bg-white">
            <Link href="/resources">Read implementation guides</Link>
          </Button>
        </div>
      </PageHero>

      <section className="border-y border-slate-200 bg-white" id="field-capture">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">Capture routes into the same record model.</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              The product accepts manual activity records, CSV or XLSX imports, evidence attachments, and mobile field submissions. Reviewers can approve field submissions into committed activity records.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FeatureCard icon={UploadCloud} title="Import centre" text="Uploads are stored, staged, validated, committed, and auditable with downloadable error exports." />
            <FeatureCard icon={ScanLine} title="Mobile evidence" text="Field workers capture waste tickets, delivery notes, fuel receipts, GPS, OCR output, postcodes, and evidence files." />
            <FeatureCard icon={ClipboardCheck} title="Review queue" text="Submissions, imports, reports, and records can be assigned as review tasks and closed with status history." />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[0.85fr_1.15fr]" id="route-distance">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">Distance provenance is part of the product, not a spreadsheet note.</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Pickup and delivery postcodes resolve to cached route distance with coordinates, provider, and calculation method stored against submissions and activity records.
          </p>
        </div>
        <div className="grid gap-3">
          <Step icon={MapPinned} title="Postcode geocoding" text="UK postcodes are normalised, geocoded, cached, and reused across route calculations." />
          <Step icon={Database} title="Route cache" text="Distances are stored by organisation and route hash so repeated trips are consistent and traceable." />
          <Step icon={FileCheck2} title="Reporting evidence" text="Distance source, evidence status, assumptions, and calculation appendix rows flow into report artefacts." />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white" id="reporting">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              ["Calculation runs", "Approved records are calculated against selected methodology and factor library versions."],
              ["Published snapshots", "Successful runs can be published into immutable snapshot versions for reporting."],
              ["PDF and CSV artefacts", "Reports are generated, checked, retained, and shared through controlled downloads."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-lg border border-slate-200 bg-[#fbfcf8] p-5">
                <h2 className="text-base font-semibold text-slate-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function Step({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-[44px_1fr]">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-50 text-green-800">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </div>
  );
}
