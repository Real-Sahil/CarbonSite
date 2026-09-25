"use client";

import { useState } from "react";
import { SURVEY_MODES, SURVEY_MODE_KEYS, type SurveyMode } from "@/lib/commuting/attendance";

const VEHICLE: SurveyMode[] = ["car", "van", "bev", "motorbike"];

export function CommuteSurveyForm({ token, orgName }: { token: string; orgName: string }) {
  const [mode, setMode] = useState<SurveyMode | null>(null);
  const [occupancy, setOccupancy] = useState(1);
  const [workforce, setWorkforce] = useState<"own" | "subcontractor" | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!mode || !workforce) {
      setError("Answer each question.");
      return;
    }
    setState("sending");
    setError(null);
    const res = await fetch(`/api/public/commute/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, occupancy: VEHICLE.includes(mode) ? occupancy : 1, workforce }),
    });
    if (res.ok) {
      setState("done");
      return;
    }
    const body = await res.json().catch(() => null);
    setError(body?.message ?? "That did not send. Try again.");
    setState("idle");
  }

  if (state === "done") {
    return <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800">Thank you. Your answer is saved.</p>;
  }

  const option = "flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-100";
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-slate-900">1. How do you usually travel to this site?</legend>
        {SURVEY_MODE_KEYS.map((m) => (
          <label key={m} className={option}>
            <input type="radio" name="mode" id={`mode-${m}`} value={m} checked={mode === m} onChange={() => setMode(m)} />
            {SURVEY_MODES[m].label}
          </label>
        ))}
      </fieldset>

      {mode && VEHICLE.includes(mode) && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-slate-900">2. How many people are usually in the vehicle, including you?</legend>
          <select
            id="occupancy"
            value={occupancy}
            onChange={(e) => setOccupancy(Number(e.target.value))}
            className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n === 1 ? "Just me" : n === 6 ? "6 or more" : n}</option>
            ))}
          </select>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-slate-900">
          {mode && VEHICLE.includes(mode) ? "3." : "2."} Who employs you?
        </legend>
        <label className={option}>
          <input type="radio" name="workforce" id="workforce-own" checked={workforce === "own"} onChange={() => setWorkforce("own")} />
          {orgName}
        </label>
        <label className={option}>
          <input type="radio" name="workforce" id="workforce-sub" checked={workforce === "subcontractor"} onChange={() => setWorkforce("subcontractor")} />
          A subcontractor or agency
        </label>
      </fieldset>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {state === "sending" ? "Sending" : "Send"}
      </button>
    </form>
  );
}
