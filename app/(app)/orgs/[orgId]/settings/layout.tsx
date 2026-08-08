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
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = pathname.match(/\/orgs\/([^/]+)\/settings/);
  const orgId = match?.[1] ?? "";

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[28px]">
      <div>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Settings
        </p>
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          Settings
        </h1>
      </div>

      <nav className="flex gap-1 border-b border-[#e5e7eb]" aria-label="Settings sections">
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
                  ? "border-[#0f3e17] text-[#0f3e17] bg-[#e1f4df]"
                  : "border-transparent text-[#222222] hover:text-[#0f3e17] hover:bg-[#e1f4df]",
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
