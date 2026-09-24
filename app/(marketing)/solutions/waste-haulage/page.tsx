import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
import { SolutionPage } from "@/components/marketing/solution-page";

export const metadata: Metadata = withSocial({
  title: "Waste and haulage",
  description:
    "Waste tickets, EWC codes, weights and routes captured on the phone, reviewed and turned into Scope 1 and Scope 3 records, with a duty-of-care register.",
  alternates: { canonical: "/solutions/waste-haulage" },
});

export default function WasteHaulagePage() {
  return (
    <SolutionPage
      c={{
        eyebrow: "Waste and haulage",
        title: "From waste ticket to reported tonne.",
        lead: "Tickets, transfer notes and fuel receipts are captured where the lorry is, checked in the office, and calculated with the factor and formula recorded for each one.",
        heroVideo: "/marketing/loops/review.mp4",
        problems: [
          {
            problem: "Ticket data is typed in weeks later",
            answer: "The field app reads weight, EWC code, date, vehicle registration and carrier from the photo, and saves the submission offline until there is signal.",
          },
          {
            problem: "Distances are guessed",
            answer: "Pickup and delivery postcodes on a ticket give a road distance for the movement. The worker's own location is kept for the audit trail only.",
          },
          {
            problem: "Duty-of-care paperwork lives in a separate folder",
            answer: "Waste transfers are kept in a duty-of-care register with EWC codes, carriers and gaps flagged, alongside the carbon records.",
          },
          {
            problem: "Fleet fuel and waste emissions are mixed up",
            answer: "Your own fleet's fuel is Scope 1. Waste your operations generate is Scope 3 category 5. Each record is categorised on review, and the category is visible on every calculation.",
          },
        ],
        feature: {
          eyebrow: "Review",
          title: "Catch the ticket that does not match.",
          lead: "The reviewer sees the value read from the photo beside the value submitted. A 6.7 tonne ticket entered as 6.1 tonnes gets queried, not approved.",
          points: ["Needs-info requests go back to the worker's phone", "Approved tickets become activity records linked to their evidence", "Review deadlines can alert the team when submissions wait too long"],
          media: { kind: "loop", src: "/marketing/loops/review.mp4", label: "Waste ticket under review with a weight query" },
        },
        detail: {
          eyebrow: "Calculation",
          title: "Every tonne has a formula.",
          lead: "Each record keeps its calculations: amount, factor, unit conversion, library and methodology version.",
          points: ["DEFRA 2025.2 and 2026.1 waste and freight factors", "Unit conversions listed on the run before publishing", "A CSV trail with every calculation for your auditor"],
          media: { kind: "loop", src: "/marketing/loops/record.mp4", label: "Activity record showing its calculations" },
        },
        closing: { title: "Try it on a week of tickets.", lead: "Invite a few drivers to the field app during the trial and review what they send in." },
      }}
    />
  );
}
