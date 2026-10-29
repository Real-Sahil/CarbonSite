import Link from "next/link";
import { AlertTriangle, ArrowRight, Inbox, Target, Upload } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SOCIAL_PHASE_LABEL, SOCIAL_PHASE_ORDER, type SocialPhase } from "@/lib/dashboard/social-phase";

// Presentational half of the Executive Summary. Every sentence and figure arrives already formatted
// (lib/dashboard/narrative.ts and the organisation's formatters), so nothing here decides what is true.

export type SummaryViewProps = {
  orgId: string;
  isDemo: boolean;
  greeting: string;
  periodLabel: string | null;
  hasData: boolean;
  total: { value: string; unit: string; scopes: { label: string; value: string }[] };
  target: { line: string | null; hasTarget: boolean; actual: string | null; level: string | null; status: "ahead" | "on_track" | "behind" | null; partial: boolean };
  hotspot: { line: string | null; sharePct: number | null };
  social: { line: string | null; phase: SocialPhase };
  audit: { regimeLabel: string; satisfied: number; applicable: number; partial: number; gap: number; percent: number | null } | null;
  needsYou: { line: string | null; pendingSubmissions: number; openReviews: number };
  /** Analytics panels, rendered under the tiles when the period has data. */
  charts?: React.ReactNode;
};

const base = (orgId: string) => `/orgs/${orgId}`;

