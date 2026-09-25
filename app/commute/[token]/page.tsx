import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { CommuteSurveyForm } from "./survey-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Travel to site", robots: { index: false, follow: false } };

interface PageProps {
  params: Promise<{ token: string }>;
}

/** Anonymous travel survey for one site, opened from a link or QR code. */
export default async function CommuteSurveyPage({ params }: PageProps) {
  const { token } = await params;
  const survey = await prisma.commuteSurvey.findUnique({
    where: { token },
    select: { isOpen: true, site: { select: { name: true } }, organization: { select: { name: true } } },
  });
  if (!survey) notFound();

  return (
    <main className="min-h-[100dvh] bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{survey.organization.name}</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">How do you get to {survey.site.name}?</h1>
          <p className="mt-2 text-sm text-slate-600">
            Three quick questions about your usual journey to this site. We do not ask your name, and nothing you
            answer identifies you. The answers work out the site&apos;s travel emissions.
          </p>
        </div>
        {survey.isOpen ? (
          <CommuteSurveyForm token={token} orgName={survey.organization.name} />
        ) : (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">This survey has closed. Thank you.</p>
        )}
      </div>
    </main>
  );
}
