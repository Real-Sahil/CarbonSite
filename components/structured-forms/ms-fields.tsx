"use client";

// Form primitives shared by the method statement editor and the other
// sectioned documents built the same way (the guided Carbon Reduction Plan).
// One look for labels, inputs, check groups and the section navigator, so a
// person who has filled in a method statement already knows the layout.

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export const inputCls =
  "w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 disabled:opacity-50 disabled:bg-gray-50";
export const labelCls = "block text-xs font-medium text-gray-600 mb-1";
export const textareaCls = `${inputCls} resize-none`;

export function FieldRow({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelCls} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
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
      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((s, i) => (
          <button
            key={s.key}
            onClick={() => {
              onSelect(s.key);
              onClose();
            }}
            aria-current={active === s.key ? "step" : undefined}
            className={`w-full flex items-center gap-2 text-left px-4 py-2 text-sm transition-colors ${active === s.key ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
          >
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                s.state === "done" ? "bg-green-100 text-green-800" : s.state === "optional" ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-800"
              }`}
            >
              {s.state === "done" ? "✓" : i + 1}
            </span>
            <span className="flex-1">{s.label}</span>
            {s.state ? <span className="sr-only">{s.state === "done" ? "complete" : s.state === "optional" ? "optional" : "needs attention"}</span> : null}
          </button>
        ))}
      </nav>
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
