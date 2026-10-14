"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { formatTonnesValue, scopeColor } from "@/components/charts/palette";
import { ProductFrame } from "@/components/marketing/kit";

// Figures from the demo tenant (Northgate Civils Ltd, fictional), FY2025
// calculation run of 24 September 2026, as shown on its dashboard and analytics
// pages (public/marketing/screens/dashboard.jpg, analytics.jpg). kg CO2e, as
// the platform stores them. Nothing here is estimated: re-read these from the
// demo tenant whenever the screenshots are recaptured.
const SCOPES = [
  { scope: 1, label: "Scope 1", value: 910_563.84 },
  { scope: 2, label: "Scope 2", value: 154_636.97 },
  { scope: 3, label: "Scope 3", value: 3_644_852.29 },
];
const TOTAL_KG = 4_710_053.1;
const PERIOD_CHANGE = "−12.2%";
const CALCULATED_RECORDS = 83;

/** The seven largest categories; together 4,706.44 of the 4,710.05 tonnes. */
const CATEGORIES = [
  { name: "Purchased goods and services", scope: 3, value: 3_593_074.4 },
  { name: "Mobile combustion", scope: 1, value: 691_496.7 },
  { name: "Stationary combustion", scope: 1, value: 215_457.6 },
  { name: "Purchased electricity", scope: 2, value: 154_637.0 },
  { name: "Employee commuting", scope: 3, value: 36_728.1 },
  { name: "Business travel", scope: 3, value: 9_904.9 },
  { name: "Waste", scope: 3, value: 5_144.9 },
];

/** True once the element has been on screen, so the bars grow while someone is looking. */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
}

function CountUp({ to, run, reduce }: { to: number; run: boolean; reduce: boolean }) {
  const [value, setValue] = useState(to);
  // Layout effect: the count resets to 0 before paint, so the full total does not flash.
  useLayoutEffect(() => {
    if (!run || reduce) {
      setValue(to);
      return;
    }
    setValue(0);
    const start = performance.now();
    const duration = 1400;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, reduce, to]);
  return <>{formatTonnesValue(value)}</>;
}

const MAX_CATEGORY = Math.max(...CATEGORIES.map((c) => c.value));
const GROW = "transition-[width] duration-[900ms] ease-out motion-reduce:transition-none";

const SCOPE_SHARES = SCOPES.map((s) => (s.value / TOTAL_KG) * 100);
const SCOPE_STARTS = SCOPE_SHARES.map((_, i) => SCOPE_SHARES.slice(0, i).reduce((sum, share) => sum + share, 0));
/** Gap between arcs, in percent of the ring, so the joins read as separate segments. */
const RING_GAP = 0.6;

/** The scope split as a ring. Each arc draws in after the one before it; the table beside it carries the figures. */
function Doughnut({ seen }: { seen: boolean }) {
  return (
    <div aria-hidden="true" className="relative size-20 shrink-0">
      <svg viewBox="0 0 120 120" className="-rotate-90">
        {SCOPES.map((s, i) => (
          <circle
            key={s.scope}
            cx="60"
            cy="60"
            r="48"
            pathLength={100}
            fill="none"
            strokeWidth="14"
            stroke={scopeColor(s.scope)}
            className="transition-[stroke-dasharray] duration-[900ms] ease-out motion-reduce:transition-none"
            style={{
              strokeDasharray: seen ? `${SCOPE_SHARES[i] - RING_GAP} ${100 - SCOPE_SHARES[i] + RING_GAP}` : "0 100",
              strokeDashoffset: `${-(SCOPE_STARTS[i] + RING_GAP / 2)}`,
              transitionDelay: `${i * 250}ms`,
            }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[14px] font-semibold leading-none text-mk-text tabular-nums">{SCOPE_SHARES[2].toFixed(1)}%</p>
          <p className="mt-1 text-[11px] text-mk-text-3">{SCOPES[2].label}</p>
        </div>
      </div>
    </div>
  );
}

export function DemoAnalytics() {
  const reduce = useReducedMotion() ?? false;
  const { ref, seen } = useSeen<HTMLDivElement>();

  return (
    <ProductFrame>
      <div ref={ref} className="grid gap-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-mk-text-3">Total footprint, Scopes 1-3</p>
            <p className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.03em] text-mk-text tabular-nums sm:text-[40px]">
              <CountUp to={TOTAL_KG / 1000} run={seen} reduce={reduce} /> <span className="text-[20px] font-medium text-mk-text-2">tCO₂e</span>
            </p>
          </div>
          <dl className="flex gap-6 text-[13px]">
            <div>
              <dt className="text-mk-text-3">vs previous period</dt>
              <dd className="mt-0.5 font-semibold text-mk-text tabular-nums">{PERIOD_CHANGE}</dd>
            </div>
            <div>
              <dt className="text-mk-text-3">Calculated records</dt>
              <dd className="mt-0.5 font-semibold text-mk-text tabular-nums">{CALCULATED_RECORDS}</dd>
            </div>
          </dl>
        </div>

        <div className="border-t border-mk-line pt-5">
          <p className="text-[13px] font-medium text-mk-text">By scope</p>
          <div className="mt-3 flex items-center gap-4">
            <Doughnut seen={seen} />
            <table className="w-full text-[13px]">
              <caption className="sr-only">Emissions by scope, tonnes CO2e</caption>
              <tbody>
                {SCOPES.map((s) => (
                  <tr key={s.scope}>
                    <th scope="row" className="py-1 text-left font-normal text-mk-text-2">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: scopeColor(s.scope) }} />
                      {s.label}
                    </th>
                    <td className="py-1 text-right text-mk-text tabular-nums">{formatTonnesValue(s.value / 1000)} t</td>
                    <td className="w-16 py-1 text-right text-mk-text-3 tabular-nums">{((s.value / TOTAL_KG) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-mk-line pt-5">
          <p className="text-[13px] font-medium text-mk-text">Largest categories, tCO₂e</p>
          <ul className="mt-3 grid gap-3">
            {CATEGORIES.map((c, i) => (
              <li key={c.name} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate text-mk-text-2">{c.name}</span>
                  <span className="shrink-0 text-mk-text tabular-nums">{formatTonnesValue(c.value / 1000)}</span>
                </div>
                <div className="h-2 rounded-[4px] bg-mk-line/60">
                  <div
                    className={`h-full rounded-[4px] ${GROW}`}
                    style={{
                      width: seen ? `${Math.max(0.6, (c.value / MAX_CATEGORY) * 100)}%` : "0%",
                      background: scopeColor(c.scope),
                      transitionDelay: `${600 + i * 90}ms`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ProductFrame>
  );
}
