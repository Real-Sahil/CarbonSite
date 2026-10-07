import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { resolveSubmissionToken } from "@/lib/evidence/submission-link";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Send documents", robots: { index: false, follow: false } };

/** No-login page for a subcontractor or supplier to send invoices, delivery notes and orders. */
export default async function SubmitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await resolveSubmissionToken(token);
  if (!link) {
    return (
      <main className="min-h-[100dvh] bg-slate-50 px-4 py-16">
        <p className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
          This upload link has expired or been withdrawn. Ask the main contractor for a new one.
        </p>
      </main>
    );
  }
  const [org, project] = await Promise.all([
    prisma.organization.findUnique({ where: { id: link.organizationId }, select: { name: true } }),
    link.projectId ? prisma.project.findFirst({ where: { id: link.projectId, organizationId: link.organizationId }, select: { name: true } }) : null,
  ]);
  return (
    <main className="min-h-[100dvh] bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-lg flex-col gap-5">
        <header className="flex flex-col gap-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{org?.name}</p>
          <h1 className="text-2xl font-bold text-slate-950">Send documents{project ? ` for ${project.name}` : ""}</h1>
          <p className="text-sm text-slate-600">
            {link.purpose === "waste_documents" ? "Upload waste transfer notes, carrier licences, site permits or exemptions as PDF or photo." : "Upload invoices, delivery notes, waste transfer notes or material orders as PDF or photo."} Up to 5 files at a time, 10 MB each. They go to the {org?.name} team to check; you do not need an account.
          </p>
        </header>
        <UploadForm token={token} purpose={link.purpose} />
        <p className="text-xs text-slate-500">
          Your name and company are kept with the files so the team knows who sent them. Do not include personal details of individuals beyond what a document needs.
        </p>
      </div>
    </main>
  );
}
