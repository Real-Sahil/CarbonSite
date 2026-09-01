import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectSupplierAnomalies } from '../supplier-analytics';
import { prisma } from '@/lib/db';

// Mock simple-statistics
vi.mock('simple-statistics', () => ({
  mean: (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length,
  standardDeviation: (arr: number[]) => {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / arr.length;
    return Math.sqrt(variance);
  },
}));

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    fieldSubmission: {
      findMany: vi.fn(),
    },
  },
}));

describe('detectSupplierAnomalies - Edge Cases', () => {
  const orgId = 'org-123';
  const supplierId = 'supp-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Z-score edge cases', () => {
    it('should not flag anomalies when all emission values are identical (stddev = 0)', async () => {
      // All submissions have the same emission value
      const mockSubmissions = [
        {
          id: 'sub-1',
          organizationId: orgId,
          createdAt: new Date('2024-01-01'),
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-2',
          organizationId: orgId,
          createdAt: new Date('2024-01-02'),
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-3',
          organizationId: orgId,
          createdAt: new Date('2024-01-03'),
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
      ];

      vi.mocked(prisma.fieldSubmission.findMany).mockResolvedValue(mockSubmissions as any);

      const anomalies = await detectSupplierAnomalies(orgId, supplierId);

      // Should not flag any value outliers when stddev = 0
      const valueOutliers = anomalies.filter((a) => a.anomalyType === 'value_outlier');
      expect(valueOutliers).toHaveLength(0);
    });

    it('should correctly identify outliers when stddev > 0', async () => {
      // Submissions with one extreme outlier
      const mockSubmissions = [
        {
          id: 'sub-1',
          organizationId: orgId,
          createdAt: new Date('2024-01-01'),
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-2',
          organizationId: orgId,
          createdAt: new Date('2024-01-02'),
          formData: { normalizedAmount: 105 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-3',
          organizationId: orgId,
          createdAt: new Date('2024-01-03'),
          formData: { normalizedAmount: 102 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-4',
          organizationId: orgId,
          createdAt: new Date('2024-01-04'),
          formData: { normalizedAmount: 98 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-5',
          organizationId: orgId,
          createdAt: new Date('2024-01-05'),
          formData: { normalizedAmount: 101 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-6',
          organizationId: orgId,
          createdAt: new Date('2024-01-06'),
          formData: { normalizedAmount: 1000 }, // Clear outlier (z-score > 2)
          ocrExtractedData: null,
        },
      ];

      vi.mocked(prisma.fieldSubmission.findMany).mockResolvedValue(mockSubmissions as any);

      const anomalies = await detectSupplierAnomalies(orgId, supplierId);

      // Should flag the outlier (1000 vs ~100)
      const valueOutliers = anomalies.filter((a) => a.anomalyType === 'value_outlier');
      expect(valueOutliers.length).toBeGreaterThan(0);
      expect(valueOutliers[0].submissionId).toBe('sub-6');
    });

    it('should skip submissions with missing or zero emission values', async () => {
      // Mix of valid and invalid values
      const mockSubmissions = [
        {
          id: 'sub-1',
          organizationId: orgId,
          createdAt: new Date('2024-01-01'),
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-2',
          organizationId: orgId,
          createdAt: new Date('2024-01-02'),
          formData: null, // No formData
          ocrExtractedData: null,
        },
        {
          id: 'sub-3',
          organizationId: orgId,
          createdAt: new Date('2024-01-03'),
          formData: { normalizedAmount: 0 }, // Zero value
          ocrExtractedData: null,
        },
        {
          id: 'sub-4',
          organizationId: orgId,
          createdAt: new Date('2024-01-04'),
          formData: { normalizedAmount: 102 },
          ocrExtractedData: null,
        },
      ];

      vi.mocked(prisma.fieldSubmission.findMany).mockResolvedValue(mockSubmissions as any);

      const anomalies = await detectSupplierAnomalies(orgId, supplierId);

      // Should only have 2 valid values (100 and 102), not enough for anomaly detection
      expect(anomalies.filter((a) => a.anomalyType === 'value_outlier')).toHaveLength(0);
    });

    it('should handle extraction from ocrExtractedData when formData is missing', async () => {
      // OCR data fallback
      const mockSubmissions = [
        {
          id: 'sub-1',
          organizationId: orgId,
          createdAt: new Date('2024-01-01'),
          formData: null,
          ocrExtractedData: { weight: 100 },
        },
        {
          id: 'sub-2',
          organizationId: orgId,
          createdAt: new Date('2024-01-02'),
          formData: null,
          ocrExtractedData: { weight: 105 },
        },
        {
          id: 'sub-3',
          organizationId: orgId,
          createdAt: new Date('2024-01-03'),
          formData: null,
          ocrExtractedData: { weight: 102 },
        },
      ];

      vi.mocked(prisma.fieldSubmission.findMany).mockResolvedValue(mockSubmissions as any);

      const anomalies = await detectSupplierAnomalies(orgId, supplierId);

      // Should have extracted values and run anomaly detection
      expect(anomalies).toBeDefined();
      // No anomalies because values are close together
      expect(anomalies.filter((a) => a.anomalyType === 'value_outlier')).toHaveLength(0);
    });
  });

  describe('Frequency anomaly edge cases', () => {
    it('should not flag frequency anomalies when all intervals are identical (intervalStddev = 0)', async () => {
      // Regular submissions every 24 hours
      const mockSubmissions = [
        {
          id: 'sub-1',
          organizationId: orgId,
          createdAt: new Date('2024-01-04T10:00:00Z'),
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-2',
          organizationId: orgId,
          createdAt: new Date('2024-01-03T10:00:00Z'),
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-3',
          organizationId: orgId,
          createdAt: new Date('2024-01-02T10:00:00Z'),
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-4',
          organizationId: orgId,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
      ];

      vi.mocked(prisma.fieldSubmission.findMany).mockResolvedValue(mockSubmissions as any);

      const anomalies = await detectSupplierAnomalies(orgId, supplierId);

      // Should not flag frequency anomalies because intervals are consistent
      const frequencyAnomalies = anomalies.filter((a) => a.anomalyType === 'frequency_anomaly');
      expect(frequencyAnomalies).toHaveLength(0);
    });

    it('should flag frequency anomalies when submission interval changes drastically', async () => {
      // Regular submissions then sudden long gap
      const mockSubmissions = [
        {
          id: 'sub-1',
          organizationId: orgId,
          createdAt: new Date('2024-04-03T10:00:00Z'), // 100-day gap
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-2',
          organizationId: orgId,
          createdAt: new Date('2023-12-24T10:00:00Z'), // 1-day gap
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-3',
          organizationId: orgId,
          createdAt: new Date('2023-12-23T10:00:00Z'), // 1-day gap
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-4',
          organizationId: orgId,
          createdAt: new Date('2023-12-22T10:00:00Z'), // 1-day gap
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
      ];

      vi.mocked(prisma.fieldSubmission.findMany).mockResolvedValue(mockSubmissions as any);

      const anomalies = await detectSupplierAnomalies(orgId, supplierId);

      // Should flag the 45-day gap as a frequency anomaly
      const frequencyAnomalies = anomalies.filter((a) => a.anomalyType === 'frequency_anomaly');
      expect(frequencyAnomalies.length).toBeGreaterThan(0);
      if (frequencyAnomalies.length > 0) {
        expect(frequencyAnomalies[0].submissionId).toBe('sub-1');
      }
    });
  });

  describe('Minimum data requirements', () => {
    it('should return no anomalies if fewer than 3 valid emission values', async () => {
      // Only 2 submissions with valid values
      const mockSubmissions = [
        {
          id: 'sub-1',
          organizationId: orgId,
          createdAt: new Date('2024-01-01'),
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
        {
          id: 'sub-2',
          organizationId: orgId,
          createdAt: new Date('2024-01-02'),
          formData: { normalizedAmount: 105 },
          ocrExtractedData: null,
        },
      ];

      vi.mocked(prisma.fieldSubmission.findMany).mockResolvedValue(mockSubmissions as any);

      const anomalies = await detectSupplierAnomalies(orgId, supplierId);

      // Should return empty (insufficient data for z-score detection)
      expect(anomalies).toHaveLength(0);
    });

    it('should return no anomalies for submissions < 2 submissions (frequency check requires 2+)', async () => {
      // Only 1 submission
      const mockSubmissions = [
        {
          id: 'sub-1',
          organizationId: orgId,
          createdAt: new Date('2024-01-01'),
          formData: { normalizedAmount: 100 },
          ocrExtractedData: null,
        },
      ];

      vi.mocked(prisma.fieldSubmission.findMany).mockResolvedValue(mockSubmissions as any);

      const anomalies = await detectSupplierAnomalies(orgId, supplierId);

      // Should return empty
      expect(anomalies).toHaveLength(0);
    });
  });
});
