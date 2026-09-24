import type { ReactNode } from "react";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";

// Every marketing page opens with a dark hero that sits under the fixed nav.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      <main id="main-content" className="min-h-[100dvh] bg-mk-surface text-mk-text">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
