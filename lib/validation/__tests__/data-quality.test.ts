import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateImportBatch,
  saveQualityCheckResults,
} from '@/lib/validation/data-quality';

vi.mock('@/lib/db', () => ({
  prisma: {
    dataQualityCheck: {
      create: vi.fn().mockResolvedValue({}),
    },
    importBatchQualityScore: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Data Quality Validation', () => {
  describe('validateImportBatch', () => {
    it('should pass all checks for valid records', async () => {
      const records = [
        {
          rowNumber: 1,
          normalizedAmount: 100,
          normalizedUnit: 'kg',
          activityDate: new Date('2026-08-15'),
          emissionCategoryId: 's1-stationary',
          createdAt: new Date('2026-08-20'),
        },
        {
          rowNumber: 2,
          normalizedAmount: 250.5,
          normalizedUnit: 'tonnes',
          activityDate: new Date('2025-01-16'),
          emissionCategoryId: 's2-electricity-lb',
          createdAt: new Date('2026-08-20'),
        },
      ];

      const results = await validateImportBatch('batch-1', 'org-1', records);
      
      // All checks should pass
      expect(results.every((r) => r.passed)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should fail for negative weights', async () => {
      const records = [
        {
          rowNumber: 1,
          normalizedAmount: -100,
          normalizedUnit: 'kg',
          activityDate: new Date('2026-08-15'),
          emissionCategoryId: 's1-stationary',
          createdAt: new Date('2026-08-20'),
        },
      ];

      const results = await validateImportBatch('batch-1', 'org-1', records);
      const weightCheck = results.find((r) => r.type === 'weight_range');
      
      expect(weightCheck?.passed).toBe(false);
      expect(weightCheck?.failures).toBeDefined();
      expect(weightCheck?.failures?.length).toBeGreaterThan(0);
    });

    it('should fail for invalid units', async () => {
      const records = [
        {
          rowNumber: 1,
          normalizedAmount: 100,
          normalizedUnit: 'invalid_unit',
          activityDate: new Date('2026-08-15'),
          emissionCategoryId: 's1-stationary',
          createdAt: new Date('2026-08-20'),
        },
      ];

      const results = await validateImportBatch('batch-1', 'org-1', records);
      const unitCheck = results.find((r) => r.type === 'unit_validity');
      
      expect(unitCheck?.passed).toBe(false);
    });

    it('should fail for future activity dates', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const records = [
        {
          rowNumber: 1,
          normalizedAmount: 100,
          normalizedUnit: 'kg',
          activityDate: futureDate,
          emissionCategoryId: 's1-stationary',
          createdAt: new Date(),
        },
      ];

      const results = await validateImportBatch('batch-1', 'org-1', records);
      const dateCheck = results.find((r) => r.type === 'date_range');
      
      expect(dateCheck?.passed).toBe(false);
    });

    it('should fail for missing emission categories', async () => {
      const records = [
        {
          rowNumber: 1,
          normalizedAmount: 100,
          normalizedUnit: 'kg',
          activityDate: new Date('2026-08-15'),
          emissionCategoryId: null,
          createdAt: new Date('2026-08-20'),
        },
      ];

      const results = await validateImportBatch('batch-1', 'org-1', records);
      const completenessCheck = results.find((r) => r.type === 'completeness');
      
      expect(completenessCheck?.passed).toBe(false);
    });

    it('should fail for zero records', async () => {
      const results = await validateImportBatch('batch-1', 'org-1', []);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => !r.passed)).toBe(true);
    });

    it('should fail for too many records', async () => {
      const records = Array.from({ length: 150000 }, (_, idx) => ({
        rowNumber: idx + 1,
        normalizedAmount: 100,
        normalizedUnit: 'kg',
        activityDate: new Date('2025-01-15'),
        emissionCategoryId: 's1-stationary',
        createdAt: new Date('2025-01-20'),
      }));

      const results = await validateImportBatch('batch-1', 'org-1', records);
      const volumeCheck = results.find((r) => r.type === 'volume');
      
      expect(volumeCheck?.passed).toBe(false);
    });

    it('should handle mixed valid and invalid records', async () => {
      const records = [
        {
          rowNumber: 1,
          normalizedAmount: 100,
          normalizedUnit: 'kg',
          activityDate: new Date('2026-08-15'),
          emissionCategoryId: 's1-stationary',
          createdAt: new Date('2026-08-20'),
        },
        {
          rowNumber: 2,
          normalizedAmount: -50,
          normalizedUnit: 'invalid',
          activityDate: new Date('2026-12-31'),
          emissionCategoryId: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      const results = await validateImportBatch('batch-1', 'org-1', records);
      
      // Should have failures in weight, unit, and completeness checks
      const weightCheck = results.find((r) => r.type === 'weight_range');
      const unitCheck = results.find((r) => r.type === 'unit_validity');
      const completenessCheck = results.find((r) => r.type === 'completeness');
      
      expect(weightCheck?.passed).toBe(false);
      expect(unitCheck?.passed).toBe(false);
      expect(completenessCheck?.passed).toBe(false);
    });

    it('should limit failure samples to 5', async () => {
      const records = Array.from({ length: 20 }, (_, idx) => ({
        rowNumber: idx + 1,
        normalizedAmount: -100 - idx, // All negative
        normalizedUnit: 'kg',
        activityDate: new Date('2025-01-15'),
        emissionCategoryId: 's1-stationary',
        createdAt: new Date('2025-01-20'),
      }));

      const results = await validateImportBatch('batch-1', 'org-1', records);
      const weightCheck = results.find((r) => r.type === 'weight_range');
      
      expect(weightCheck?.failures?.length).toBeLessThanOrEqual(5);
    });
  });

  describe('saveQualityCheckResults', () => {
    it('should calculate overall score correctly', async () => {
      const checks = [
        { type: 'weight_range', name: 'Weight', passed: true, failures: [] },
        { type: 'unit_validity', name: 'Unit', passed: true, failures: [] },
        { type: 'date_range', name: 'Date', passed: false, failures: [{ rowNumber: 1, field: 'date', value: 'invalid', expected: 'valid' }] },
        { type: 'completeness', name: 'Complete', passed: true, failures: [] },
      ];

      const result = await saveQualityCheckResults('batch-1', 'org-1', checks);
      
      // 3 out of 4 passed = 75%
      expect(result.overallScore).toBe(75);
      expect(result.canCommit).toBe(false); // Below 80% threshold
    });

    it('should set canCommit=true for scores >= 80%', async () => {
      const checks = [
        { type: 'weight_range', name: 'Weight', passed: true, failures: [] },
        { type: 'unit_validity', name: 'Unit', passed: true, failures: [] },
        { type: 'date_range', name: 'Date', passed: true, failures: [] },
        { type: 'completeness', name: 'Complete', passed: true, failures: [] },
        { type: 'freshness', name: 'Fresh', passed: false, failures: [{ rowNumber: 1, field: 'date', value: 'old', expected: 'recent' }] },
      ];

      const result = await saveQualityCheckResults('batch-1', 'org-1', checks);
      
      // 4 out of 5 passed = 80%
      expect(result.overallScore).toBe(80);
      expect(result.canCommit).toBe(true);
    });
  });
});
