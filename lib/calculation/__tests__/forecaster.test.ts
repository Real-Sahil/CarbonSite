import { describe, it, expect } from 'vitest';
import {
  exponentialSmoothing,
  seasonalDecomposition,
  arimaForecast,
  ensembleForecast,
  calculateForecastAccuracy,
} from '../forecaster';

describe('Forecaster', () => {
  describe('exponentialSmoothing', () => {
    it('handles empty data', () => {
      const result = exponentialSmoothing([], 0.3, 0.1, 12);
      expect(result.forecast).toHaveLength(12);
      expect(result.confidence).toBe(0.3);
    });

    it('handles single value', () => {
      const result = exponentialSmoothing([100], 0.3, 0.1, 12);
      expect(result.forecast).toHaveLength(12);
      expect(result.forecast[0]).toBe(100);
    });

    it('forecasts with proper bounds', () => {
      const data = [100, 105, 103, 108, 110, 109, 115, 112, 118, 120, 119, 125];
      const result = exponentialSmoothing(data, 0.3, 0.1, 12);

      expect(result.forecast).toHaveLength(12);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
      expect(result.lowerBound).toBeDefined();
      expect(result.upperBound).toBeDefined();

      // Lower bounds should be less than or equal to forecasts
      result.forecast.forEach((f, i) => {
        expect(result.lowerBound![i]).toBeLessThanOrEqual(f);
        expect(result.upperBound![i]).toBeGreaterThanOrEqual(f);
      });
    });

    it('detects increasing trend', () => {
      const data = Array.from({ length: 12 }, (_, i) => 100 + i * 5);
      const result = exponentialSmoothing(data, 0.3, 0.1, 12);

      // Forecast should continue upward trend
      expect(result.forecast[11]).toBeGreaterThan(result.forecast[0]);
    });

    it('detects decreasing trend', () => {
      const data = Array.from({ length: 12 }, (_, i) => 200 - i * 5);
      const result = exponentialSmoothing(data, 0.3, 0.1, 12);

      // Forecast should continue downward trend
      expect(result.forecast[11]).toBeLessThan(result.forecast[0]);
    });
  });

  describe('seasonalDecomposition', () => {
    it('decomposes seasonal data', () => {
      // Create 24-month data with clear seasonality (summer peak)
      const data = Array.from({ length: 24 }, (_, i) => {
        const month = i % 12;
        const seasonal = month >= 5 && month <= 8 ? 30 : 0; // Summer peak
        return 100 + seasonal + Math.random() * 10;
      });

      const result = seasonalDecomposition(data, 12);

      expect(result.trend).toHaveLength(24);
      expect(result.seasonal).toHaveLength(12);
      expect(result.residual).toHaveLength(24);

      // Trend should be smoother than original
      const trendStddev = Math.sqrt(result.trend.reduce((sum, t, i) => sum + Math.pow(t - data[i], 2), 0) / data.length);
      expect(trendStddev).toBeLessThan(50);
    });

    it('handles short seasonality', () => {
      const data = Array.from({ length: 12 }, (_, i) => 100 + Math.random() * 20);
      const result = seasonalDecomposition(data, 4);

      expect(result.trend).toHaveLength(12);
      expect(result.seasonal).toHaveLength(4);
      expect(result.residual).toHaveLength(12);
    });
  });

  describe('arimaForecast', () => {
    it('handles minimal data', () => {
      const result = arimaForecast([100, 105], 12);
      expect(result.forecast).toHaveLength(12);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('generates forecasts with confidence intervals', () => {
      const data = [100, 102, 104, 105, 107, 108, 110, 112, 113, 115, 117, 118];
      const result = arimaForecast(data, 12);

      expect(result.forecast).toHaveLength(12);
      expect(result.lowerBound).toBeDefined();
      expect(result.upperBound).toBeDefined();

      // All forecasts should be positive
      result.forecast.forEach((f) => {
        expect(f).toBeGreaterThanOrEqual(0);
      });

      // Confidence intervals should be valid
      result.forecast.forEach((f, i) => {
        expect(result.lowerBound![i]).toBeLessThanOrEqual(f);
        expect(result.upperBound![i]).toBeGreaterThanOrEqual(f);
      });
    });

    it('handles random walk data', () => {
      // Random walk: each value influenced by previous
      const data: number[] = [100];
      for (let i = 1; i < 12; i++) {
        data.push(data[i - 1] + (Math.random() - 0.5) * 10);
      }

      const result = arimaForecast(data, 6);
      expect(result.forecast).toHaveLength(6);
      expect(result.confidence).toBeGreaterThan(0.3);
    });
  });

  describe('ensembleForecast', () => {
    it('combines multiple forecasting methods', () => {
      const data = [100, 105, 103, 108, 110, 109, 115, 112, 118, 120, 119, 125];
      const result = ensembleForecast(data, 12);

      expect(result.forecast).toHaveLength(12);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
      expect(result.confidenceInterval.lower).toHaveLength(12);
      expect(result.confidenceInterval.upper).toHaveLength(12);

      // Ensemble forecasts should fall within confidence intervals
      result.forecast.forEach((f, i) => {
        expect(result.confidenceInterval.lower[i]).toBeLessThanOrEqual(f);
        expect(result.confidenceInterval.upper[i]).toBeGreaterThanOrEqual(f);
      });
    });

    it('handles minimal data gracefully', () => {
      const result = ensembleForecast([100], 12);
      expect(result.forecast).toHaveLength(12);
      expect(result.confidence).toBe(0.3);
    });

    it('produces reasonable forecasts for increasing trend', () => {
      const data = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210];
      const result = ensembleForecast(data, 12);

      // Forecast should continue upward trend
      expect(result.forecast[0]).toBeGreaterThan(data[data.length - 1]);
      expect(result.forecast[11]).toBeGreaterThan(result.forecast[0]);
    });
  });

  describe('calculateForecastAccuracy', () => {
    it('calculates MAPE correctly', () => {
      const actual = [100, 110, 120, 130];
      const forecast = [100, 110, 120, 130]; // Perfect forecast

      const accuracy = calculateForecastAccuracy(actual, forecast);
      expect(accuracy).toBe(0);
    });

    it('handles perfect forecasts', () => {
      const actual = [50, 100, 150];
      const forecast = [50, 100, 150];

      const accuracy = calculateForecastAccuracy(actual, forecast);
      expect(accuracy).toBe(0);
    });

    it('calculates MAPE for off-by-10% forecasts', () => {
      const actual = [100, 100, 100];
      const forecast = [110, 110, 110]; // 10% off

      const accuracy = calculateForecastAccuracy(actual, forecast);
      expect(accuracy).toBeCloseTo(10, 1);
    });

    it('handles zero actual values', () => {
      const actual = [0, 100, 200];
      const forecast = [10, 110, 210];

      const accuracy = calculateForecastAccuracy(actual, forecast);
      expect(accuracy).toBeGreaterThan(0);
      expect(accuracy).toBeLessThanOrEqual(100);
    });

    it('caps accuracy at 100%', () => {
      const actual = [100, 100, 100];
      const forecast = [500, 500, 500]; // Way off

      const accuracy = calculateForecastAccuracy(actual, forecast);
      expect(accuracy).toBeLessThanOrEqual(100);
    });

    it('handles empty arrays', () => {
      const accuracy = calculateForecastAccuracy([], []);
      expect(accuracy).toBe(0);
    });

    it('calculates reasonable MAPE for realistic forecasts', () => {
      const actual = [100, 120, 115, 130, 125];
      const forecast = [105, 118, 120, 128, 132]; // ~3-5% error

      const accuracy = calculateForecastAccuracy(actual, forecast);
      expect(accuracy).toBeGreaterThan(0);
      expect(accuracy).toBeLessThan(10);
    });
  });

  describe('Integration: Full forecasting pipeline', () => {
    it('generates forecast for 24-month historical data', () => {
      // Simulate 24 months of emission data with trend
      const data = Array.from({ length: 24 }, (_, i) => {
        const base = 1000;
        const trend = i * 10;
        const seasonal = Math.sin((i / 12) * Math.PI * 2) * 100;
        const noise = Math.random() * 50;
        return base + trend + seasonal + noise;
      });

      // Get all forecasts
      const esResult = exponentialSmoothing(data, 0.3, 0.1, 12);
      const arimaResult = arimaForecast(data, 12);
      const ensembleResult = ensembleForecast(data, 12);

      // All should produce 12-month forecasts
      expect(esResult.forecast).toHaveLength(12);
      expect(arimaResult.forecast).toHaveLength(12);
      expect(ensembleResult.forecast).toHaveLength(12);

      // Ensemble should incorporate all methods
      expect(ensembleResult.confidence).toBeGreaterThan(0);

      // Calculate accuracy against a held-out test set
      const testData = data.slice(12, 24); // Last 12 months
      const esAccuracy = calculateForecastAccuracy(testData, esResult.forecast);
      const arimaAccuracy = calculateForecastAccuracy(testData, arimaResult.forecast);
      const ensembleAccuracy = calculateForecastAccuracy(testData, ensembleResult.forecast);

      // All should be reasonable (not too far off)
      expect(esAccuracy).toBeLessThan(50);
      expect(arimaAccuracy).toBeLessThan(50);
      expect(ensembleAccuracy).toBeLessThan(50);
    });
  });
});