function Tile({ title, children, href, hrefLabel }: { title: string; children: React.ReactNode; href?: string; hrefLabel?: string }) {
  return (
    <section className="e-card flex flex-col gap-3 p-5" data-lift aria-label={title}>
      <h2 className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>{title}</h2>
      {children}
      {href && (
        <Link href={href} className="e-press mt-auto inline-flex min-h-11 items-center gap-1 text-sm font-medium" style={{ color: "var(--action)" }}>
          {hrefLabel}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

export function SummaryView(p: SummaryViewProps) {
  const root = base(p.orgId);
  // Official status only for a complete period; a running one is labelled year to date and never raised as an alert.
  const behind = p.target.status === "behind" && !p.target.partial;
  const statusWord = p.target.status === null ? null
    : p.target.partial ? "Year to date"
    : p.target.status === "behind" ? "Above the path" : p.target.status === "ahead" ? "Below the path" : "In line";
  const phaseAt = SOCIAL_PHASE_ORDER.indexOf(p.social.phase);

  return (
    <div className="earthy min-h-full px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2 max-md:order-1">
          {p.isDemo && (
            <span className="w-fit rounded-full px-3 py-1 text-xs font-medium" style={{ background: "var(--hi-bg)", color: "var(--hi)" }}>Demo data</span>
          )}
          <h1 className="e-serif max-w-3xl text-3xl leading-tight sm:text-4xl">{p.greeting}</h1>
        </header>

        {!p.hasData ? (
          <div className="e-card max-md:order-2">
            <EmptyState icon={Upload} title="No emissions recorded yet" description="Import activity data or add a record, then run a calculation. This page fills in from there.">
              <Link href={`${root}/imports`} className="e-press inline-flex min-h-11 items-center gap-1 text-sm font-medium" style={{ color: "var(--action)" }}>
                Go to Imports <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </EmptyState>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-6 max-md:order-3">
            <div className="md:col-span-3">
              <Tile title={`Total${p.periodLabel ? `, ${p.periodLabel}` : ""}`} href={`${root}/records`} hrefLabel="See the records">
                <p className="e-mono text-4xl font-medium">
                  {p.total.value} <span className="text-base" style={{ color: "var(--ink-3)" }}>{p.total.unit}</span>
                </p>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  {p.total.scopes.map((s) => (
                    <div key={s.label}>
                      <dt style={{ color: "var(--ink-3)" }}>{s.label}</dt>
                      <dd className="e-mono">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </Tile>
            </div>
            <div className="md:col-span-3">
              <Tile title="Target" href={`${root}/targets`} hrefLabel={p.target.hasTarget ? "Open targets" : "Set a target"}>
                {p.target.line ? (
                  <>
                    <p className="flex items-center gap-2 text-base">
                      {behind && <AlertTriangle className="size-4 shrink-0" style={{ color: "var(--neg)" }} aria-hidden="true" />}
                      <span style={behind ? { color: "var(--neg)" } : undefined}>
                        {statusWord ? <strong>{statusWord}. </strong> : null}
                        {p.target.line}
                      </span>
                    </p>
                    <p className="e-mono text-sm" style={{ color: "var(--ink-3)" }}>
                      {p.target.actual} recorded, target level {p.target.level}
                    </p>
                  </>
                ) : (
                  <p className="flex items-start gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
                    <Target className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {p.target.hasTarget
                      ? "A target exists but its baseline period has no data yet, so there is no glidepath to compare against."
                      : "No absolute target is set, so there is no glidepath to compare against."}
                  </p>
                )}
              </Tile>
            </div>
            <div className="md:col-span-2">
              <Tile title="Biggest source" href={`${root}/records`} hrefLabel="Open the records">
                {p.hotspot.line ? (
                  <>
                    <p className="text-base">{p.hotspot.line}</p>
                    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--sunk)" }} role="img" aria-label={`${Math.round(p.hotspot.sharePct ?? 0)} percent of the total`}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, p.hotspot.sharePct ?? 0))}%`, background: "var(--moss-500)" }} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: "var(--ink-2)" }}>No single source can be named yet.</p>
                )}
              </Tile>
            </div>
            <div className="md:col-span-2">
              <Tile title="Social" href={`${root}/social-value`} hrefLabel="Open social value">
                <p className="text-base">{p.social.line}</p>
                <ol className="flex gap-1" aria-label="Social data phases">
                  {SOCIAL_PHASE_ORDER.map((ph, i) => (
                    <li key={ph} className="h-1.5 flex-1 rounded-full" style={{ background: i <= phaseAt ? "var(--moss-500)" : "var(--sunk)" }} title={SOCIAL_PHASE_LABEL[ph]} />
                  ))}
                </ol>
              </Tile>
            </div>
            <div className="md:col-span-2">
              <Tile title="Audit" href={p.audit ? `${root}/compliance/crosswalk` : `${root}/settings/operations`} hrefLabel={p.audit ? "Open the crosswalk" : "Choose a disclosure regime"}>
                {p.audit && p.audit.percent != null ? (
                  <>
                    <p className="text-base">
                      {p.audit.satisfied} of {p.audit.applicable} {p.audit.regimeLabel} datapoints satisfied
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--sunk)" }} role="img" aria-label={`${Math.round(p.audit.percent)} percent ready`}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, p.audit.percent))}%`, background: "var(--moss-500)" }} />
                    </div>
                    <p className="text-sm" style={{ color: "var(--ink-2)" }}>{p.audit.partial} partial, {p.audit.gap} {p.audit.gap === 1 ? "gap" : "gaps"}.</p>
                  </>
                ) : p.audit ? (
                  <p className="text-sm" style={{ color: "var(--ink-2)" }}>No {p.audit.regimeLabel} datapoints are loaded, so there is no number to show.</p>
                ) : (
                  <p className="text-sm" style={{ color: "var(--ink-2)" }}>
                    Choose a disclosure regime in settings and readiness against its datapoints appears here.
                  </p>
                )}
              </Tile>
            </div>
          </div>
        )}

        {p.hasData && p.charts}

        <section className="e-card p-5 max-md:order-2" aria-label="Needs you">
          <h2 className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>Needs you</h2>
          {p.needsYou.line ? (
            <div className="mt-3 flex flex-col gap-1">
              <p className="text-base">{p.needsYou.line}</p>
              {p.needsYou.pendingSubmissions > 0 && (
                <Link href={`${root}/submissions`} className="e-press inline-flex min-h-11 items-center gap-2 text-sm font-medium" style={{ color: "var(--action)" }}>
                  <Inbox className="size-4" aria-hidden="true" />
                  {p.needsYou.pendingSubmissions} field {p.needsYou.pendingSubmissions === 1 ? "submission" : "submissions"} to review
                </Link>
              )}
              {p.needsYou.openReviews > 0 && (
                <Link href={`${root}/tasks`} className="e-press inline-flex min-h-11 items-center gap-2 text-sm font-medium" style={{ color: "var(--action)" }}>
                  <ArrowRight className="size-4" aria-hidden="true" />
                  {p.needsYou.openReviews} open {p.needsYou.openReviews === 1 ? "review task" : "review tasks"}
                </Link>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm" style={{ color: "var(--ink-2)" }}>Nothing is waiting on you.</p>
          )}
        </section>
      </div>
    </div>
  );
}
