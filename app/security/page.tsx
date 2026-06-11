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
        text="CarbonSite separates organisation data, controls access by role, records material actions, and protects evidence and report artefacts behind scoped access."
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
            <Link href="/resources">Read resources</Link>
          </Button>
        </div>
      </PageHero>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FeatureCard icon={LockKeyhole} title="Tenant access" text="Organisation membership and roles gate workspace pages, evidence downloads, reports, and review actions." />
            <FeatureCard icon={FileKey2} title="Protected artefacts" text="Evidence, import files, error exports, and reports remain scoped to the organisation that owns them." />
            <FeatureCard icon={Database} title="Operational audit" text="Creation, review, import, evidence, calculation, report, target, and member actions are written to audit logs." />
            <FeatureCard icon={ShieldCheck} title="Readiness checks" text="Production readiness checks confirm critical services are reachable without exposing secret values publicly." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">Security posture for operational carbon data.</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            The platform is designed around least-privilege access, tenant isolation, evidence governance, auditability, and production monitoring without exposing internal implementation details.
          </p>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Control title="Role-based access" text="Admin, editor, reviewer, viewer, auditor, and field worker permissions are enforced across tenant-owned workflows." />
          <Control title="Evidence policy" text="File type, file size, evidence ownership, and access expiry are controlled before artefacts are accepted or shared." />
          <Control title="Job traceability" text="Import, calculation, report, and review outcomes are written to audit history for operational follow-up." />
          <Control title="Field access" text="Field-worker access is scoped to the invited organisation and the evidence submission workflow." />
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
