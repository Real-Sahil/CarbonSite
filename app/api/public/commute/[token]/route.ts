export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { KM_PER_MILE, MAX_ROUND_TRIP_MILES, SURVEY_MODE_KEYS, VEHICLE_MODES, type SurveyMode } from "@/lib/commuting/attendance";

const Answer = z.object({
  mode: z.enum(SURVEY_MODE_KEYS as [string, ...string[]]),
  occupancy: z.number().int().min(1).max(9).default(1),
  workforce: z.enum(["own", "subcontractor"]),
  /** Home to site and back, in miles. */
  roundTripMiles: z.number().min(0).max(MAX_ROUND_TRIP_MILES),
});

/** One anonymous answer to a site's travel survey. Nothing identifying is taken. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const limited = await rateLimitRequest(req, { key: `commute-survey:${token.slice(0, 32)}`, limit: 30, windowMs: 60 * 60_000 });
    if (limited) return limited;

    const survey = await prisma.commuteSurvey.findUnique({ where: { token }, select: { id: true, organizationId: true, isOpen: true } });
    if (!survey) return apiError("NOT_FOUND", "This survey link is not valid.", 404);
    if (!survey.isOpen) return apiError("CLOSED", "This survey has closed.", 410);

    const answer = Answer.parse(await req.json());
    const vehicle = VEHICLE_MODES.includes(answer.mode as SurveyMode);
    await prisma.commuteSurveyResponse.create({
      data: {
        organizationId: survey.organizationId,
        surveyId: survey.id,
        mode: answer.mode,
        occupancy: vehicle ? answer.occupancy : 1,
        workforce: answer.workforce,
        roundTripKm: Math.round(answer.roundTripMiles * KM_PER_MILE * 10) / 10,
      },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
