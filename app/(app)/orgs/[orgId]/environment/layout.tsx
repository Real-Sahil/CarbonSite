"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", segment: "" },
  { label: "Permits", segment: "permits" },
  { label: "Incidents", segment: "incidents" },
  { label: "Legal Register", segment: "legal-register" },
  { label: "Aspects", segment: "aspects" },
];

export default function EnvironmentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = pathname.match(/\/orgs\/([^/]+)\/environment/);
  const orgId = match?.[1] ?? "";
  const base = `/orgs/${orgId}/environment`;

  return (
    <div className="min-h-[100dvh] bg-white">
      <div className="border-b border-zinc-200">
        <nav
          className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pt-4"
          aria-label="Environmental management sections"
        >
          {TABS.map((tab) => {
            const href = tab.segment ? `${base}/${tab.segment}` : base;
            const isActive = tab.segment
              ? pathname.startsWith(`${base}/${tab.segment}`)
              : pathname === base;
            return (
              <Link
                key={tab.segment || "overview"}
                href={href}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-normal tracking-tight transition-colors sm:px-4",
                  isActive
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-700",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
