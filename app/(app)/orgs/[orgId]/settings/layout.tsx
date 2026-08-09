"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Members",    segment: "members" },
  { label: "Operations", segment: "operations" },
  { label: "Branding",   segment: "branding" },
  { label: "Audit Log",  segment: "audit" },
  { label: "API Keys",   segment: "api-keys" },
  { label: "Billing",    segment: "billing" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = pathname.match(/\/orgs\/([^/]+)\/settings/);
  const orgId = match?.[1] ?? "";

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 pt-8 pb-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            Settings
          </h1>
          <p className="mt-1 text-sm text-[#374151]">
            Manage your organisation, members, and configuration.
          </p>

          <nav className="flex gap-1 mt-6" aria-label="Settings sections">
            {TABS.map((tab) => {
              const href = `/orgs/${orgId}/settings/${tab.segment}`;
              const isActive = pathname.includes(`/settings/${tab.segment}`);
              return (
                <Link
                  key={tab.segment}
                  href={href}
                  className={cn(
                    "px-4 py-2 text-sm font-normal tracking-[-0.42px] border-b-2 -mb-px transition-colors",
                    isActive
                      ? "border-[#0EA5E9] text-[#111827]"
                      : "border-transparent text-[#374151] hover:text-[#111827]",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8">{children}</div>
    </div>
  );
}
