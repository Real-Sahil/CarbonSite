import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ArrowUpRight, Smartphone } from "lucide-react";
import { FieldAppHeroBg, FieldAppOcrBg, FieldAppCtaBg } from "@/components/marketing/section-backgrounds";

export const metadata: Metadata = {
  title: "Field App - CarbonSite",
  description: "Offline-first mobile app for field workers. On-device OCR, PIN onboarding, offline queue, and sync when connectivity returns.",
};

const CAPTURE_STEPS = [
  { n: "01", title: "Receive invite link", text: "Admin sends a signed invite link by SMS or email. The link opens in a browser and prompts install on iOS and Android. No App Store account needed first." },
  { n: "02", title: "Set a PIN", text: "On first launch the field worker sets a 6-digit PIN stored in the device secure enclave. No username or password. Biometric unlock optional." },
  { n: "03", title: "Select a project", text: "Home screen shows only the reporting periods and organisations this user was invited to contribute to. Zero access to any other org data." },
  { n: "04", title: "Photograph a document", text: "Choose document type (Waste Ticket, Delivery Note, Fuel Receipt, Other). Camera or gallery. On-device ML Kit OCR runs in 1-2 seconds without a network request." },
  { n: "05", title: "Confirm extracted fields", text: "Auto-extracted fields are highlighted. Wrong? Just edit. Empty fields left blank for manual entry. Add GPS location optionally." },
  { n: "06", title: "Submit (works offline)", text: "Submission is saved to local SQLite first. A background sync service drains the queue when connectivity returns. Status: pending, syncing, submitted." },
];

const OCR_FIELDS = [
  { doc: "Waste ticket", fields: "Weight (kg/t), EWC code (XX XX XX), date (UK formats), vehicle registration, site address" },
  { doc: "Delivery note", fields: "Material type, quantity and unit, delivery address, supplier name, date" },
  { doc: "Fuel receipt", fields: "Fuel type, volume (litres), vehicle registration, date, total cost" },
  { doc: "Other documents", fields: "Raw text blocks presented for manual field assignment" },
];

export default function FieldAppPage() {
  return (
    <main className="min-h-[100dvh] bg-[#060612]">
      <SiteNav theme="dark" />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden bg-[#060612]">
        <FieldAppHeroBg />
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#060612] to-transparent pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 pt-36">
          <AnimateIn>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/20 bg-teal-500/8 mb-8">
              <Smartphone className="h-3.5 w-3.5 text-teal-400" />
              <span className="text-xs text-teal-400 tracking-[0.1em] font-medium">Mobile field app</span>
            </div>
            <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-white mb-6 max-w-[22ch]">
              Evidence captured at the{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-300 to-cyan-300">
                point of activity.
              </span>
            </h1>
            <p className="text-base text-white/40 leading-relaxed max-w-[48ch] mb-8">
              Field workers photograph documents on-site. On-device OCR extracts the data.
              Works without internet. Syncs automatically when connectivity returns.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-up" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-semibold shadow-[0_0_28px_rgba(13,148,136,0.4)] hover:shadow-[0_0_40px_rgba(13,148,136,0.6)] hover:from-teal-400 hover:to-cyan-400 transition-all active:scale-[0.97]">
                Invite a field worker
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/solutions/construction" className="inline-flex items-center px-6 py-3 rounded-full border border-white/15 bg-white/5 text-white/70 text-sm font-medium hover:border-white/25 hover:text-white transition-colors">
                Construction use cases
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="bg-[#060612] border-b border-white/8">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-white/8">
            {[
              { stat: "On-device", label: "OCR processing", note: "No server round-trip, no API cost, works in a basement" },
              { stat: "Offline-first", label: "SQLite queue", note: "Every submission drafts locally before any network attempt" },
              { stat: "Auto-sync", label: "Background service", note: "Drains the queue with exponential backoff when online" },
            ].map((item) => (
              <div key={item.stat} className="px-0 md:px-8 py-8 md:py-4 first:pl-0 last:pr-0">
                <div className="text-xl font-semibold text-teal-400 mb-1">{item.stat}</div>
                <div className="text-sm font-medium text-white/70 mb-1">{item.label}</div>
                <div className="text-xs text-white/30">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capture steps ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#060612]">
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.014) 1px,transparent 1px)", backgroundSize: "56px 56px" }} />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(13,148,136,0.09)_0%,transparent_70%)] pointer-events-none -translate-y-1/2" />

        <div className="relative mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-6 h-px bg-gradient-to-r from-teal-500 to-cyan-500" />
              <span className="text-[10px] font-mono text-teal-400 uppercase tracking-[0.14em]">How it works</span>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-16">
              From first launch to first submission.
            </h2>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CAPTURE_STEPS.map((step, i) => (
              <AnimateIn key={step.n} delay={i * 0.05}>
                <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-8 hover:border-teal-500/20 hover:bg-white/5 transition-all duration-300">
                  <div className="text-[10px] font-mono text-teal-400 mb-6 tracking-widest">{step.n}</div>
                  <h3 className="text-base font-semibold text-white tracking-[-0.02em] mb-3">{step.title}</h3>
                  <p className="text-sm text-white/35 leading-relaxed">{step.text}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── OCR fields ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#060612] border-t border-white/6">
        <FieldAppOcrBg />
        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-6 h-px bg-gradient-to-r from-teal-500 to-cyan-500" />
              <span className="text-[10px] font-mono text-teal-400 uppercase tracking-[0.14em]">OCR extraction</span>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-3">
              What the extractor reads.
            </h2>
            <p className="text-sm text-white/40 mb-12 max-w-[55ch]">
              ML Kit text recognition runs on-device. A regex and heuristic extractor finds structured fields from the raw text blocks. Unrecognised fields are left blank for manual entry.
            </p>
          </AnimateIn>
          <div className="border border-white/8 divide-y divide-white/6 rounded-2xl overflow-hidden">
            {OCR_FIELDS.map((row) => (
              <div key={row.doc} className="grid grid-cols-1 md:grid-cols-[180px_1fr] hover:bg-white/3 transition-colors">
                <div className="px-6 py-4 border-r border-white/6">
                  <span className="text-sm font-medium text-white/80">{row.doc}</span>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-white/40">{row.fields}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security isolation ────────────────────────────────────────────── */}
      <section className="bg-[#060612] border-t border-white/6">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-16">
          <AnimateIn>
            <div className="max-w-xl rounded-2xl border border-white/8 bg-white/3 p-8">
              <h3 className="text-lg font-semibold text-white tracking-[-0.02em] mb-3">Field worker data isolation.</h3>
              <p className="text-sm text-white/40 leading-relaxed">
                A field_worker role has zero access to org dashboards, calculations, or other users&apos; submissions.
                They see only the reporting periods they were invited to and the status of their own submissions.
                Access is enforced server-side on every API request, not from client-supplied headers.
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#060612] border-t border-white/6">
        <FieldAppCtaBg />
        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 py-28">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-4">
              Put evidence capture in your team&apos;s pocket.
            </h2>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium shadow-[0_0_32px_rgba(13,148,136,0.45)] hover:shadow-[0_0_48px_rgba(13,148,136,0.6)] hover:from-teal-400 hover:to-cyan-400 transition-all active:scale-[0.97]"
            >
              Create organisation and send first invite
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </AnimateIn>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
