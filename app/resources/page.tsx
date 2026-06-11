import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardCheck, FileSpreadsheet, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard, PageHero, PublicShell } from "@/components/public-site";

const resources = [
  {
    href: "/resources#pilot",
    icon: HardHat,
    title: "Pilot readiness",
    text: "How to choose a first project, reporting period, site team, and evidence scope.",
  },
  {
    href: "/resources#field-evidence",
    icon: ClipboardCheck,
    title: "Field evidence",
    text: "What site teams should capture for waste tickets, deliveries, fuel receipts, and haulage trips.",
  },
  {
    href: "/resources#factors",
    icon: FileSpreadsheet,
    title: "Factor import",
    text: "CSV and XLSX columns for governed factor row imports into approved libraries.",
  },
];

export default function ResourcesPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Resources"
        title="Practical resources for construction carbon operations."
        text="Use these guides to plan the first project, align evidence standards, prepare supplier files, and understand what reviewers need before reports are issued."
        image="/carbonsite-audit-pack.svg"
        imageAlt="CarbonSite report artefact and audit package media"
      >
        <Button asChild size="lg">
          <Link href="/contact">
            Plan pilot setup
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </PageHero>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="grid gap-4 md:grid-cols-3">
            {resources.map((resource) => (
              <Link key={resource.href} href={resource.href} className="group">
                <FeatureCard icon={resource.icon} title={resource.title} text={resource.text} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid gap-5">
          <ResourceBlock id="pilot" title="Pilot readiness" icon={HardHat}>
            Start with one live project, one reporting period, named reviewers, and a clear evidence scope. The strongest pilots include supplier files, field-captured tickets, haulage postcodes, and a defined approval process.
          </ResourceBlock>
          <ResourceBlock id="field-evidence" title="Field evidence" icon={ClipboardCheck}>
            Field teams should capture the document image, supplier or carrier name, activity date, quantity, unit, project location, pickup postcode, delivery postcode, and any notes needed by the reviewer.
          </ResourceBlock>
          <ResourceBlock id="factors" title="Emission factor import" icon={FileSpreadsheet}>
            Keep factor libraries governed and versioned. Before running calculations, confirm the selected methodology, activity categories, units, geography, and factor source are approved for the reporting period.
          </ResourceBlock>
          <ResourceBlock id="reporting" title="Reports and audit packages" icon={BookOpen}>
            Report packs should include totals, data quality, assumptions, evidence status, methodology, factor library version, and a calculation appendix that reviewers can trace back to source records.
          </ResourceBlock>
        </div>
      </section>
    </PublicShell>
  );
}

function ResourceBlock({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <article id={id} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-[48px_1fr]">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50 text-green-800">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{children}</p>
      </div>
    </article>
  );
}
