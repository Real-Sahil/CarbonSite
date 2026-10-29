import type { Metadata } from "next";
import Link from "next/link";
import { MotionProvider } from "@/components/motion-provider";
import { MissingPageLedger } from "@/components/not-found/missing-page-ledger";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F9FAFC] text-[#131d29]">
      <header className="px-4 pt-6 sm:px-8">
        <Link href="/" aria-label="MetricOra home" className="inline-flex w-fit">
          <Logo size={28} textColor="#131d29" />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#41505F]">Factor lookup · error 404</p>
          <h1 className="font-display mt-4 text-4xl font-light leading-[1.05] tracking-[-0.02em] sm:text-6xl">
            This page isn&rsquo;t in the <em className="italic text-[#c2400c]">ledger</em>.
          </h1>
          <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-[#41505F]">
            We checked every page we publish against the address you opened. No match, so there&rsquo;s nothing to report
            and nothing to estimate.
          </p>
          <div className="mt-10">
            <MotionProvider><MissingPageLedger /></MotionProvider>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/">Back to home</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
