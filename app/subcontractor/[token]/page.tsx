import type { Metadata } from "next";
import { portalView, resolveSubcontractorToken } from "@/lib/subcontractor/portal";
import { SubcontractorForm } from "./subcontractor-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Send carbon figures", robots: { index: false, follow: false } };

/** No-login page for a subcontractor to send the tonnes CO2e a main contractor has asked for. */
export default async function SubcontractorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await resolveSubcontractorToken(token);
  if (!row) {
    return (
      <main className="min-h-[100dvh] bg-[#F9FAFC] px-4 py-16">
        <p className="mx-auto max-w-lg rounded-lg border border-[#E3E8EE] bg-white p-5 text-sm text-[#41505F]">
          This link has expired or been withdrawn. Ask the main contractor for a new one.
        </p>
      </main>
    );
  }

  const view = portalView(row, row.organization.name);
  const due = dayLabel(`${view.dueDate}T00:00:00Z`);
  const expires = dayLabel(view.linkExpiresAt);

  return (
    <main className="min-h-[100dvh] bg-[#F9FAFC] px-4 py-10">
      <div className="mx-auto flex max-w-lg flex-col gap-5">
        <header className="flex flex-col gap-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#5B6A78]">{view.orgName}</p>
          <h1 className="text-2xl text-[#131d29]">Carbon figures for {view.reportingPeriodLabel}</h1>
          <p className="text-sm text-[#41505F]">
            {view.orgName} needs the emissions from the work you carry out for them, in tonnes CO2e by scope. Send them by {due}.
            No account is needed.
          </p>
        </header>
        <SubcontractorForm token={token} view={view} />
        <p className="text-xs text-[#5B6A78]">
          Keep this link private. It opens this one form and expires on {expires}.
        </p>
      </div>
    </main>
  );
}

function dayLabel(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "";
}
