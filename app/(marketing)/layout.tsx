import type { ReactNode } from "react";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { AcquisitionCarry } from "@/components/marketing/acquisition-carry";
import { StringTuneEffects } from "@/components/marketing/string-tune";
import { ScrollProvider } from "@/components/scroll-provider";

// Every marketing page opens with a dark hero that sits under the fixed nav.
// Smooth scrolling is marketing-only: Lenis hijacks wheel events over nested
// scroll areas (sidebar menu, tables), so the organisation app runs native scroll.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <ScrollProvider>
      <SiteNav />
      <main id="main-content" className="min-h-[100dvh] bg-mk-surface text-mk-text">
        {children}
      </main>
      <SiteFooter />
      <AcquisitionCarry />
      <StringTuneEffects />
    </ScrollProvider>
  );
}
