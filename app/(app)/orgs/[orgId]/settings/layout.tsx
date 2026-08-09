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
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[28px]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[#374151]">
          Manage your organisation, members, and configuration.
        </p>
      </div>

      <nav className="flex gap-1 border-b border-[#E5E7EB]" aria-label="Settings sections">
        {TABS.map((tab) => {
          const href = `/orgs/${orgId}/settings/${tab.segment}`;
          const isActive = pathname.includes(`/settings/${tab.segment}`);
          return (
            <Link
              key={tab.segment}
              href={href}
              className={cn(
                "px-4 py-2 text-sm font-normal tracking-[-0.42px] rounded-t-[7px] border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-[#0EA5E9] text-[#111827] bg-[#F0F9FF]"
                  : "border-transparent text-[#374151] hover:text-[#111827] hover:bg-[#F0F9FF]",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
