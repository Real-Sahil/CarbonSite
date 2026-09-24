import type { ReactNode } from "react";
import { Eyebrow, Section } from "@/components/marketing/kit";

// Shared frame for the legal pages so they match the rest of the site.
export function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <Section tone="dark" className="pt-36 sm:pt-40">
        <div className="flex max-w-3xl flex-col gap-4">
          <Eyebrow tone="dark">Legal</Eyebrow>
          <h1 className="text-[36px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[48px]">{title}</h1>
          <p className="text-[15px] text-mk-on-dark-2">{updated}</p>
        </div>
      </Section>
      <Section tone="light">
        <div className="mk-prose mx-auto max-w-[72ch]">{children}</div>
      </Section>
    </>
  );
}
