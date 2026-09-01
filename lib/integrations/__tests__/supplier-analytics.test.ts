import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  calculateSupplierScore,
  forecastSupplierEmissions,
  detectSupplierAnomalies,
  getSupplierAnalytics,
  updateSupplierAnalytics,
} from '../supplier-analytics';
import { prisma } from '@/lib/db';

// Mock data helpers
const testOrgId = 'test-org-123';
const testSupplierId = 'supplier-456';

describe('Supplier Analytics', () => {
  describe('calculateSupplierScore', () => {
    it('returns zero scores for supplier with no submissions', async () => {
      vi.spyOn(prisma.supplierAnalytic, 'findUnique').mockResolvedValueOnce(null);
      vi.spyOn(prisma.fieldSubmission, 'findMany').mockResolvedValueOnce([]);

      const score = await calculateSupplierScore(testOrgId, testSupplierId);

      expect(score.submissionCount).toBe(0);
      expect(score.overallScore).toBe(0);
      expect(score.approvalRate).toBe(0);
      expect(score.completenessScore).toBe(0);
      expect(score.timelinessScore).toBe(0);
    });

    it('calculates approval rate correctly', async () => {
      const mockSubmissions = [
        {
          id: 'sub-1',
          organizationId: testOrgId,
          supplierId: testSupplierId,
          status: 'approved',
          createdAt: new Date(),
          formData: { normalizedAmount: 100, activityDate: new Date(), emissionCategoryId: 's3-purchased-goods' },
          ocrExtractedData: {},
          submittedAt: new Date(),
          requestedByDeadline: new Date(),
        },
        {
          id: 'sub-2',
          organizationId: testOrgId,
          supplierId: testSupplierId,
          status: 'approved',
          createdAt: new Date(),
          formData: { normalizedAmount: 150, activityDate: new Date(), emissionCategoryId: 's3-purchased-goods' },
          ocrExtractedData: {},
          submittedAt: new Date(),
          requestedByDeadline: new Date(),
        },
        {
          id: 'sub-3',
          organizationId: testOrgId,
          supplierId: testSupplierId,
          status: 'rejected',
          createdAt: new Date(),
          formData: { normalizedAmount: 80, activityDate: new Date(), emissionCategoryId: 's3-purchased-goods' },
          ocrExtractedData: {},
          submittedAt: new Date(),
          requestedByDeadline: new Date(),
        },
      ];

      vi.spyOn(prisma.fieldSubmission, 'findMany').mockResolvedValueOnce(mockSubmissions as any);
      vi.spyOn(prisma.supplierAnalytic, 'findUnique').mockResolvedValueOnce(null); // Previous score lookup

      const score = await calculateSupplierScore(testOrgId, testSupplierId);

      expect(score.submissionCount).toBe(3);
      expect(score.approvalRate).toBe(2 / 3); // 2 approved out of 3
      expect(score.overallScore).toBeGreaterThan(0);
      expect(score.overallScore).toBeLessThanOrEqual(100);
    });

    it('detects trend improvements', async () => {
      const now = new Date();

      const mockSubmissions = [
        // Recent submissions: 80% approval (4/5)
        { id: 'sub-1', organizationId: testOrgId, supplierId: testSupplierId, status: 'approved', createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), formData: { normalizedAmount: 100 }, ocrExtractedData: {}, submittedAt: new Date(), requestedByDeadline: new Date() },
        { id: 'sub-2', organizationId: testOrgId, supplierId: testSupplierId, status: 'approved', createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), formData: { normalizedAmount: 100 }, ocrExtractedData: {}, submittedAt: new Date(), requestedByDeadline: new Date() },
        { id: 'sub-3', organizationId: testOrgId, supplierId: testSupplierId, status: 'approved', createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), formData: { normalizedAmount: 100 }, ocrExtractedData: {}, submittedAt: new Date(), requestedByDeadline: new Date() },
        { id: 'sub-4', organizationId: testOrgId, supplierId: testSupplierId, status: 'approved', createdAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000), formData: { normalizedAmount: 100 }, ocrExtractedData: {}, submittedAt: new Date(), requestedByDeadline: new Date() },
        { id: 'sub-5', organizationId: testOrgId, supplierId: testSupplierId, status: 'rejected', createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), formData: { normalizedAmount: 100 }, ocrExtractedData: {}, submittedAt: new Date(), requestedByDeadline: new Date() },
        // Prior submissions: 40% approval (2/5)
        { id: 'sub-6', organizationId: testOrgId, supplierId: testSupplierId, status: 'approved', createdAt: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000), formData: { normalizedAmount: 100 }, ocrExtractedData: {}, submittedAt: new Date(), requestedByDeadline: new Date() },
        { id: 'sub-7', organizationId: testOrgId, supplierId: testSupplierId, status: 'rejected', createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), formData: { normalizedAmount: 100 }, ocrExtractedData: {}, submittedAt: new Date(), requestedByDeadline: new Date() },
        { id: 'sub-8', organizationId: testOrgId, supplierId: testSupplierId, status: 'rejected', createdAt: new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000), formData: { normalizedAmount: 100 }, ocrExtractedData: {}, submittedAt: new Date(), requestedByDeadline: new Date() },
        { id: 'sub-9', organizationId: testOrgId, supplierId: testSupplierId, status: 'rejected', createdAt: new Date(now.getTime() - 80 * 24 * 60 * 60 * 1000), formData: { normalizedAmount: 100 }, ocrExtractedData: {}, submittedAt: new Date(), requestedByDeadline: new Date() },
        { id: 'sub-10', organizationId: testOrgId, supplierId: testSupplierId, status: 'approved', createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), formData: { normalizedAmount: 100 }, ocrExtractedData: {}, submittedAt: new Date(), requestedByDeadline: new Date() },
      ];

      // Mock previous analytic with lower score to show improvement
      const mockAnalytic = { overallScore: 30 } as any;

      vi.spyOn(prisma.fieldSubmission, 'findMany').mockResolvedValueOnce(mockSubmissions as any);
      vi.spyOn(prisma.supplierAnalytic, 'findUnique').mockResolvedValueOnce(mockAnalytic);

      const score = await calculateSupplierScore(testOrgId, testSupplierId);

      expect(score.trend).toBe('improving');
      expect(score.scoreChange).toBeGreaterThan(5);
    });
  });

  describe('forecastSupplierEmissions', () => {
    it('returns default forecast for supplier with no historical data', async () => {
      vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValueOnce([]);

      const forecast = await forecastSupplierEmissions(testOrgId, testSupplierId);

      expect(forecast.supplierId).toBe(testSupplierId);
      expect(forecast.forecastedEmissions).toHaveLength(12);
      expect(forecast.forecastedEmissions.every((e) => e === 0)).toBe(true);
      expect(forecast.confidenceScore).toBe(0.3);
    });

    it('generates 12-month forecast with confidence intervals', async () => {
      // Mock quarterly spend data
      const mockData = [
        { totalSpendGbp: 10000, sameQuarterLastYear: 9000, yoyGrowth: 0.11 },
        { totalSpendGbp: 12000, sameQuarterLastYear: 10000, yoyGrowth: 0.2 },
        { totalSpendGbp: 11000, sameQuarterLastYear: 10500, yoyGrowth: 0.048 },
        { totalSpendGbp: 13000, sameQuarterLastYear: 11000, yoyGrowth: 0.182 },
      ];

      vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValueOnce(mockData);

      const forecast = await forecastSupplierEmissions(testOrgId, testSupplierId, 12);

      expect(forecast.supplierId).toBe(testSupplierId);
      expect(forecast.forecastedEmissions).toHaveLength(12);
      expect(forecast.confidenceScore).toBeGreaterThan(0.3);
      expect(forecast.confidenceInterval.lower).toHaveLength(12);
      expect(forecast.confidenceInterval.upper).toHaveLength(12);

      // All forecasts should be positive
      forecast.forecastedEmissions.forEach((forecast) => {
        expect(forecast).toBeGreaterThanOrEqual(0);
      });

      // Lower bounds should be less than or equal to forecasts
      forecast.forecastedEmissions.forEach((f, i) => {
        expect(forecast.confidenceInterval.lower[i]).toBeLessThanOrEqual(f);
        expect(forecast.confidenceInterval.upper[i]).toBeGreaterThanOrEqual(f);
      });
    });
  });

  describe('detectSupplierAnomalies', () => {
    it('returns empty anomalies for supplier with insufficient data', async () => {
      vi.spyOn(prisma.fieldSubmission, 'findMany').mockResolvedValueOnce([]);

      const anomalies = await detectSupplierAnomalies(testOrgId, testSupplierId);

      expect(anomalies).toEqual([]);
    });

    it('detects value outliers using Z-score', async () => {
      const baseDate = new Date();
      const mockSubmissions = [
        { id: 'sub-1', organizationId: testOrgId, supplierId: testSupplierId, createdAt: new Date(baseDate.getTime() - 0), formData: { normalizedAmount: 100 }, ocrExtractedData: {} },
        { id: 'sub-2', organizationId: testOrgId, supplierId: testSupplierId, createdAt: new Date(baseDate.getTime() - 1000000), formData: { normalizedAmount: 105 }, ocrExtractedData: {} },
        { id: 'sub-3', organizationId: testOrgId, supplierId: testSupplierId, createdAt: new Date(baseDate.getTime() - 2000000), formData: { normalizedAmount: 95 }, ocrExtractedData: {} },
        { id: 'sub-4', organizationId: testOrgId, supplierId: testSupplierId, createdAt: new Date(baseDate.getTime() - 2500000), formData: { normalizedAmount: 98 }, ocrExtractedData: {} },
        { id: 'sub-5', organizationId: testOrgId, supplierId: testSupplierId, createdAt: new Date(baseDate.getTime() - 3000000), formData: { normalizedAmount: 101 }, ocrExtractedData: {} },
        { id: 'sub-6', organizationId: testOrgId, supplierId: testSupplierId, createdAt: new Date(baseDate.getTime() - 3500000), formData: { normalizedAmount: 1000 }, ocrExtractedData: {} }, // Outlier
      ];

      vi.spyOn(prisma.fieldSubmission, 'findMany').mockResolvedValueOnce(mockSubmissions as any);

      const anomalies = await detectSupplierAnomalies(testOrgId, testSupplierId, 2);

      expect(anomalies.length).toBeGreaterThan(0);
      const valueOutliers = anomalies.filter((a) => a.anomalyType === 'value_outlier');
      expect(valueOutliers.length).toBeGreaterThan(0);
      expect(valueOutliers[0].severity).toBeDefined();
    });

    it('detects frequency anomalies in submission patterns', async () => {
      const now = new Date();
      const dayMs = 1000 * 60 * 60 * 24;
      const mockSubmissions = [
        { id: 'sub-1', organizationId: testOrgId, supplierId: testSupplierId, createdAt: new Date(now.getTime() - 1 * dayMs), formData: { normalizedAmount: 100 }, ocrExtractedData: {} }, // 1 day ago
        { id: 'sub-2', organizationId: testOrgId, supplierId: testSupplierId, createdAt: new Date(now.getTime() - 2 * dayMs), formData: { normalizedAmount: 100 }, ocrExtractedData: {} }, // 2 days ago (1 day interval)
        { id: 'sub-3', organizationId: testOrgId, supplierId: testSupplierId, createdAt: new Date(now.getTime() - 3 * dayMs), formData: { normalizedAmount: 100 }, ocrExtractedData: {} }, // 3 days ago (1 day interval)
        { id: 'sub-4', organizationId: testOrgId, supplierId: testSupplierId, createdAt: new Date(now.getTime() - 203 * dayMs), formData: { normalizedAmount: 100 }, ocrExtractedData: {} }, // 203 days ago (200 day interval - anomaly)
      ];

      vi.spyOn(prisma.fieldSubmission, 'findMany').mockResolvedValueOnce(mockSubmissions as any);

      const anomalies = await detectSupplierAnomalies(testOrgId, testSupplierId, 2);

      const frequencyAnomalies = anomalies.filter((a) => a.anomalyType === 'frequency_anomaly');
      expect(frequencyAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('getSupplierAnalytics', () => {
    it('retrieves supplier analytics with filters', async () => {
      const mockAnalytics = [
        {
          id: 'analytics-1',
          organizationId: testOrgId,
          supplierId: testSupplierId,
          overallScore: 85,
          trend: 'improving',
        },
      ];

      vi.spyOn(prisma.supplierAnalytic, 'findMany').mockResolvedValueOnce(mockAnalytics as any);

      const analytics = await getSupplierAnalytics(testOrgId, { minScore: 80, trend: 'improving' });

      expect(analytics).toHaveLength(1);
      expect(analytics[0].overallScore).toBe(85);
    });
  });

  describe('updateSupplierAnalytics', () => {
    it('creates or updates analytics record', async () => {
      vi.spyOn(prisma.fieldSubmission, 'findMany').mockResolvedValueOnce([
        {
          id: 'sub-1',
          organizationId: testOrgId,
          supplierId: testSupplierId,
          status: 'approved',
          createdAt: new Date(),
          formData: { normalizedAmount: 100, activityDate: new Date(), emissionCategoryId: 's3-purchased-goods' },
          ocrExtractedData: {},
          submittedAt: new Date(),
          requestedByDeadline: new Date(),
        },
      ] as any);

      vi.spyOn(prisma.supplierAnalytic, 'findUnique').mockResolvedValueOnce(null);
      vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValueOnce([]);

      const mockUpsert = vi.spyOn(prisma.supplierAnalytic, 'upsert').mockResolvedValueOnce({
        id: 'analytics-1',
        organizationId: testOrgId,
        supplierId: testSupplierId,
        overallScore: 100,
        forecastedEmissions: 0.5,
      } as any);

      await updateSupplierAnalytics(testOrgId, testSupplierId);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId_supplierId: { organizationId: testOrgId, supplierId: testSupplierId },
          }),
        })
      );
    });
  });
});
