"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

// The server render has no address, so the path appears after hydration without a mismatch.
const subscribe = () => () => {};
const readPath = () => window.location.pathname;
const noPath = () => "";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="font-mono text-xs uppercase tracking-[0.12em] text-[#41505F]">{label}</dt>
      <dd className="min-w-0 text-sm text-[#131d29] sm:text-right">{children}</dd>
    </div>
  );
}

export function MissingPageLedger() {
  const path = useSyncExternalStore(subscribe, readPath, noPath);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
      <div className="rounded-2xl border border-[#131d29]/10 bg-white px-5 shadow-[0_2px_8px_rgba(19,29,41,0.05)]">
        <dl className="divide-y divide-[#131d29]/10">
          <Row label="Path">
            <span className="break-all font-mono">{path || "…"}</span>
          </Row>
          <Row label="Page">Not in the catalogue</Row>
          <Row label="Factor">
            <motion.span
              initial={{ opacity: 0, scale: 1.12 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.3, ease: "easeOut" }}
              className="inline-flex rounded-full border border-[#c2400c]/40 px-2.5 py-0.5 text-xs font-medium text-[#c2400c]"
            >
              No match
            </motion.span>
          </Row>
          <Row label="tCO2e">Not counted</Row>
        </dl>
      </div>
      <p className="mt-3 text-xs text-[#41505F]">A missing page counts as a gap, not a zero.</p>
    </motion.div>
  );
}
