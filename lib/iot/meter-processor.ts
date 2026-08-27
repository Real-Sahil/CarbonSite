import { prisma } from "@/lib/db";
import { normalizeUnit } from "@/lib/calculation/units";
import { selectFactor } from "@/lib/calculation/factor-selector";
import { computeCo2e } from "@/lib/calculation/engine";
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
      timestamp: {
        gte: duplicateWindow,
        lte: new Date(input.timestamp.getTime() + DUPLICATE_WINDOW_MS),
      },
      isDuplicate: false,
    },
    orderBy: { timestamp: "desc" },
  });

  let isDuplicate = false;
  if (existingReading) {
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
    normalizedQuantity = normalized.value;
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

  // If not a duplicate, auto-create activity record
  let activityRecordId: string | undefined;
  if (!isDuplicate) {
    const category = device.emissionCategoryCode;

    // Get reporting period (most recent period that includes this timestamp)
    const period = await prisma.reportingPeriod.findFirst({
      where: {
        organizationId: orgId,
        startDate: { lte: input.timestamp },
        endDate: { gte: input.timestamp },
      },
      orderBy: { endDate: "desc" },
    });

    if (period) {
      try {
        // Select factor
        const factor = await selectFactor({
          category,
          quantity: normalizedQuantity,
          unit: normalizedUnit,
          date: input.timestamp,
          orgId,
          userId,
          source: "iot_device",
        });

        if (factor) {
          // Compute CO2e
          const result = computeCo2e({
            quantity: normalizedQuantity,
            unit: normalizedUnit,
            factor: factor.value,
            factorUnit: factor.factorUnit,
            gas: factor.gas || "CO2e",
            date: input.timestamp,
          });

          // Create activity record
          const activityRecord = await prisma.activityRecord.create({
            data: {
              organizationId: orgId,
              reportingPeriodId: period.id,
              categoryId: category,
              facilityId: device.facilityId,
              quantity: normalizedQuantity,
              unit: normalizedUnit,
              description: `Auto-captured from IoT device: ${device.name} (${device.serialNumber})`,
              co2e: result.co2e,
              ch4: result.ch4,
              n2o: result.n2o,
              emissionFactorLibraryVersionId: factor.libraryVersionId,
              emissionFactorCode: factor.code,
              emissionFactorSource: factor.source,
              factorSelectionReason: factor.selectionReason || "iot_auto",
              formulaString: result.formula,
              reviewStatus: "approved",
              reviewedBy: userId,
              reviewedAt: new Date(),
              createdBy: userId,
            },
          });

          activityRecordId = activityRecord.id;

          // Link meter reading to activity record
          await prisma.meterReading.update({
            where: { id: meterReading.id },
            data: { activityRecordId },
          });

          // Log audit trail
          await writeAuditLog({
            organizationId: orgId,
            actorUserId: userId,
            action: "meter_reading.processed",
            resourceType: "meter_reading",
            resourceId: meterReading.id,
            metadata: {
              device_id: device.id,
              device_name: device.name,
              activity_record_id: activityRecord.id,
              category: category,
              co2e: result.co2e,
            },
          });
        }
      } catch (err) {
        console.error(
          `Failed to auto-create activity record for meter reading ${meterReading.id}:`,
          err
        );
        // Continue even if activity record creation fails; meter reading is still recorded
      }
    }
  } else {
    // Log duplicate detection
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: "system",
      action: "meter_reading.duplicate_detected",
      resourceType: "meter_reading",
      resourceId: meterReading.id,
      metadata: {
        device_id: device.id,
        device_name: device.name,
      },
    });
  }

  // Update device lastReadingAt
  await prisma.ioTDevice.update({
    where: { id: device.id },
    data: { lastReadingAt: input.timestamp },
  });

  return {
    id: meterReading.id,
    isDuplicate,
    normalizedQuantity,
    normalizedUnit,
    activityRecordId,
  };
}

export async function getMeterReadings(
  orgId: string,
  deviceId?: string,
  cursor?: string,
  take: number = 50
) {
  const where = {
    organizationId: orgId,
    ...(deviceId && { iotDeviceId: deviceId }),
  };

  const readings = await prisma.meterReading.findMany({
    where,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    take,
    orderBy: { timestamp: "desc" },
    include: {
      device: { select: { name: true, serialNumber: true, deviceType: true } },
      activityRecord: { select: { id: true, co2e: true } },
    },
  });

  return readings;
}
