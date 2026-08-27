import { prisma } from "@/lib/db";
import { normalizeUnit } from "@/lib/calculation/units";
import { writeAuditLog } from "@/lib/db/audit";

interface MeterReadingInput {
  deviceId: string;
  timestamp: Date;
  rawValue: number;
  rawUnit: string;
  metadata?: {
    deviceName?: string;
    temperature?: number;
  };
}

interface ProcessedMeterReading {
  id: string;
  isDuplicate: boolean;
  normalizedQuantity: number;
  normalizedUnit: string;
  activityRecordId?: string;
}

const DUPLICATE_WINDOW_MS = 10000;

export async function processMeterReading(
  input: MeterReadingInput,
  orgId: string,
  userId: string
): Promise<ProcessedMeterReading> {
  // Get device
  const device = await prisma.ioTDevice.findFirst({
    where: { id: input.deviceId, organizationId: orgId },
    include: { facility: true },
  });

  if (!device) {
    throw new Error(`IoT device ${input.deviceId} not found in org ${orgId}`);
  }

  if (!device.isActive) {
    throw new Error(`IoT device ${device.id} is inactive`);
  }

  // Check for duplicates: readings within DUPLICATE_WINDOW_MS of existing readings at same device
  const duplicateWindow = new Date(
    input.timestamp.getTime() - DUPLICATE_WINDOW_MS
  );

  const existingReading = await prisma.meterReading.findFirst({
    where: {
      iotDeviceId: input.deviceId,
      timestamp: { gte: duplicateWindow },
    },
    orderBy: { timestamp: "desc" },
  });

  let isDuplicate = false;
  if (existingReading && typeof existingReading.rawValue === "number") {
    const valueDiff = Math.abs(existingReading.rawValue - input.rawValue);
    // Consider it a duplicate if value is within 1% or exactly the same
    if (
      valueDiff === 0 ||
      valueDiff < existingReading.rawValue * 0.01
    ) {
      isDuplicate = true;
    }
  }

  // Normalize unit
  let normalizedQuantity = input.rawValue;
  let normalizedUnit = input.rawUnit;

  try {
    const normalized = normalizeUnit(input.rawValue, input.rawUnit);
    normalizedQuantity = normalized.amount;
    normalizedUnit = normalized.unit;
  } catch (err) {
    console.error(
      `Failed to normalize unit ${input.rawUnit} for device ${device.id}:`,
      err
    );
    normalizedQuantity = input.rawValue;
    normalizedUnit = input.rawUnit;
  }

  // Create meter reading record
  const meterReading = await prisma.meterReading.create({
    data: {
      iotDeviceId: input.deviceId,
      organizationId: orgId,
      timestamp: input.timestamp,
      rawValue: input.rawValue,
      rawUnit: input.rawUnit,
      normalizedQuantity,
      normalizedUnit,
      isDuplicate,
    },
  });

  if (isDuplicate) {
    // Log duplicate detected
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: userId,
      action: "meter_reading.duplicate_detected",
      resourceType: "meter_reading",
      resourceId: meterReading.id,
      metadata: {
        deviceId: input.deviceId,
        rawValue: input.rawValue,
      },
    });
  } else {
    // Log meter reading processed
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: userId,
      action: "meter_reading.processed",
      resourceType: "meter_reading",
      resourceId: meterReading.id,
      metadata: {
        deviceId: input.deviceId,
        normalizedQuantity,
        normalizedUnit,
      },
    });
  }

  return {
    id: meterReading.id,
    isDuplicate,
    normalizedQuantity,
    normalizedUnit,
  };
}

export async function getMeterReadings(
  orgId: string,
  deviceId?: string,
  cursor?: string,
  take: number = 50
) {
  const readings = await prisma.meterReading.findMany({
    where: {
      organizationId: orgId,
      ...(deviceId && { iotDeviceId: deviceId }),
    },
    orderBy: { timestamp: "desc" },
    take,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  return readings;
}
