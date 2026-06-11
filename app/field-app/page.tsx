import Link from "next/link";
import {
  ArrowRight,
  Camera,
  ClipboardCheck,
  MapPinned,
  ScanLine,
  Signal,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard, PageHero, PublicShell } from "@/components/public-site";

export default function FieldAppPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Field app"
        title="Evidence capture for site teams, subcontractors, and mobile reviewers."
        text="CarbonSite helps field workers capture tickets, receipts, delivery notes, route postcodes, GPS context, and reviewed quantities before evidence becomes an approved activity record."
        image="/carbonsite-field-capture.svg"
        imageAlt="CarbonSite field evidence capture screens"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/contact">
              Plan field rollout
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="bg-white">
            <Link href="/resources#field-evidence">Evidence checklist</Link>
          </Button>
        </div>
      </PageHero>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
              Capture first, review before it reaches reporting.
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              The field workflow is designed for real project conditions: low signal, fragmented paperwork, subcontractor access, and reviewer checks before records are approved.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FeatureCard icon={Camera} title="Document image" text="Attach photos or files for waste tickets, delivery notes, receipts, and other evidence." />
            <FeatureCard icon={ScanLine} title="Text extraction" text="Extract useful fields from captured documents so reviewers start with structured context." />
            <FeatureCard icon={Signal} title="Offline queue" text="Keep submissions on device until connectivity returns, then sync them into the review queue." />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">What the field team captures.</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Submissions carry the fields that reviewers need to approve evidence into the same activity record model used by imports and manual entries.
          </p>
        </div>
        <div className="grid gap-3">
          <WorkflowRow icon={ClipboardCheck} title="Activity details" text="Document type, date, supplier or carrier, amount, unit, and reviewer notes." />
          <WorkflowRow icon={MapPinned} title="Route context" text="Pickup and delivery postcodes for waste, haulage, and material movement records." />
          <WorkflowRow icon={UploadCloud} title="Evidence trail" text="Uploaded evidence is linked to the submission and follows the approval decision into audit history." />
        </div>
      </section>
    </PublicShell>
  );
}

function WorkflowRow({
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
