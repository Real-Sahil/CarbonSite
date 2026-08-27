import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { verifyCredential } from "@/lib/iot/device-manager";
import { processMeterReading } from "@/lib/iot/meter-processor";
import { prisma } from "@/lib/db";

const meterReadingSchema = z.object({
  deviceId: z.string(),
  timestamp: z.string().datetime(),
  rawValue: z.number(),
  rawUnit: z.string(),
  metadata: z
    .object({
      deviceName: z.string().optional(),
      temperature: z.number().optional(),
    })
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = params;

    // Extract API key from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json(
        { code: "UNAUTHORIZED", message: "Missing or invalid authorization" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);

    // Verify credential
    const verified = await verifyCredential(apiKey, orgId);
    if (!verified) {
      return Response.json(
        { code: "UNAUTHORIZED", message: "Invalid API key" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const reading = meterReadingSchema.parse(body);

    // Verify device ID matches
    if (reading.deviceId !== verified.deviceId) {
      return Response.json(
        {
          code: "FORBIDDEN",
          message: "API key does not match this device",
        },
        { status: 403 }
      );
    }

    // Process meter reading
    // Use "system" as userId since this is automated IoT ingestion
    const result = await processMeterReading(
      {
        deviceId: reading.deviceId,
        timestamp: new Date(reading.timestamp),
        rawValue: reading.rawValue,
        rawUnit: reading.rawUnit,
        metadata: reading.metadata,
      },
      orgId,
      "system"
    );

    return Response.json(
      {
        meterReadingId: result.id,
        isDuplicate: result.isDuplicate,
        normalizedQuantity: result.normalizedQuantity,
        normalizedUnit: result.normalizedUnit,
        activityRecordId: result.activityRecordId,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          code: "INVALID_INPUT",
          message: "Invalid request body",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return handleRouteError(error);
  }
}
