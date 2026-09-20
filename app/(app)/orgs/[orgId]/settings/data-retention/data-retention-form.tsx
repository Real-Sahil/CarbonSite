"use client";

import { useState, useTransition } from "react";

type Props = {
  orgId: string;
  current: number | null;
};

const PRESET_OPTIONS = [
  { label: "2 years (730 days)", value: 730 },
  { label: "3 years (1095 days)", value: 1095 },
  { label: "6 years (2190 days) — UK Companies Act minimum", value: 2190 },
  { label: "7 years (2555 days) — UK GDPR GHG recommended", value: 2555 },
  { label: "10 years (3650 days)", value: 3650 },
];

export function DataRetentionForm({ orgId, current }: Props) {
  const [mode, setMode] = useState<"forever" | "custom">(
    current === null ? "forever" : "custom",
  );
  const [days, setDays] = useState<string>(current !== null ? String(current) : "2555");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleModeChange(next: "forever" | "custom") {
    setMode(next);
    setSaved(false);
    setError(null);
  }

  function handlePreset(value: number) {
    setDays(String(value));
    setSaved(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);

    const payload =
      mode === "forever"
        ? { evidenceRetentionDays: null }
        : { evidenceRetentionDays: parseInt(days, 10) };

    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/settings/data-retention`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (res.ok) {
        setSaved(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to save retention policy.");
      }
    });
  }

  const numDays = parseInt(days, 10);
  const daysValid =
    mode === "forever" || (!isNaN(numDays) && numDays >= 90 && numDays <= 3650);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Mode toggle */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[#111827]">Retention period</legend>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="mode"
            value="forever"
            checked={mode === "forever"}
            onChange={() => handleModeChange("forever")}
            className="mt-0.5 accent-[#f97316]"
          />
          <div>
            <span className="text-sm font-medium text-[#111827]">Keep forever</span>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Files are never automatically deleted. Recommended default.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="mode"
            value="custom"
            checked={mode === "custom"}
            onChange={() => handleModeChange("custom")}
            className="mt-0.5 accent-[#f97316]"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-[#111827]">
              Delete after a set number of days
            </span>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Minimum 90 days. Maximum 3650 days (10 years).
            </p>
          </div>
        </label>
      </fieldset>

      {/* Custom days controls */}
      {mode === "custom" && (
        <div className="ml-6 space-y-3">
          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            {PRESET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handlePreset(opt.value)}
                className={`rounded-full px-3 py-1 text-xs transition-colors border ${
                  days === String(opt.value)
                    ? "bg-[#f97316] text-white border-[#f97316]"
                    : "border-[#E5E7EB] text-[#374151] hover:border-[#BAE6FD] hover:bg-[#fff7ed]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Manual input */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={90}
              max={3650}
              value={days}
              onChange={(e) => {
                setDays(e.target.value);
                setSaved(false);
                setError(null);
              }}
              className="w-24 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm text-[#111827] focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
            />
            <span className="text-sm text-[#6B7280]">days</span>
            {days && !isNaN(numDays) && numDays >= 90 && (
              <span className="text-xs text-[#6B7280]">
                (~{(numDays / 365).toFixed(1)} years)
              </span>
            )}
          </div>

          {days && !isNaN(numDays) && (numDays < 90 || numDays > 3650) && (
            <p className="text-xs text-red-600">
              Must be between 90 and 3650 days.
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending || !daysValid}
          className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white hover:bg-[#1f2937] transition-colors disabled:opacity-40"
        >
          {isPending ? "Saving..." : "Save policy"}
        </button>

        {saved && (
          <p className="text-sm text-green-700 font-medium">
            Retention policy saved.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}
