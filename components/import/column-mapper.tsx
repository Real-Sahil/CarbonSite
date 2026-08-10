"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, HelpCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CanonicalField, MappedColumn } from "@/lib/imports/column-mapper";

type Props = {
  headers: string[];
  previewRows: Record<string, string>[];
  initialMapping: {
    mapped: MappedColumn[];
    unmapped: string[];
    missingRequired: string[];
  };
  fields: CanonicalField[];
  onConfirm: (mapping: Record<string, string>) => void;
  onCancel: () => void;
  busy?: boolean;
};

const SKIP_VALUE = "__skip__";

export function ColumnMapper({ headers, previewRows, initialMapping, fields, onConfirm, onCancel, busy }: Props) {
  // user-editable mapping: sourceHeader → canonicalField (or SKIP_VALUE)
  const [userMapping, setUserMapping] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const { sourceHeader, canonicalField } of initialMapping.mapped) {
      m[sourceHeader] = canonicalField;
    }
    for (const header of initialMapping.unmapped) {
      m[header] = SKIP_VALUE;
    }
    return m;
  });

  const canonicalByHeader = useMemo(() => {
    const used = new Map<string, string>(); // canonical → sourceHeader
    for (const [src, canonical] of Object.entries(userMapping)) {
      if (canonical !== SKIP_VALUE) used.set(canonical, src);
    }
    return used;
  }, [userMapping]);

  function setMapping(sourceHeader: string, canonical: string) {
    setUserMapping((prev) => {
      const next = { ...prev };
      // Clear any other header that had this canonical (one-to-one constraint)
      if (canonical !== SKIP_VALUE) {
        for (const [src, can] of Object.entries(next)) {
          if (can === canonical && src !== sourceHeader) next[src] = SKIP_VALUE;
        }
      }
      next[sourceHeader] = canonical;
      return next;
    });
  }

  const missingRequired = fields
    .filter((f) => f.required)
    .filter((f) => !Object.values(userMapping).includes(f.canonical));

  const canProceed = missingRequired.length === 0;

  function handleConfirm() {
    const result: Record<string, string> = {};
    for (const [src, canonical] of Object.entries(userMapping)) {
      if (canonical !== SKIP_VALUE) result[src] = canonical;
    }
    onConfirm(result);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-[#111827] mb-1 tracking-[-0.42px]">
          Map your columns
        </h3>
        <p className="text-xs text-[#6B7280] leading-relaxed">
          We detected {initialMapping.mapped.length} of {headers.length} columns automatically.
          Review the mapping below and correct any mismatches before importing.
        </p>
      </div>

      {/* Missing required fields warning */}
      {missingRequired.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
          <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-800 mb-0.5">Required columns missing</p>
            <p className="text-xs text-amber-700">
              Assign a source column for: {missingRequired.map((f) => f.label).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Mapping table */}
      <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
        {/* Table header — hidden on mobile (stacked layout needs no header) */}
        <div className="hidden sm:grid grid-cols-[1fr_28px_1fr] gap-x-2 px-4 py-2.5 bg-[#F9FAFB] border-b border-[#E5E7EB]">
          <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wide">Your column</span>
          <span />
          <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wide">Maps to</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#F3F4F6]">
          {headers.map((header) => {
            const current = userMapping[header] ?? SKIP_VALUE;
            const isAutoDetected = initialMapping.mapped.some(
              (m) => m.sourceHeader === header && current !== SKIP_VALUE,
            );
            const field = fields.find((f) => f.canonical === current);
            const isRequired = field?.required ?? false;
            const isMapped = current !== SKIP_VALUE;
            const preview = previewRows[0]?.[header];

            return (
              <div key={header} className="px-4 py-3">
                {/* Mobile: stacked layout. Desktop: side-by-side grid. */}
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_20px_1fr] sm:gap-x-2 sm:items-center">
                  {/* Source column */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-[#111827] truncate">{header}</span>
                      {isAutoDetected && isMapped && (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    {preview != null && preview !== "" && (
                      <span className="text-[10px] text-[#9CA3AF] truncate block mt-0.5">
                        e.g. {String(preview).slice(0, 40)}
                      </span>
                    )}
                  </div>

                  {/* Arrow — hidden on mobile */}
                  <ChevronRight className="hidden sm:block h-3.5 w-3.5 text-[#D1D5DB] shrink-0" />

                  {/* Target field dropdown */}
                  <div className="min-w-0">
                    <Select value={current} onValueChange={(v) => setMapping(header, v)} disabled={busy}>
                      <SelectTrigger
                        className={[
                          "h-9 sm:h-7 text-xs w-full",
                          !isMapped
                            ? "border-[#E5E7EB] text-[#9CA3AF]"
                            : isRequired
                            ? "border-emerald-400 text-[#111827]"
                            : "border-[#D1D5DB] text-[#111827]",
                        ].join(" ")}
                      >
                        <SelectValue placeholder="Skip this column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP_VALUE}>
                          <span className="text-[#9CA3AF] italic">Skip this column</span>
                        </SelectItem>
                        {/* Required fields first */}
                        {fields
                          .filter((f) => f.required)
                          .map((f) => (
                            <SelectItem
                              key={f.canonical}
                              value={f.canonical}
                              disabled={
                                canonicalByHeader.has(f.canonical) && canonicalByHeader.get(f.canonical) !== header
                              }
                            >
                              <span className="flex items-center gap-1">
                                {f.label}
                                <span className="text-[10px] text-red-400 font-medium">required</span>
                              </span>
                            </SelectItem>
                          ))}
                        {/* Optional fields */}
                        {fields
                          .filter((f) => !f.required)
                          .map((f) => (
                            <SelectItem
                              key={f.canonical}
                              value={f.canonical}
                              disabled={
                                canonicalByHeader.has(f.canonical) && canonicalByHeader.get(f.canonical) !== header
                              }
                            >
                              {f.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {field && (
                      <span className="text-[10px] text-[#9CA3AF] mt-0.5 block truncate">
                        {field.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-[#9CA3AF]">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Auto-detected
        </span>
        <span className="flex items-center gap-1">
          <HelpCircle className="h-3 w-3 text-[#D1D5DB]" /> Manual override
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleConfirm} disabled={!canProceed || busy}>
          Proceed with import
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
