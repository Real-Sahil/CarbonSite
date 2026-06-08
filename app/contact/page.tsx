import Link from "next/link";
import { ArrowRight, Building2, ClipboardCheck, Mail, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard, PageHero, PublicShell } from "@/components/public-site";

export default function ContactPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Pilot contact"
        title="Plan a CarbonSite pilot around real project data."
        text="Bring one construction project, one reporting period, field evidence, supplier files, and postcode routes. CarbonSite is designed to prove the workflow with live tenant data."
        image="/carbonsite-site-operations.svg"
        imageAlt="CarbonSite project operations dashboard media"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <a href="mailto:pilot@carbonsite.app?subject=CarbonSite%20pilot%20request">
              Email pilot team
              <Mail className="h-4 w-4" />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="bg-white">
            <Link href="/sign-up">
              Create workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </PageHero>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">What to prepare for a useful pilot.</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              The fastest pilot starts with actual operational records, not synthetic sample data. Use the checklist below to scope the first tenant and project.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <FeatureCard icon={Building2} title="Organisation setup" text="Confirm tenant name, admins, reviewers, facilities, business units, and reporting periods." />
            <FeatureCard icon={ClipboardCheck} title="Data sources" text="Bring supplier CSV or XLSX files, evidence PDFs or images, and field workers for mobile capture." />
            <FeatureCard icon={MapPinned} title="Route distance" text="Identify pickup and delivery postcode pairs for haulage, waste collections, or site deliveries." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-950">Pilot scope template</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              ["Project", "One active UK construction project with a defined reporting period."],
              ["Users", "Admin, reviewer, auditor, and field-worker roles invited into the tenant."],
              ["Records", "Manual records, staged import rows, and mobile submissions approved into activity records."],
              ["Outputs", "Calculation run, published snapshot, report artefacts, evidence downloads, and audit trail."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-lg border border-slate-200 bg-[#fbfcf8] p-4">
                <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
