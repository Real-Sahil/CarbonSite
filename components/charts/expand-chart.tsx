"use client";

import { useState, type ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * Puts an expand button on a chart. The chart is rendered once inline and
 * again full screen in a dialog; the function child gets `expanded` so it can
 * grow to fill the larger view.
 */
export function ExpandChart({ title, children }: { title: string; children: (expanded: boolean) => ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="relative">
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`Expand ${title}`}
            className="absolute right-0 top-0 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#E3E8EE] bg-white text-[#41505F] transition-colors hover:bg-[#F9FAFC]"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-[min(96vw,1200px)] p-5">
          <DialogTitle className="mb-3 text-sm font-medium text-[#131d29]">{title}</DialogTitle>
          {children(true)}
        </DialogContent>
      </Dialog>
      {children(false)}
    </div>
  );
}
