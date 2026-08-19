import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ArrowUpRight } from "lucide-react";

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
    <main className="min-h-[100dvh] bg-[#0D0D0B]">
      <SiteNav theme="dark" />

      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1600&q=75"
            alt="Worker on construction site with mobile phone"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0B] via-[#0D0D0B]/65 to-[#0D0D0B]/20" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 pt-36">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-6 h-px bg-[#3D6B52]" />
              <span className="text-xs text-[#3D6B52] tracking-[0.12em] font-medium">Mobile field app</span>
            </div>
            <h1 className="text-[clamp(2.8rem,6vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[0.95] text-white mb-6 max-w-[22ch]">
              Evidence captured at the point of activity.
            </h1>
            <p className="text-base text-white/55 leading-relaxed max-w-[48ch] mb-8">
              Field workers photograph documents on-site. On-device OCR extracts the data.
              Works without internet. Syncs automatically when connectivity returns.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-up" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#0D0D0B] text-sm font-medium hover:bg-white/90 transition-colors active:scale-[0.97]">
                Invite a field worker
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/solutions/construction" className="inline-flex items-center px-6 py-3 rounded-full border border-white/20 text-white/80 text-sm font-medium hover:border-white/40 hover:text-white transition-colors">
                Construction use cases
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-[#111110] border-b border-[#2A2A27]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-[#2A2A27]">
            {[
              { stat: "On-device", label: "OCR processing", note: "No server round-trip, no API cost, works in a basement" },
              { stat: "Offline-first", label: "SQLite queue", note: "Every submission drafts locally before any network attempt" },
              { stat: "Auto-sync", label: "Background service", note: "Drains the queue with exponential backoff when online" },
            ].map((item) => (
              <div key={item.stat} className="px-0 md:px-8 py-8 md:py-4 first:pl-0 last:pr-0">
                <div className="text-xl font-semibold text-[#5A9E74] mb-1">{item.stat}</div>
                <div className="text-sm font-medium text-white mb-1">{item.label}</div>
                <div className="text-xs text-[#5C5B57]">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capture steps */}
      <section className="bg-[#F5F4F0]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-[#0D0D0B] mb-16">
              From first launch to first submission.
            </h2>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#E2E1DC]">
            {CAPTURE_STEPS.map((step, i) => (
              <AnimateIn key={step.n} delay={i * 0.05}>
                <div className="bg-[#F5F4F0] p-8 hover:bg-white transition-colors">
                  <div className="text-xs font-mono text-[#3D6B52] mb-6 tracking-widest">{step.n}</div>
                  <h3 className="text-base font-semibold text-[#0D0D0B] tracking-[-0.02em] mb-3">{step.title}</h3>
                  <p className="text-sm text-[#5C5B57] leading-relaxed">{step.text}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* OCR fields */}
      <section className="bg-[#0D0D0B]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-6 h-px bg-[#3D6B52]" />
              <span className="text-xs text-[#5C5B57] tracking-[0.1em]">OCR extraction</span>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-3">
              What the extractor reads.
            </h2>
            <p className="text-sm text-[#5C5B57] mb-12 max-w-[55ch]">
              ML Kit text recognition runs on-device. A regex and heuristic extractor finds structured fields from the raw text blocks. Unrecognised fields are left blank for manual entry.
            </p>
          </AnimateIn>
          <div className="border border-[#2A2A27] divide-y divide-[#2A2A27] overflow-hidden">
            {OCR_FIELDS.map((row) => (
              <div key={row.doc} className="grid grid-cols-1 md:grid-cols-[180px_1fr]">
                <div className="px-6 py-4 border-r border-[#2A2A27]">
                  <span className="text-sm font-medium text-white">{row.doc}</span>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-[#5C5B57]">{row.fields}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security isolation note */}
      <section className="bg-[#F5F4F0] border-t border-[#E2E1DC]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-16">
          <AnimateIn>
            <div className="max-w-xl">
              <h3 className="text-lg font-semibold text-[#0D0D0B] tracking-[-0.02em] mb-3">Field worker data isolation.</h3>
              <p className="text-sm text-[#5C5B57] leading-relaxed">
                A field_worker role has zero access to org dashboards, calculations, or other users&apos; submissions.
                They see only the reporting periods they were invited to and the status of their own submissions.
                Access is enforced server-side on every API request, not from client-supplied headers.
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0D0D0B]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24">
          <AnimateIn>
            <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-white mb-4">
              Put evidence capture in your team&apos;s pocket.
            </h2>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#0D0D0B] text-sm font-medium hover:bg-white/90 transition-colors active:scale-[0.97]"
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
