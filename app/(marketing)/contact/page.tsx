import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
import { CheckList, Eyebrow, H1, H3, Lead, Section } from "@/components/marketing/kit";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = withSocial({
  title: "Book a pilot",
  description: "Plan a MetricOra pilot around one live project and one reporting period, or ask us a question.",
  alternates: { canonical: "/contact" },
});

const PREPARE = [
  { title: "One project or site", text: "A live UK site with a defined reporting period, usually the last full year." },
  { title: "The data you already have", text: "Fuel card and meter exports, supplier invoices or spend extracts, and any waste tickets." },
  { title: "The people involved", text: "An admin, someone to review evidence, and two or three people on site to try the field app." },
];

export default function ContactPage() {
  return (
    <>
      <Section tone="dark" size="lg" video="/marketing/loops/review.mp4" poster="/marketing/loops/review.jpg" className="pt-36 sm:pt-40">
        <div className="flex max-w-3xl flex-col gap-6">
          <Eyebrow tone="dark">Book a pilot</Eyebrow>
          <H1>Test MetricOra on a real project.</H1>
          <Lead tone="dark">A pilot runs on your own data: one site, one period, your team. We help set it up and you decide from the published result.</Lead>
        </div>
      </Section>

      <Section tone="light">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h2 className="text-[26px] font-semibold tracking-[-0.02em]">What to bring</h2>
              <p className="max-w-[52ch] text-[16px] leading-relaxed text-mk-text-2">Real records make a better pilot than sample data.</p>
            </div>
            <ul className="grid gap-6">
              {PREPARE.map((p) => (
                <li key={p.title} className="flex flex-col gap-1.5 border-l-2 border-mk-accent pl-5">
                  <H3>{p.title}</H3>
                  <p className="text-[15px] leading-relaxed text-mk-text-2">{p.text}</p>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3">
              <p className="text-[15px] font-semibold">At the end you will have</p>
              <CheckList items={["A published snapshot for the period", "A report with its CSV calculation trail", "Evidence linked to each record and a full audit trail"]} />
            </div>
            <p className="text-[15px] text-mk-text-2">
              Or email <a className="font-medium text-mk-accent hover:underline" href="mailto:hello@metricora.co.uk">hello@metricora.co.uk</a>. We reply within one working day.
            </p>
          </div>
          <div className="rounded-[12px] border border-mk-line bg-mk-paper p-7 sm:p-9">
            <h2 className="mb-6 text-[22px] font-semibold tracking-[-0.02em]">Tell us about the project</h2>
            <ContactForm />
          </div>
        </div>
      </Section>
    </>
  );
}
