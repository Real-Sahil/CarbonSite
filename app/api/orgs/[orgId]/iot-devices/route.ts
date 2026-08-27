import { NextRequest } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import {
  registerDevice,
  listDevices,
} from "@/lib/iot/device-manager";
import type { IoTDeviceType } from "@prisma/client";

const registerDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  deviceType: z.enum([
    "electricity_meter",
    "gas_meter",
    "fuel_pump",
    "water_meter",
  ] as const),
  serialNumber: z.string().min(1).max(255),
  facilityId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = params;
    const user = await requireOrgMember(orgId, "admin", "editor");

    const searchParams = req.nextUrl.searchParams;
    const cursor = searchParams.get("cursor") || undefined;
    const take = Math.min(parseInt(searchParams.get("take") || "50"), 100);

    const devices = await listDevices(orgId, cursor, take);

    return Response.json({
      devices,
      nextCursor: devices.length === take ? devices[devices.length - 1].id : null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = params;
    const user = await requireOrgMember(orgId, "admin");

    const body = await req.json();
    const validatedInput = registerDeviceSchema.parse(body);

    const result = await registerDevice(
      orgId,
      validatedInput,
      user.id
    );

    return Response.json(
      {
        device: result.device,
        credential: {
          credentialId: result.credential.credentialId,
          apiKey: result.credential.apiKey,
          prefix: result.credential.prefix,
          expiresAt: result.credential.expiresAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
