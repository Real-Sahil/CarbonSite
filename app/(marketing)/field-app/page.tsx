import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { ArrowUpRight, Smartphone } from "lucide-react";
import { VideoBackground } from "@/components/ui/video-background";
import { FieldAppCtaBg } from "@/components/marketing/section-backgrounds";

export const metadata: Metadata = {
  title: "Field App - CarbonSite",
  description: "Mobile app for field workers. Capture data from job sites, works without internet, syncs automatically when online.",
};

const CAPTURE_STEPS = [
  { n: "01", title: "Receive invite link", text: "Your admin sends a unique invite link by text or email. Click it and install the app on iOS or Android. No app store account needed." },
  { n: "02", title: "Set a PIN", text: "On first launch, create a 4 or 6 digit PIN to access the app. That's it — no username or password. Optional: unlock with your fingerprint." },
  { n: "03", title: "Select a project", text: "See only the projects you've been invited to. Each project is separate — you'll only see work related to you." },
  { n: "04", title: "Take a photo", text: "Choose what you're capturing (Waste Ticket, Delivery Note, Receipt, or Other). Photograph the document with your phone camera or upload from your gallery." },
  { n: "05", title: "Review the data", text: "The app automatically reads the key numbers from your photo — weight, dates, supplier name. Check it's right and edit if needed." },
  { n: "06", title: "Send it in (works offline)", text: "Tap submit. The data is saved on your phone first. When you connect to WiFi or mobile data, it syncs automatically to your team." },
];

const OCR_FIELDS = [
  { doc: "Waste ticket", fields: "Weight, waste type, date, vehicle number, location" },
  { doc: "Delivery note", fields: "What was delivered, how much, where it went, who sent it, when it arrived" },
  { doc: "Fuel receipt", fields: "Fuel type, amount, vehicle number, date, cost" },
  { doc: "Other documents", fields: "Upload any document — the app will extract the text for you to categorize" },
];

export default function FieldAppPage() {
  return (
    <main className="min-h-[100dvh] bg-[#FAFBF8]">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden bg-[#0A1628]">
        <VideoBackground src="/videos/hero-field-app.mp4" overlayOpacity={0.30} />
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#0A1628] to-transparent pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 pt-36">
          <AnimateIn>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/8 mb-8">
              <Smartphone className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs text-amber-400 tracking-[0.1em] font-medium">Mobile field app</span>
            </div>
            <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-[#F8FAFC] mb-6 max-w-[22ch]">
              Evidence captured at the{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-orange-300">
                point of activity.
              </span>
            </h1>
            <p className="text-base text-[#94A3B8] leading-relaxed max-w-[48ch] mb-8">
              Field workers photograph documents on the job site. The app automatically reads the important numbers.
              Works without internet. Syncs automatically when you're back online.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-up" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-semibold shadow-[0_0_28px_rgba(245,158,11,0.4)] hover:shadow-[0_0_40px_rgba(245,158,11,0.6)] hover:from-orange-400 hover:to-amber-300 transition-all active:scale-[0.97]">
                Invite a field worker
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/solutions/construction" className="inline-flex items-center px-6 py-3 rounded-full border border-[#94A3B8]/40 text-[#94A3B8] text-sm font-medium hover:border-[#94A3B8]/70 hover:text-[#F8FAFC] transition-colors">
                Construction use cases
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="bg-[#F2F4EF] border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-[#E5E7EB]">
            {[
              { stat: "Works offline", label: "No internet needed", note: "Capture data anywhere — in a basement, a vehicle, or a remote site" },
              { stat: "Auto-sync", label: "Saves locally first", note: "Your data is saved on your phone before being sent to the team" },
              { stat: "Smart extraction", label: "Reads documents", note: "The app reads weight, dates, and names from photos automatically" },
            ].map((item) => (
              <div key={item.stat} className="px-0 md:px-8 py-8 md:py-4 first:pl-0 last:pr-0">
                <div className="text-xl font-semibold text-amber-600 mb-1">{item.stat}</div>
                <div className="text-sm font-medium text-[#374151] mb-1">{item.label}</div>
                <div className="text-xs text-[#6B7280]">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capture steps ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#FAFBF8]">
        <div className="relative mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-6 h-px bg-gradient-to-r from-orange-500 to-amber-400" />
              <span className="text-[10px] font-mono text-amber-600 uppercase tracking-[0.14em]">How it works</span>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#111827] mb-16">
              From first launch to first submission.
            </h2>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CAPTURE_STEPS.map((step, i) => (
              <AnimateIn key={step.n} delay={i * 0.05}>
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 hover:border-amber-500/40 hover:bg-[#FFF7ED] transition-all duration-300">
                  <div className="text-[10px] font-mono text-amber-600 mb-6 tracking-widest">{step.n}</div>
                  <h3 className="text-base font-semibold text-[#111827] tracking-[-0.02em] mb-3">{step.title}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed">{step.text}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── OCR fields ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#F2F4EF] border-t border-[#E5E7EB]">
        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-6 h-px bg-gradient-to-r from-orange-500 to-amber-400" />
              <span className="text-[10px] font-mono text-amber-600 uppercase tracking-[0.14em]">OCR extraction</span>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#111827] mb-3">
              What the extractor reads.
            </h2>
            <p className="text-sm text-[#6B7280] mb-12 max-w-[55ch]">
              ML Kit text recognition runs on-device. A regex and heuristic extractor finds structured fields from the raw text blocks. Unrecognised fields are left blank for manual entry.
            </p>
          </AnimateIn>
          <div className="border border-[#E5E7EB] divide-y divide-[#E5E7EB] rounded-2xl overflow-hidden">
            {OCR_FIELDS.map((row) => (
              <div key={row.doc} className="grid grid-cols-1 md:grid-cols-[180px_1fr] bg-white hover:bg-[#FAFBF8] transition-colors">
                <div className="px-6 py-4 border-r border-[#E5E7EB]">
                  <span className="text-sm font-medium text-[#111827]">{row.doc}</span>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-[#6B7280]">{row.fields}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security isolation ────────────────────────────────────────────── */}
      <section className="bg-[#FAFBF8] border-t border-[#E5E7EB]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-16">
          <AnimateIn>
            <div className="max-w-xl rounded-2xl border border-[#E5E7EB] bg-white p-8">
              <h3 className="text-lg font-semibold text-[#111827] tracking-[-0.02em] mb-3">Field worker data isolation.</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">
                A field_worker role has zero access to org dashboards, calculations, or other users&apos; submissions.
                They see only the reporting periods they were invited to and the status of their own submissions.
                Access is enforced server-side on every API request, not from client-supplied headers.
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0A1628]">
        <FieldAppCtaBg />
        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 py-28">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#F8FAFC] mb-4">
              Put evidence capture in your team&apos;s pocket.
            </h2>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-medium shadow-[0_0_32px_rgba(245,158,11,0.45)] hover:shadow-[0_0_48px_rgba(245,158,11,0.6)] hover:from-orange-400 hover:to-amber-300 transition-all active:scale-[0.97]"
            >
              Create organisation and send first invite
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </AnimateIn>
        </div>
      </section>

    </main>
  );
}
