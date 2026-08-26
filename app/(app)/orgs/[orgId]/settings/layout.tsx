"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Members",    segment: "members" },
  { label: "Operations", segment: "operations" },
  { label: "Branding",   segment: "branding" },
  { label: "Audit Log",  segment: "audit" },
  { label: "Suppliers",  segment: "suppliers" },
  { label: "API Keys",   segment: "api-keys" },
  { label: "Billing",    segment: "billing" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = pathname.match(/\/orgs\/([^/]+)\/settings/);
  const orgId = match?.[1] ?? "";

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

          <nav className="flex gap-1 mt-6 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0" aria-label="Settings sections">
            {TABS.map((tab) => {
              const href = `/orgs/${orgId}/settings/${tab.segment}`;
              const isActive = pathname.includes(`/settings/${tab.segment}`);
              return (
                <Link
                  key={tab.segment}
                  href={href}
                  className={cn(
                    "px-3 sm:px-4 py-2 text-xs sm:text-sm font-normal tracking-[-0.42px] border-b-2 -mb-px transition-colors whitespace-nowrap",
                    isActive
                      ? "border-orange-500 text-orange-600"
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
