import { NextRequest } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import {
  getDeviceWithCredentials,
  deactivateDevice,
  createCredential,
} from "@/lib/iot/device-manager";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";

type Params = { params: Promise<{ orgId: string; deviceId: string }> };

const updateDeviceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  facilityId: z.string().optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId, deviceId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "viewer");

    const device = await getDeviceWithCredentials(orgId, deviceId);

    if (!device) {
      return Response.json(
        { code: "NOT_FOUND", message: "Device not found" },
        { status: 404 }
      );
    }

    return Response.json({ device });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId, deviceId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const body = await req.json();
    const validatedInput = updateDeviceSchema.parse(body);

    const device = await prisma.ioTDevice.findFirst({
      where: { id: deviceId, organizationId: orgId },
    });

    if (!device) {
      return Response.json(
        { code: "NOT_FOUND", message: "Device not found" },
        { status: 404 }
      );
    }

    // Validate facility if changing it
    if (validatedInput.facilityId !== undefined) {
      if (validatedInput.facilityId !== null) {
        const facility = await prisma.facility.findFirst({
          where: {
            id: validatedInput.facilityId,
            organizationId: orgId,
          },
        });

        if (!facility) {
          return Response.json(
            { code: "INVALID_INPUT", message: "Facility not found" },
            { status: 400 }
          );
        }
      }
    }

    const updated = await prisma.ioTDevice.update({
      where: { id: deviceId },
      data: {
        ...(validatedInput.name && { name: validatedInput.name }),
        ...(validatedInput.facilityId !== undefined && {
          facilityId: validatedInput.facilityId,
        }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "iot_device.updated",
      resourceType: "iot_device",
      resourceId: deviceId,
      metadata: {
        changes: validatedInput,
      },
    });

    return Response.json({ device: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId, deviceId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const device = await prisma.ioTDevice.findFirst({
      where: { id: deviceId, organizationId: orgId },
    });

    if (!device) {
      return Response.json(
        { code: "NOT_FOUND", message: "Device not found" },
        { status: 404 }
      );
    }

    await deactivateDevice(orgId, deviceId, session.user.id);

    return Response.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId, deviceId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const body = await req.json();
    const action = body.action as string;

    if (action !== "create_credential") {
      return Response.json(
        { code: "INVALID_INPUT", message: "Invalid action" },
        { status: 400 }
      );
    }

    const device = await prisma.ioTDevice.findFirst({
      where: { id: deviceId, organizationId: orgId },
    });

    if (!device) {
      return Response.json(
        { code: "NOT_FOUND", message: "Device not found" },
        { status: 404 }
      );
    }

    const credential = await createCredential(orgId, deviceId, session.user.id);

    return Response.json(
      {
        credentialId: credential.credentialId,
        apiKey: credential.apiKey,
        prefix: credential.prefix,
        expiresAt: credential.expiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
