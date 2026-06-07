import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileText,
  MapPinned,
  ShieldCheck,
  Truck,
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
    <main className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Image src="/carbonsite-logo.svg" alt="CarbonSite" width={184} height={40} priority />
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">
                Start pilot
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
            UK construction carbon operations
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight text-slate-950 md:text-5xl">
            Materials, waste and haulage evidence in one audit-ready workspace.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            CarbonSite connects field submissions, postcode route distance,
            activity records, calculations, and reports for construction teams
            that need defensible emissions data.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Create organisation
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-in">Open workspace</Link>
            </Button>
          </div>
        </div>
        <div className="relative">
          <Image
            src="/carbonsite-site-operations.svg"
            alt="CarbonSite construction reporting workspace"
            width={960}
            height={620}
            priority
            className="rounded-2xl border border-slate-200 shadow-sm"
          />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-10 md:grid-cols-4">
          <Feature icon={Truck} title="Haulage routes" text="Pickup and delivery postcodes feed cached road-distance calculations." />
          <Feature icon={ClipboardCheck} title="Field evidence" text="Mobile submissions land in a reviewer queue before records are approved." />
          <Feature icon={BarChart3} title="Live aggregates" text="Dashboards read from calculation aggregates, not static demo metrics." />
          <Feature icon={FileText} title="Reports" text="PDF and CSV artefacts are generated from immutable published snapshots." />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-3">
        <Proof icon={MapPinned} title="Postcode distance built in" />
        <Proof icon={ShieldCheck} title="Organisation-scoped by design" />
        <Proof icon={ClipboardCheck} title="Audit logs on material actions" />
      </section>
    </main>
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
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <Icon className="h-5 w-5 text-green-700" />
      <h2 className="mt-4 text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function Proof({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
      <Icon className="h-5 w-5 text-green-700" />
      <p className="font-medium text-slate-800">{title}</p>
    </div>
  );
}
