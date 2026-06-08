import Link from "next/link";
import { ArrowRight, BookOpen, FileSpreadsheet, ServerCog, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard, PageHero, PublicShell } from "@/components/public-site";

const resources = [
  {
    href: "/resources#deployment",
    icon: ServerCog,
    title: "Vercel deployment",
    text: "Required env vars, health checks, inline job mode, and worker runtime notes.",
  },
  {
    href: "/resources#mobile",
    icon: Smartphone,
    title: "Flutter field app",
    text: "Invite onboarding, production API base URL, offline queue, OCR, GPS, and evidence upload.",
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
        title="Implementation notes for teams preparing a production pilot."
        text="Use these pages to understand the deployment, mobile capture, factor import, and reporting workflows already wired into CarbonSite."
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
          <ResourceBlock id="deployment" title="Deployment readiness" icon={ServerCog}>
            CarbonSite deploys to Vercel with managed Postgres, object storage, Better Auth, transactional email, route distance providers, and inline job mode unless a separate worker is running. The `/api/health` route checks environment configuration and database reachability after deployment.
          </ResourceBlock>
          <ResourceBlock id="mobile" title="Field capture app" icon={Smartphone}>
            The Flutter app accepts field-worker invites, stores session tokens securely, uploads evidence through signed URLs, queues submissions offline, and posts reviewed form data, OCR fields, GPS, pickup postcode, and delivery postcode to the backend.
          </ResourceBlock>
          <ResourceBlock id="factors" title="Emission factor import" icon={FileSpreadsheet}>
            Admins and editors can import factor rows into approved libraries from CSV or XLSX files. Required columns are scope and input_unit, plus at least one factor value from co2e, co2, ch4, or n2o.
          </ResourceBlock>
          <ResourceBlock id="reporting" title="Reports and audit packages" icon={BookOpen}>
            Published snapshots generate PDF and CSV artefacts with report metadata, aggregate totals, data quality, assumptions, and calculation appendices. Downloads use signed links and are audited.
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
