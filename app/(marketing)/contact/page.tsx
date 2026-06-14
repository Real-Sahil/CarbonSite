import Link from "next/link";
import { ArrowRight, Building2, ClipboardCheck, Mail, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimateIn, AnimateInStagger } from "@/components/marketing/animate-in";

export const metadata = {
  title: "Contact — CarbonSite",
  description: "Plan a CarbonSite pilot around real project data.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <AnimateIn>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Pilot contact
            </p>
          </AnimateIn>
          <AnimateIn delay={0.1}>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Plan a CarbonSite pilot around real project data.
            </h1>
          </AnimateIn>
          <AnimateIn delay={0.2}>
            <p className="mt-6 text-lg leading-8 text-zinc-300">
              Bring one construction project, one reporting period, field evidence, supplier files,
              and postcode routes. CarbonSite proves the workflow with live tenant data.
            </p>
          </AnimateIn>
          <AnimateIn delay={0.3}>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="bg-emerald-500 text-white hover:bg-emerald-400">
                <a href="mailto:pilot@carbonsite.app?subject=CarbonSite%20pilot%20request">
                  <Mail className="mr-2 h-4 w-4" />
                  Email pilot team
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
                <Link href="/sign-up">
                  Create workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </AnimateIn>
        </div>
      </section>

      <section className="border-y border-zinc-800 bg-zinc-900/50 py-16">
        <div className="mx-auto max-w-7xl px-5">
          <AnimateIn>
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              What to prepare for a useful pilot.
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">
              The fastest pilot starts with actual operational records, not synthetic sample data.
            </p>
          </AnimateIn>
          <AnimateInStagger className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Building2,
                title: "Organisation setup",
                text: "Confirm tenant name, admins, reviewers, facilities, business units, and reporting periods.",
              },
              {
                icon: ClipboardCheck,
                title: "Data sources",
                text: "Bring supplier CSV or XLSX files, evidence PDFs or images, and field workers for mobile capture.",
              },
              {
                icon: MapPinned,
                title: "Route distance",
                text: "Identify pickup and delivery postcode pairs for haulage, waste collections, or site deliveries.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <Icon className="h-6 w-6 text-emerald-400" />
                <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
              </div>
            ))}
          </AnimateInStagger>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <AnimateIn>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8">
            <h2 className="text-base font-semibold text-white">Pilot scope template</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                ["Project", "One active UK construction project with a defined reporting period."],
                ["Users", "Admin, reviewer, auditor, and field-worker roles invited into the tenant."],
                ["Records", "Manual records, staged import rows, and mobile submissions approved into activity records."],
                ["Outputs", "Calculation run, published snapshot, report artefacts, evidence downloads, and audit trail."],
              ].map(([title, text]) => (
                <div key={title} className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimateIn>
      </section>
    </div>
  );
}
