"use client";

import { useId, useState, type ReactNode } from "react";

export type TableView = { columns: string[]; rows: (string | number)[][] };

/**
 * The shell every kit chart sits in: a titled figure with a Chart / Table
 * switch. The table carries the same numbers as the drawing, so the data is
 * readable without sight, without a pointer and when the drawing is too busy.
 */
export function ChartFrame({
  title,
  description,
  table,
  footnote,
  children,
}: {
  title: string;
  description?: string;
  table: TableView;
  footnote?: string;
  children: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const id = useId();
  const tab = (value: "chart" | "table", label: string) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => setView(value)}
      className={`rounded-full px-3 py-1 text-xs transition-colors ${
        view === value ? "bg-[#111827] text-white" : "border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"
      }`}
    >
      {label}
    </button>
  );
  return (
    <figure className="m-0 rounded-[14px] border border-[#E5E7EB] bg-white p-5" aria-labelledby={`${id}-title`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`${id}-title`} className="text-sm font-medium text-[#111827]">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-[#6B7280]">{description}</p> : null}
        </div>
        <div className="flex gap-1.5" role="group" aria-label={`${title}: view`}>
          {tab("chart", "Chart")}
          {tab("table", "Table")}
        </div>
      </div>
      {view === "chart" ? (
        children
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[#6B7280]">
                {table.columns.map((c, i) => (
                  <th key={c} scope="col" className={`py-1.5 pr-3 font-medium ${i > 0 ? "text-right" : ""}`}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, r) => (
                <tr key={r} className="border-b border-[#F3F4F6] text-[#111827]">
                  {row.map((cell, i) => (
                    <td key={i} className={`py-1.5 pr-3 tabular-nums ${i > 0 ? "text-right" : ""}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footnote ? <figcaption className="mt-3 text-xs text-[#6B7280]">{footnote}</figcaption> : null}
    </figure>
  );
}
