"use client";

// Form primitives shared by the method statement editor and the other
// sectioned documents built the same way (the guided Carbon Reduction Plan).
// One look for labels, inputs, check groups and the section navigator, so a
// person who has filled in a method statement already knows the layout.

import type { ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Stepper, StepperIndicator, StepperItem, StepperNav, StepperTitle, StepperTrigger } from "@/components/reui/stepper";
import { fieldClass } from "@/components/forms/form-kit";

// Same field and label look as the form kit (components/forms/form-kit.tsx).
export const inputCls = fieldClass;
export const labelCls = "block text-sm font-medium text-zinc-800 mb-1.5";
export const textareaCls = `${inputCls} resize-none`;

export function FieldRow({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelCls} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function CheckGroup({
  label,
  options,
  selected,
  onChange,
  disabled,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p className={labelCls}>
        {label} <span className="font-normal text-gray-400">(Select all that apply)</span>
      </p>
      <div className="grid grid-cols-2 gap-1 mt-1">
        {options.map((opt) => (
          <label
            key={opt}
            className={`flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1 hover:bg-gray-50 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-gray-800"
              checked={selected.includes(opt)}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.checked) onChange([...selected, opt]);
                else onChange(selected.filter((v) => v !== opt));
              }}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

/** A single yes/no confirmation, laid out like a CheckGroup option. */
export function CheckRow({ id, label, checked, onChange, disabled }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <label htmlFor={id} className={`flex items-start gap-2 text-sm rounded px-2 py-1.5 hover:bg-gray-50 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input id={id} type="checkbox" className="mt-0.5 h-3.5 w-3.5 accent-gray-800" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export type NavSection<K extends string> = { key: K; label: string; state?: "done" | "todo" | "optional" };

/** Left-hand section list, as in the method statement editor. */
export function SectionNav<K extends string>({
  sections,
  active,
  onSelect,
  open,
  onClose,
  footer,
}: {
  sections: readonly NavSection<K>[];
  active: K;
  onSelect: (k: K) => void;
  open: boolean;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <aside className={`${open ? "flex" : "hidden md:flex"} flex-col w-56 border-r border-gray-100 bg-white flex-shrink-0`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sections</span>
        <button className="md:hidden" onClick={onClose} aria-label="Close sections">
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <Stepper
          orientation="vertical"
          value={Math.max(0, sections.findIndex((x) => x.key === active)) + 1}
          onValueChange={(v) => {
            const target = sections[v - 1];
            if (target) {
              onSelect(target.key);
              onClose();
            }
          }}
          indicators={{ completed: <Check className="size-3.5" aria-hidden="true" /> }}
          className="px-2"
        >
          <StepperNav className="gap-0">
            {sections.map((s, i) => (
              <StepperItem key={s.key} step={i + 1} positional={false} completed={s.state === "done"} className="w-full not-last:flex-none">
                <StepperTrigger
                  aria-current={active === s.key ? "step" : undefined}
                  aria-controls={undefined}
                  className={`w-full justify-start rounded-md px-2 py-2 text-left text-sm transition-colors ${active === s.key ? "bg-gray-100 font-medium text-gray-900" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  <StepperIndicator
                    className={`size-5 text-[10px] font-semibold ${
                      s.state === "done"
                        ? "bg-emerald-100 text-emerald-800 data-[state=completed]:bg-emerald-100 data-[state=completed]:text-emerald-800 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-800"
                        : s.state === "optional"
                          ? "bg-gray-100 text-gray-500 data-[state=active]:bg-gray-200 data-[state=active]:text-gray-700 data-[state=completed]:bg-gray-100 data-[state=completed]:text-gray-500"
                          : "bg-amber-100 text-amber-800 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800 data-[state=completed]:bg-amber-100 data-[state=completed]:text-amber-800"
                    }`}
                  >
                    {i + 1}
                  </StepperIndicator>
                  <StepperTitle className="flex-1 text-sm font-normal leading-snug group-data-[state=active]/step:font-medium">{s.label}</StepperTitle>
                  {s.state ? <span className="sr-only">{s.state === "done" ? "complete" : s.state === "optional" ? "optional" : "needs attention"}</span> : null}
                </StepperTrigger>
              </StepperItem>
            ))}
          </StepperNav>
        </Stepper>
      </div>
      {footer ? <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">{footer}</div> : null}
    </aside>
  );
}

/** Back / next bar at the foot of a sectioned document. */
export function SectionPager<K extends string>({
  sections,
  active,
  onSelect,
  children,
}: {
  sections: readonly NavSection<K>[];
  active: K;
  onSelect: (k: K) => void;
  children?: ReactNode;
}) {
  const idx = sections.findIndex((s) => s.key === active);
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-white flex-shrink-0">
      <button
        disabled={idx <= 0}
        onClick={() => onSelect(sections[idx - 1]!.key)}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <div className="flex items-center gap-2">{children}</div>
      <button
        disabled={idx >= sections.length - 1}
        onClick={() => onSelect(sections[idx + 1]!.key)}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
