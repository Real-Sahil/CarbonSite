import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/marketing/animate-in";
import { PhoneCaptureMock } from "@/components/marketing/phone-capture-mock";

export const metadata: Metadata = {
  title: "Field App - CarbonSite",
  description: "Offline-first mobile app for field workers. On-device OCR, PIN onboarding, offline queue, and sync when connectivity returns.",
};

const CAPTURE_STEPS = [
  {
    n: "1",
    title: "Receive invite link",
    text: "The org admin sends a signed invite link by SMS or email. No App Store account needed first - the link opens in a browser and prompts install on iOS and Android.",
    color: "#0f766e",
  },
  {
    n: "2",
    title: "Set a PIN",
    text: "On first launch, the field worker sets a 6-digit PIN stored in the device secure enclave. No username or password required. Biometric unlock optional.",
    color: "#0ea5e9",
  },
  {
    n: "3",
    title: "Select a project",
    text: "The home screen shows only the reporting periods and organisations this user has been invited to contribute to. No access to any other org data.",
    color: "#8b5cf6",
  },
  {
    n: "4",
    title: "Photograph a document",
    text: "Choose document type (Waste Ticket, Delivery Note, Fuel Receipt, Other). Open camera or pick from gallery. On-device ML Kit OCR runs in 1-2 seconds without any network request.",
    color: "#f59e0b",
  },
  {
    n: "5",
    title: "Confirm extracted fields",
    text: "Auto-extracted fields are highlighted with a sparkle badge. Wrong? Just edit. Empty fields are left blank for manual entry. Add GPS location (optional).",
    color: "#84cc16",
  },
  {
    n: "6",
    title: "Submit (works offline)",
    text: "Submission is saved to local SQLite first. A background sync service drains the queue when connectivity returns. Status moves from pending to syncing to submitted.",
    color: "#f43f5e",
  },
];

const OCR_FIELDS = [
  { doc: "Waste ticket", fields: "Weight (kg/t), EWC code (XX XX XX), date (UK formats), vehicle registration, site address" },
  { doc: "Delivery note", fields: "Material type, quantity and unit, delivery address, supplier name, date" },
  { doc: "Fuel receipt", fields: "Fuel type, volume (litres), vehicle registration, date, total cost" },
  { doc: "Other documents", fields: "Raw text blocks presented for manual field assignment" },
];

export default function FieldAppPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-zinc-800 py-20 px-5">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <AnimateIn>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 mb-6 text-xs text-zinc-400">
                Field app
              </div>
              <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter leading-tight mb-6">
                Evidence capture from the site, not the office.
              </h1>
              <p className="text-lg text-zinc-400 leading-relaxed max-w-[50ch] mb-8">
                Field workers photograph documents on-site. On-device OCR extracts the data.
                Works without internet. Syncs automatically when connectivity returns.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/sign-up" className="inline-flex items-center px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors active:scale-[0.97]">
                  Invite a field worker
                </Link>
                <Link href="/solutions/construction" className="inline-flex items-center px-6 py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-500 hover:text-white transition-colors">
                  Construction use cases
                </Link>
              </div>
            </AnimateIn>

            <AnimateIn delay={0.15}>
              <PhoneCaptureMock />
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* Offline-first callout */}
      <section className="border-b border-zinc-800 bg-zinc-900/50 px-5 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { stat: "On-device", label: "OCR processing", note: "No server round-trip, no API cost, works in a basement" },
              { stat: "Offline-first", label: "SQLite queue", note: "Every submission drafts locally before any network attempt" },
              { stat: "Auto-sync", label: "Background service", note: "Drains the queue with exponential backoff when online" },
            ].map((item) => (
              <div key={item.stat} className="text-center p-6 rounded-xl border border-zinc-800">
                <div className="text-2xl font-semibold text-emerald-400 mb-1">{item.stat}</div>
                <div className="text-sm font-medium text-white mb-2">{item.label}</div>
                <div className="text-xs text-zinc-500">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capture steps */}
      <section className="border-b border-zinc-800 px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <h2 className="text-3xl font-semibold tracking-tighter text-white mb-12">
              From first launch to first submission.
            </h2>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAPTURE_STEPS.map((step, i) => (
              <AnimateIn key={step.n} delay={i * 0.07}>
                <div className="h-full rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                  <div className="text-3xl font-bold tracking-tighter mb-3" style={{ color: step.color }}>
                    {step.n}
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{step.text}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* OCR field extraction */}
      <section className="border-b border-zinc-800 px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <h2 className="text-3xl font-semibold tracking-tighter text-white mb-2">
              What OCR extracts.
            </h2>
            <p className="text-sm text-zinc-400 mb-10 max-w-[55ch]">
              ML Kit text recognition runs on-device. A regex and heuristic extractor
              finds structured fields from the raw text blocks. Unrecognised fields are
              left blank for manual entry.
            </p>
          </AnimateIn>
          <div className="space-y-4">
            {OCR_FIELDS.map((row, i) => (
              <AnimateIn key={row.doc} delay={i * 0.06}>
                <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-0 rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="bg-zinc-900 p-4 border-r border-zinc-800 flex items-center">
                    <span className="text-sm font-medium text-zinc-300">{row.doc}</span>
                  </div>
                  <div className="bg-zinc-900/40 p-4">
                    <p className="text-sm text-zinc-400">{row.fields}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Security note */}
      <section className="border-b border-zinc-800 px-5 py-16">
        <div className="mx-auto max-w-7xl">
          <AnimateIn>
            <div className="max-w-xl rounded-xl border border-zinc-800 bg-zinc-900 p-8">
              <h3 className="text-lg font-semibold text-white mb-3">Field worker data isolation.</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                A field_worker role has zero access to org dashboards, calculations, or other users&apos;
                submissions. They see only the reporting periods they were invited to and the status
                of their own submissions. Access is enforced server-side on every API request -
                not from client-supplied headers.
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-20 text-center">
        <AnimateIn>
          <h2 className="text-3xl font-semibold tracking-tighter text-white mb-4">
            Put evidence capture in your team&apos;s pocket.
          </h2>
          <Link href="/sign-up" className="inline-flex items-center px-7 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors active:scale-[0.97]">
            Create organisation and send first invite
          </Link>
        </AnimateIn>
      </section>
    </>
  );
}
