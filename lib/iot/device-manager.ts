import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import type { IoTDeviceType } from "@prisma/client";

const KEY_PREFIX_LENGTH = 8;
const CREDENTIAL_EXPIRY_DAYS = 365;

export interface DeviceRegistration {
  name: string;
  deviceType: IoTDeviceType;
  serialNumber: string;
  facilityId?: string;
}

export interface CreateCredentialResponse {
  credentialId: string;
  apiKey: string;
  prefix: string;
  expiresAt: Date;
}

export async function registerDevice(
  orgId: string,
  registration: DeviceRegistration,
  userId: string
) {
  // Validate serial number uniqueness within org
  const existing = await prisma.ioTDevice.findFirst({
    where: {
      organizationId: orgId,
      serialNumber: registration.serialNumber,
    },
  });

  if (existing) {
    throw new Error(
      `Device with serial number ${registration.serialNumber} already exists in this organization`
    );
  }

  // Validate facility if provided
  if (registration.facilityId) {
    const facility = await prisma.facility.findFirst({
      where: {
        id: registration.facilityId,
        organizationId: orgId,
      },
    });

    if (!facility) {
      throw new Error(`Facility ${registration.facilityId} not found`);
    }
  }

  // Determine emission category based on device type
  const categoryMap: Record<IoTDeviceType, string> = {
    electricity_meter: "s2-electricity-lb",
    gas_meter: "s1-stationary",
    fuel_pump: "s1-mobile",
    water_meter: "s3-purchased-goods",
  };

  const device = await prisma.ioTDevice.create({
    data: {
      organizationId: orgId,
      name: registration.name,
      deviceType: registration.deviceType,
      serialNumber: registration.serialNumber,
      facilityId: registration.facilityId,
      emissionCategoryCode: categoryMap[registration.deviceType],
      isActive: true,
    },
  });

  // Create initial credential
  const credential = await createCredential(orgId, device.id, userId);

  await writeAuditLog({
    organizationId: orgId,
    actorUserId: userId,
    action: "iot_device.registered",
    resourceType: "iot_device",
    resourceId: device.id,
    metadata: {
      name: device.name,
      device_type: device.deviceType,
      serial_number: device.serialNumber,
      facility_id: device.facilityId,
    },
  });

  return {
    device,
    credential,
  };
}

export async function createCredential(
  orgId: string,
  deviceId: string,
  userId: string
): Promise<CreateCredentialResponse> {
  // Verify device exists
  const device = await prisma.ioTDevice.findFirst({
    where: {
      id: deviceId,
      organizationId: orgId,
    },
  });

  if (!device) {
    throw new Error(`Device ${deviceId} not found in org ${orgId}`);
  }

  // Generate API key: random bytes formatted as hex
  const apiKeyBytes = randomBytes(32);
  const apiKey = apiKeyBytes.toString("hex");

  // Hash the key
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  // Generate prefix for display (first 8 chars of hash)
  const prefix = keyHash.substring(0, KEY_PREFIX_LENGTH);

  // Set expiry to 1 year from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CREDENTIAL_EXPIRY_DAYS);

  const credential = await prisma.ioTDeviceCredential.create({
    data: {
      iotDeviceId: deviceId,
      organizationId: orgId,
      keyHash,
      prefix,
    },
  });

  await writeAuditLog({
    organizationId: orgId,
    actorUserId: userId,
    action: "iot_credential.created",
    resourceType: "iot_device_credential",
    resourceId: credential.id,
    metadata: {
      device_id: deviceId,
      prefix,
    },
  });

  return {
    credentialId: credential.id,
    apiKey,
    prefix,
    expiresAt,
  };
}

export async function verifyCredential(
  apiKey: string,
  orgId: string
): Promise<{ deviceId: string; organizationId: string } | null> {
  // Hash the provided key
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  // Find credential
  const credential = await prisma.ioTDeviceCredential.findFirst({
    where: {
      keyHash,
      organizationId: orgId,
      revokedAt: null,
    },
  });

  if (!credential) {
    return null;
  }

  // Verify device is active
  const device = await prisma.ioTDevice.findFirst({
    where: {
      id: credential.iotDeviceId,
      organizationId: orgId,
      isActive: true,
    },
  });

  if (!device) {
    return null;
  }

  return {
    deviceId: device.id,
    organizationId: orgId,
  };
}

export async function revokeCredential(
  orgId: string,
  credentialId: string,
  userId: string
) {
  const credential = await prisma.ioTDeviceCredential.findFirst({
    where: {
      id: credentialId,
      organizationId: orgId,
    },
  });

  if (!credential) {
    throw new Error(`Credential ${credentialId} not found`);
  }

  await prisma.ioTDeviceCredential.update({
    where: { id: credentialId },
    data: { revokedAt: new Date() },
  });

  await writeAuditLog({
    organizationId: orgId,
    actorUserId: userId,
    action: "iot_credential.revoked",
    resourceType: "iot_device_credential",
    resourceId: credential.id,
    metadata: {
      device_id: credential.iotDeviceId,
    },
  });
}

export async function deactivateDevice(
  orgId: string,
  deviceId: string,
  userId: string
) {
  const device = await prisma.ioTDevice.findFirst({
    where: {
      id: deviceId,
      organizationId: orgId,
    },
  });

  if (!device) {
    throw new Error(`Device ${deviceId} not found`);
  }

  // Deactivate device
  await prisma.ioTDevice.update({
    where: { id: deviceId },
    data: { isActive: false },
  });

  // Revoke all active credentials
  await prisma.ioTDeviceCredential.updateMany({
    where: {
      iotDeviceId: deviceId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  await writeAuditLog({
    organizationId: orgId,
    actorUserId: userId,
    action: "iot_device.deactivated",
    resourceType: "iot_device",
    resourceId: deviceId,
    metadata: {
      name: device.name,
    },
  });
}

export async function getDeviceWithCredentials(
  orgId: string,
  deviceId: string
) {
  return prisma.ioTDevice.findFirst({
    where: {
      id: deviceId,
      organizationId: orgId,
    },
    include: {
      credentials: {
        where: { revokedAt: null },
        select: {
          id: true,
          prefix: true,
          createdAt: true,
        },
      },
      facility: {
        select: { id: true, name: true },
      },
      readings: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: {
          timestamp: true,
          rawValue: true,
          rawUnit: true,
        },
      },
    },
  });
}

export async function listDevices(
  orgId: string,
  cursor?: string,
  take: number = 50
) {
  const devices = await prisma.ioTDevice.findMany({
    where: { organizationId: orgId },
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    take,
    orderBy: { createdAt: "desc" },
    include: {
      facility: { select: { id: true, name: true } },
      credentials: {
        where: { revokedAt: null },
        select: { id: true },
      },
      _count: {
        select: { readings: true },
      },
    },
  });

  return devices;
}
