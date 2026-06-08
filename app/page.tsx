import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ClipboardCheck,
  Factory,
  FileCheck2,
  MapPinned,
  ShieldCheck,
  Truck,
  UploadCloud,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";

export default async function RootPage() {
  const session = await getSession();

  if (session) {
    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true },
    });

    redirect(membership ? `/orgs/${membership.organizationId}/dashboard` : "/orgs/new");
  }

  return (
    <main className="min-h-[100dvh] bg-[#f7f9f4] text-slate-950">
      <header className="border-b border-slate-200 bg-[#f7f9f4]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" aria-label="CarbonSite home" className="shrink-0">
            <Image src="/carbonsite-logo.svg" alt="CarbonSite" width={184} height={40} priority />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <Link href="#product" className="hover:text-slate-950">
              Product
            </Link>
            <Link href="#workflows" className="hover:text-slate-950">
              Workflows
            </Link>
            <Link href="#compliance" className="hover:text-slate-950">
              Compliance
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">
                Start pilot
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-green-800">
            UK construction carbon operations
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight text-slate-950 md:text-6xl">
            Audit-ready carbon data from site activity, not spreadsheets after the fact.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            CarbonSite connects field evidence, postcode route distance, activity records,
            calculation runs, and board-ready reports for construction teams.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Create organisation
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-white">
              <Link href="/sign-in">Open workspace</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <HeroProof icon={Truck} label="Materials and haulage" />
            <HeroProof icon={UploadCloud} label="Field evidence capture" />
            <HeroProof icon={FileCheck2} label="Snapshot reports" />
          </div>
        </div>
        <div className="relative">
          <div className="absolute -left-4 top-8 hidden w-28 rounded-lg border border-green-200 bg-white p-3 shadow-sm lg:block">
            <p className="text-xs font-semibold text-green-800">Route check</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Pickup and delivery postcodes feed cached road distance.</p>
          </div>
          <Image
            src="/carbonsite-site-operations.svg"
            alt="CarbonSite construction reporting workspace"
            width={960}
            height={620}
            priority
            className="rounded-xl border border-slate-200 bg-white shadow-sm"
          />
        </div>
      </section>

      <section id="product" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-950 md:text-3xl">
              A workspace for the operational mess behind carbon reporting.
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Materials, waste tickets, fuel receipts, delivery notes, and subcontractor data
              move through review before becoming auditable emissions records.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Feature
              icon={ClipboardCheck}
              title="Review before approval"
              text="Field submissions land in a triage queue with reviewer assignment, evidence, and comments."
            />
            <Feature
              icon={MapPinned}
              title="Distance with provenance"
              text="Pickup and delivery postcodes resolve to cached route distance with override reasons."
            />
            <Feature
              icon={BarChart3}
              title="Calculated aggregates"
              text="Dashboards read from calculation aggregates and published snapshots, not demo totals."
            />
            <Feature
              icon={ShieldCheck}
              title="Tenant-scoped control"
              text="Every operational record, task, invite, evidence file, and report is organisation scoped."
            />
          </div>
        </div>
      </section>

      <section id="workflows" className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 md:text-3xl">
            Built around construction site workflows.
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            The product shape follows how data enters a project: from supplier files,
            mobile field submissions, manual corrections, and evidence attachments.
          </p>
        </div>
        <div className="grid gap-3">
          <WorkflowStep icon={Factory} title="Materials delivered" text="Record concrete, aggregate, steel, fuel, or other supplier activity against a reporting period." />
          <WorkflowStep icon={Truck} title="Waste and haulage moved" text="Capture trips, weights, transfer notes, route distance, supplier names, and evidence files." />
          <WorkflowStep icon={BadgeCheck} title="Reviewed and calculated" text="Approve records, run calculation jobs, publish snapshots, and generate PDF or CSV artefacts." />
        </div>
      </section>

      <section id="compliance" className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-2xl font-bold text-slate-950 md:text-3xl">
              Production controls where trust matters.
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              CarbonSite is being wired as a multi-tenant system with audited actions,
              role-based access, rate limits, evidence validation, and worker-backed jobs.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Control label="Role-based access" />
            <Control label="Audit log coverage" />
            <Control label="Evidence type validation" />
            <Control label="Report checksum storage" />
            <Control label="Transactional emails" />
            <Control label="Review task queue" />
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#f7f9f4]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between">
          <Image src="/carbonsite-logo.svg" alt="CarbonSite" width={158} height={34} />
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <Link href="#product" className="hover:text-slate-950">Product</Link>
            <Link href="#workflows" className="hover:text-slate-950">Workflows</Link>
            <Link href="#compliance" className="hover:text-slate-950">Compliance</Link>
            <Link href="/sign-in" className="hover:text-slate-950">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function HeroProof({
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

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-[#fbfcf8] p-5">
      <Icon className="h-5 w-5 text-green-800" />
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function WorkflowStep({
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
        <h3 className="font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function Control({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-[#fbfcf8] p-4">
      <ShieldCheck className="h-4 w-4 text-green-800" />
      <span className="text-sm font-medium text-slate-800">{label}</span>
    </div>
  );
}
