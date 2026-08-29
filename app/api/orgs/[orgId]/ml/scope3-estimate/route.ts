import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import {
  estimateScope3Energy,
  estimateScope3Waste,
  estimateScope3Water,
  storeScope3Estimate,
  type Scope3Features,
} from "@/lib/ml/scope3-estimator";
import { z } from "zod";

const EstimateRequestSchema = z.object({
  facilityId: z.string().min(1),
  categoryType: z.enum(["energy", "waste", "water"]),
  features: z
    .object({
      headcount: z.number().optional(),
      footprintSqm: z.number().optional(),
      sectorCode: z.string().optional(),
      facilityType: z.string().optional(),
      country: z.string().optional(),
      month: z.number().int().min(0).max(11).optional(),
      isWinter: z.boolean().optional(),
    })
    .optional(),
  storeEstimate: z.boolean().optional().default(true),
});

interface Params {
  orgId: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "editor", "viewer", "reviewer");

    const body = await req.json();
    const { facilityId, categoryType, features, storeEstimate } = EstimateRequestSchema.parse(body);

    let estimate;

    switch (categoryType) {
      case "energy":
        estimate = await estimateScope3Energy(orgId, facilityId, features as Scope3Features);
        break;
      case "waste":
        estimate = await estimateScope3Waste(orgId, facilityId, features as Scope3Features);
        break;
      case "water":
        estimate = await estimateScope3Water(orgId, facilityId, features as Scope3Features);
        break;
    }

    if (!estimate) {
      return apiError(
        "ESTIMATION_FAILED",
        `Could not estimate ${categoryType} for facility ${facilityId}`,
        400
      );
    }

    if (storeEstimate) {
      const categoryCodeMap: Record<string, string> = {
        energy: "s3-energy-consumption",
        waste: "s3-waste-disposal",
        water: "s3-water-consumption",
      };

      // This is a simplified category lookup; in production, fetch from database
      await storeScope3Estimate(orgId, facilityId, categoryCodeMap[categoryType], estimate);
    }

    return NextResponse.json(
      {
        success: true,
        estimate,
        categoryType,
        facilityId,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("VALIDATION_ERROR", "Invalid request parameters", 400);
    }
    return handleRouteError(error);
  }
}
