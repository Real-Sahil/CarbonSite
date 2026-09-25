import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
import { SolutionPage } from "@/components/marketing/solution-page";

export const metadata: Metadata = withSocial({
  title: "Public-sector suppliers",
  description:
    "A bid carbon pack with a PPN 006 Carbon Reduction Plan, published emissions figures and social value tracking from one MetricOra dataset.",
  alternates: { canonical: "/solutions/public-sector" },
});

export default function PublicSectorPage() {
  return (
    <SolutionPage
      c={{
        eyebrow: "Public-sector suppliers",
        title: "The carbon and social value answers every tender asks for.",
        lead: "Central government contracts over £5 million a year ask for a Carbon Reduction Plan under PPN 006, and most frameworks score social value. MetricOra keeps both beside the records you already hold.",
        heroVideo: "/marketing/loops/reports.mp4",
        problems: [
          {
            problem: "Rewriting the Carbon Reduction Plan for every bid",
            answer: "The bid carbon pack includes a PPN 006 Carbon Reduction Plan built from your published snapshots, base year and targets, so the figures match every other document you submit.",
          },
          {
            problem: "Tender carbon sections take days",
            answer: "The bid carbon pack pulls the plan, the emissions trend across published years, featured contracts and assurance status into one document. Sections without data are left out, not estimated.",
          },
          {
            problem: "Missing sign-off discovered at the deadline",
            answer: "A readiness check runs before the pack is generated and blocks it if the base year, director sign-off or a net zero year by 2050 is missing.",
          },
          {
            problem: "Social value tracked in another system",
            answer: "National TOMs commitments are held against contracts and periods, and delivery is logged as it happens, next to the carbon figures for the same contract.",
          },
        ],
        feature: {
          eyebrow: "Reports",
          title: "Tender documents from published figures only.",
          lead: "Every figure in a pack comes from a published snapshot or your own records. Nothing is estimated or written for you.",
          points: [
            "Bid carbon pack with a PPN 006 Carbon Reduction Plan",
            "Emissions trend across your published years",
            "Each featured contract with its carbon and National TOMs delivered against commitment, side by side",
            "Model answers built only from your published figures",
            "Emissions reports with the auditor's CSV calculation trail",
          ],
          media: { kind: "loop", src: "/marketing/loops/reports.mp4", label: "Reports page with published snapshots and generated reports" },
        },
        detail: {
          eyebrow: "Planning",
          title: "Targets that match the plan you submit.",
          lead: "The base year, targets and transition plan in MetricOra are the ones printed in the Carbon Reduction Plan, so they stay consistent between bids.",
          points: ["Base year with a recalculation threshold and restatement log", "Transition plan checklist with board approval", "Internal carbon price for tender appraisals"],
          media: { kind: "shot", src: "/marketing/screens/base-year.jpg", alt: "Base year and recalculation policy" },
        },
        closing: { title: "Have your next Carbon Reduction Plan ready before the tender lands.", lead: "Publish a year of data in the trial and generate the plan from it." },
      }}
    />
  );
}
