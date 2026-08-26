import type { ReactNode } from "react";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav theme="dark" />
      <main className="min-h-[100dvh] bg-[#1C1A2E] text-white pt-16">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
