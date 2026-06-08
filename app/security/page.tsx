import Link from "next/link";
import { ArrowRight, Database, FileKey2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard, PageHero, PublicShell } from "@/components/public-site";

export default function SecurityPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Security and controls"
        title="Controls for a multi-tenant carbon system, not a prototype dashboard."
        text="CarbonSite separates tenants, validates storage keys, logs material actions, checks deployment health, and keeps signed evidence and report artefacts behind scoped access."
        image="/carbonsite-audit-pack.svg"
        imageAlt="CarbonSite audit package and evidence trail"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/contact">
              Review controls
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="bg-white">
            <Link href="/resources">Deployment resources</Link>
          </Button>
        </div>
      </PageHero>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FeatureCard icon={LockKeyhole} title="Tenant access" text="Organisation membership and roles gate app pages, APIs, evidence downloads, reports, and review actions." />
            <FeatureCard icon={FileKey2} title="Signed artefacts" text="Evidence, import files, error exports, and reports use tenant-scoped storage keys and signed URLs." />
            <FeatureCard icon={Database} title="Operational audit" text="Creation, review, import, evidence, calculation, report, target, and member actions are written to audit logs." />
            <FeatureCard icon={ShieldCheck} title="Deployment checks" text="Production health validates environment configuration and database reachability without exposing secret values." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">Security posture in the current architecture.</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            The production stack is Next.js on Vercel with Better Auth, Prisma Postgres, R2-compatible object storage, inline or worker job processing, and Flutter bearer sessions for field capture.
          </p>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Control title="RBAC roles" text="Admin, editor, reviewer, viewer, auditor, and field worker roles are enforced server-side for tenant-owned routes." />
          <Control title="Evidence policy" text="Upload MIME types, file sizes, storage key shape, signed URL expiry, and local path containment are validated." />
          <Control title="Job traceability" text="Calculation and report failures are written to audit logs so production failures are visible beyond server logs." />
          <Control title="Mobile auth" text="Field-worker invite acceptance creates a session token that the API accepts as a bearer token for scoped mobile calls." />
        </div>
      </section>
    </PublicShell>
  );
}

function Control({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}
