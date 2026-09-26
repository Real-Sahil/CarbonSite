"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Members",    segment: "members" },
  { label: "Operations", segment: "operations" },
  { label: "Electricity contracts", segment: "energy-instruments" },
  { label: "Carbon price", segment: "carbon-price" },
  { label: "AI assistance", segment: "ai" },
  { label: "Branding",   segment: "branding" },
  { label: "Audit Log",  segment: "audit" },
  { label: "Suppliers",  segment: "suppliers" },
  { label: "API Keys",   segment: "api-keys" },
  { label: "Webhooks",   segment: "webhooks" },
  { label: "Billing",        segment: "billing" },
  { label: "Data Retention", segment: "data-retention" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const match = pathname.match(/\/orgs\/([^/]+)\/settings/);
  const orgId = match?.[1] ?? "";
  const activeSegment = TABS.find((t) => pathname.includes(`/settings/${t.segment}`))?.segment ?? TABS[0].segment;

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA]">
      {/* Page header */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            Settings
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Manage your organisation, members, and configuration.
          </p>

          {/* Mobile: select dropdown */}
          <div className="mt-5 sm:hidden">
            <select
              value={activeSegment}
              onChange={(e) => router.push(`/orgs/${orgId}/settings/${e.target.value}`)}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c2410c]/40"
              aria-label="Settings section"
            >
              {TABS.map((tab) => (
                <option key={tab.segment} value={tab.segment}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop: tab strip */}
          <nav className="hidden sm:flex gap-1 mt-6 overflow-x-auto" aria-label="Settings sections">
            {TABS.map((tab) => {
              const href = `/orgs/${orgId}/settings/${tab.segment}`;
              const isActive = pathname.includes(`/settings/${tab.segment}`);
              return (
                <Link
                  key={tab.segment}
                  href={href}
                  className={cn(
                    "px-4 py-2 text-sm font-normal tracking-[-0.42px] border-b-2 -mb-px transition-colors whitespace-nowrap",
                    isActive
                      ? "border-[#c2410c] text-[#c2410c]"
                      : "border-transparent text-[#6B7280] hover:text-[#374151]",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 sm:py-8">{children}</div>
    </div>
  );
}
