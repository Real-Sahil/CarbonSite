import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * One layout language for portal forms: sections with a heading and a one-line
 * purpose, labels above, hint and error below, optional fields folded away and
 * a single action bar. Fields flow in a four-column grid that collapses to one
 * column on a phone, so no form needs its own grid template.
 */

const SPAN: Record<1 | 2 | 3 | 4, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-2 lg:col-span-3",
  4: "sm:col-span-2 lg:col-span-4",
};

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className={cn("space-y-3", className)}>
      <header>
        <h3 id={id} className="text-sm font-semibold text-zinc-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </header>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  optional,
  span = 1,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  /** Mark a field the person may leave empty. Required is the default and is not labelled. */
  optional?: boolean;
  /** Columns taken on a wide screen (1 to 4); a phone always gets the full row. */
  span?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}) {
  const hintId = `${htmlFor}-hint`;
  const errorId = `${htmlFor}-error`;
  return (
    <div className={cn("min-w-0 space-y-1.5", SPAN[span])}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-sm font-medium text-zinc-800">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-zinc-500">Optional</span>}
      </label>
      {children}
      {hint && !error && <p id={hintId} className="text-xs text-zinc-500">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** Fields the person rarely needs, folded under a native disclosure (keyboard and screen reader friendly). */
export function FormDisclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-md border border-zinc-200 bg-zinc-50/60 open:bg-white">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-zinc-700 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="mr-2 inline-block text-zinc-400 transition-transform group-open:rotate-90" aria-hidden="true">›</span>
        {title}
      </summary>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 border-t border-zinc-200 p-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </details>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{children}</p>;
}

/** The only place a form's buttons live: primary last, destructive apart on the left. */
export function FormActions({ children, start }: { children: React.ReactNode; start?: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex">{start}</div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">{children}</div>
    </div>
  );
}
