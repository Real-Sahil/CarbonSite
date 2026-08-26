import type { ReactNode } from "react";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav theme="light" />
      <main className="min-h-[100dvh] bg-[#FAFBF8] text-[#111827] pt-16">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
