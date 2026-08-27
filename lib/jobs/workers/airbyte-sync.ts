import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import type { Job } from 'pg-boss';
import type { AirbyteSyncJobData } from '@/lib/jobs/queues';

export async function processAirbyteSyncCompletion(connectionId: string) {
  const connection = await prisma.airbyteSyncConnection.findUniqueOrThrow({
    where: { id: connectionId },
    include: { organization: true }
  });

  const orgId = connection.organizationId;

  // 1. Fetch unprocessed synced data from staged_external_data
  const stagedData = await prisma.stagedExternalData.findMany({
    where: {
      organizationId: orgId,
      sourceSystem: connection.sourceSystem,
      processed: false
    },
    take: 10000
  });

  if (stagedData.length === 0) {
    console.log(`No unprocessed data for Airbyte sync: ${connectionId}`);
    return;
  }

  // 2. Transform staged data into ActivityRecord schema
  const records = stagedData
    .map((row) => {
      try {
        // Extract common fields from payload
        const payload = row.payload as Record<string, unknown>;

        // Get or find the emission category
        const categoryMapping: Record<string, string> = {
          facility_spend: 's3-purchased-goods',
          material_cost: 's3-purchased-goods',
          energy_consumption: 's2-electricity-mb',
          waste_volume: 's1-stationary',
          fuel_consumption: 's1-mobile'
        };

        const emissionCategoryId = categoryMapping[row.dataType] || 's3-purchased-goods';

        // Calculate normalized amount and unit based on data type
        let normalizedAmount = 0;
        let normalizedUnit = '';
        let originalUnit = '';

        if (row.dataType === 'facility_spend') {
          // Convert GBP spend to estimated CO2e using rough conversion factor
          normalizedAmount = (payload.spend_gbp || 0) * 0.4; // ~0.4 tonnes per £100
          normalizedUnit = 'tonnes';
          originalUnit = 'GBP';
        } else if (row.dataType === 'energy_consumption') {
          normalizedAmount = payload.kwh || 0;
          normalizedUnit = 'kwh';
          originalUnit = 'kwh';
        } else if (row.dataType === 'waste_volume') {
          normalizedAmount = payload.tonnes || (payload.kg ? (payload.kg || 0) / 1000 : 0);
          normalizedUnit = 'tonnes';
          originalUnit = payload.kg ? 'kg' : 'tonnes';
        } else {
          // Generic numeric value
          normalizedAmount = payload.amount || 0;
          normalizedUnit = payload.unit || 'units';
          originalUnit = payload.unit || 'units';
        }

        return {
          organizationId: orgId,
          emissionCategoryId,
          originalAmount: payload.amount || 0,
          originalUnit,
          normalizedAmount: new Decimal(normalizedAmount.toString()),
          normalizedUnit,
          sourceDescription: `${connection.sourceSystem}: ${row.sourceRecordId}`,
          activityDate: new Date(row.extractedAt),
          reviewStatus: 'approved' as const, // External data pre-approved
          facilityId: payload.facility_id,
          businessUnitId: payload.business_unit_id,
          supplierName: payload.supplier_name,
          country: payload.country,
          region: payload.region,
          reportingPeriodId: payload.reporting_period_id || '', // Will be set by importer
          createdAt: new Date(),
          updatedAt: new Date()
        };
      } catch (error) {
        console.error(`Error transforming Airbyte record ${row.id}:`, error);
        return null;
      }
    })
    .filter((r) => r !== null);

  if (records.length === 0) {
    console.log(`No valid records to import after transformation: ${connectionId}`);
    // Mark all as processed anyway to avoid re-processing on next sync
    await prisma.stagedExternalData.updateMany({
      where: { id: { in: stagedData.map((d) => d.id) } },
      data: { processed: true, processedAt: new Date() }
    });
    return;
  }

  // 3. Create import batch for these records (if reporting period specified)
  const reportingPeriodId = (stagedData[0].payload as Record<string, unknown>)?.reporting_period_id;

  if (reportingPeriodId) {
    await prisma.importBatch.create({
      data: {
        organizationId: orgId,
        reportingPeriodId,
        templateKey: 'airbyte-import',
        state: 'committed',
        sourceFilename: `${connection.sourceSystem}-sync-${new Date().toISOString()}`,
        sourceStorageKey: `org/${orgId}/imports/airbyte-sync`,
        sourceChecksum: Buffer.from(JSON.stringify(stagedData)).toString('hex'),
        rowCount: records.length,
        errorCount: 0,
        warningCount: 0,
        mapping: {
          source: connection.sourceSystem,
          connectionId: connection.id,
          stagedRecordIds: stagedData.map((d) => d.id)
        }
      }
    });

    // 4. Bulk insert activity records
    try {
      const recordsToCreate = records.map((r) => ({
        ...r,
        reportingPeriodId: reportingPeriodId as string,
        amount: r.normalizedAmount,
        unit: r.normalizedUnit,
        createdByUserId: null
      }));

      await prisma.activityRecord.createMany({
        data: recordsToCreate as Parameters<typeof prisma.activityRecord.createMany>[0]['data']
      });

      // 5. Mark staged data as processed
      await prisma.stagedExternalData.updateMany({
        where: { id: { in: stagedData.map((d) => d.id) } },
        data: { processed: true, processedAt: new Date() }
      });

      // 6. Update connection last sync status
      await prisma.airbyteSyncConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'success'
        }
      });

      console.log(`✓ Imported ${records.length} records from Airbyte sync: ${connectionId}`);
    } catch (error) {
      // Update connection with failed status
      await prisma.airbyteSyncConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'failed'
        }
      });

      throw new Error(`Failed to import Airbyte records: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.warn(`No reporting period specified for Airbyte sync: ${connectionId}`);
    // Mark as processed anyway
    await prisma.stagedExternalData.updateMany({
      where: { id: { in: stagedData.map((d) => d.id) } },
      data: { processed: true, processedAt: new Date() }
    });
  }
}

export async function handleAirbyteSyncJob(job: Job<AirbyteSyncJobData>) {
  const { connectionId } = job.data;
  console.log(`[airbyte-sync] processing connection ${connectionId}`);
  await processAirbyteSyncCompletion(connectionId);
  console.log(`[airbyte-sync] finished connection ${connectionId}`);
}
