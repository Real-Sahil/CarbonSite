import type { ReactNode } from "react";
import { CircleAlert, CircleHelp, ShieldAlert, ShieldCheck, ShieldX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "ok" | "warn" | "bad" | "idle";

// Tone carries meaning in the icon and the words as well as the colour, so it never depends on colour alone.
const TONES: Record<Tone, { icon: LucideIcon; ring: string; chip: string; tile: string }> = {
  ok: { icon: ShieldCheck, ring: "border-emerald-200", chip: "bg-emerald-50 text-emerald-800", tile: "bg-emerald-100 text-emerald-700" },
  warn: { icon: ShieldAlert, ring: "border-amber-200", chip: "bg-amber-50 text-amber-900", tile: "bg-amber-100 text-amber-700" },
  bad: { icon: ShieldX, ring: "border-red-200", chip: "bg-red-50 text-red-800", tile: "bg-red-100 text-red-700" },
  idle: { icon: CircleHelp, ring: "border-slate-200", chip: "bg-slate-100 text-slate-700", tile: "bg-slate-100 text-slate-600" },
};

/**
 * One look-up result from a public register: a status line, the facts as a small list, a plain note on what a
 * person still has to check, and the licence line the register requires.
 */
export function RegisterResultCard({ tone, title, subtitle, facts, children, attribution }: {
  tone: Tone;
  title: string;
  subtitle?: string;
  facts?: { label: string; value: ReactNode }[];
  children?: ReactNode;
  attribution?: string;
}) {
  const t = TONES[tone];
  const Icon = tone === "idle" && !facts ? CircleAlert : t.icon;
  return (
    <section aria-label={title} className={cn("overflow-hidden rounded-xl border bg-white text-xs text-slate-700 shadow-sm", t.ring)}>
      <div className="flex items-start gap-3 p-3">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", t.tile)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", t.chip)}>{title}</span>
            {subtitle && <span className="truncate text-slate-500">{subtitle}</span>}
          </p>
          {facts && facts.length > 0 && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {facts.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-slate-500">{f.label}</dt>
                  <dd className="font-medium text-slate-900">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {children && <div className="mt-2 leading-relaxed text-slate-600">{children}</div>}
        </div>
      </div>
      {attribution && <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">{attribution}</p>}
    </section>
  );
}
