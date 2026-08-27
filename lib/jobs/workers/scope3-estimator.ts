import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

interface TrainingData {
  features: Record<string, number>;
  target: number;
}

interface LinearRegressionModel extends Record<string, unknown> {
  intercept: number;
  coefficients: Record<string, number>;
}

interface ModelMetrics extends Record<string, unknown> {
  r_squared: number;
  rmse: number;
  mae: number;
  sample_count: number;
}

function calculateLinearRegression(data: TrainingData[]): LinearRegressionModel {
  if (data.length < 2) {
    return { intercept: 0, coefficients: {} };
  }

  const featureNames = data.length > 0 ? Object.keys(data[0].features) : [];
  const n = data.length;

  // Calculate means
  const targetMean = data.reduce((sum, d) => sum + d.target, 0) / n;
  const featureMeans: Record<string, number> = {};
  featureNames.forEach((name) => {
    featureMeans[name] = data.reduce((sum, d) => sum + (d.features[name] || 0), 0) / n;
  });

  // Calculate coefficients using simple linear regression
  const coefficients: Record<string, number> = {};
  featureNames.forEach((featureName) => {
    let numerator = 0;
    let denominator = 0;

    data.forEach((d) => {
      const featureDeviation = (d.features[featureName] || 0) - featureMeans[featureName];
      const targetDeviation = d.target - targetMean;
      numerator += featureDeviation * targetDeviation;
      denominator += featureDeviation * featureDeviation;
    });

    coefficients[featureName] = denominator !== 0 ? numerator / denominator : 0;
  });

  // Calculate intercept
  let intercept = targetMean;
  featureNames.forEach((featureName) => {
    intercept -= coefficients[featureName] * featureMeans[featureName];
  });

  return { intercept, coefficients };
}

function calculateMetrics(
  data: TrainingData[],
  model: LinearRegressionModel,
): ModelMetrics {
  const featureNames = Object.keys(model.coefficients);
  const predictions = data.map((d) => {
    let pred = model.intercept;
    featureNames.forEach((name) => {
      pred += model.coefficients[name] * (d.features[name] || 0);
    });
    return pred;
  });

  const targetMean = data.reduce((sum, d) => sum + d.target, 0) / data.length;
  const ss_res = data.reduce((sum, d, i) => sum + Math.pow(d.target - predictions[i], 2), 0);
  const ss_tot = data.reduce((sum, d) => sum + Math.pow(d.target - targetMean, 2), 0);

  const r_squared = ss_tot === 0 ? 0 : 1 - ss_res / ss_tot;
  const mse = ss_res / data.length;
  const rmse = Math.sqrt(mse);
  const mae = data.reduce((sum, d, i) => sum + Math.abs(d.target - predictions[i]), 0) / data.length;

  return {
    r_squared: parseFloat(r_squared.toFixed(4)),
    rmse: parseFloat(rmse.toFixed(4)),
    mae: parseFloat(mae.toFixed(4)),
    sample_count: data.length,
  };
}

export async function trainScope3EstimationModels(orgId: string) {
  console.log(`[scope3-estimator] Starting training for org ${orgId}`);

  const categories = await prisma.emissionCategory.findMany({
    where: { scope: 3 },
  });

  for (const category of categories) {
    try {
      // Fetch historical activity records for this category
      const records = await prisma.activityRecord.findMany({
        where: {
          organizationId: orgId,
          emissionCategoryId: category.id,
          facilityId: { not: null },
        },
        take: 500, // Limit to 500 records for training
      });

      if (records.length < 10) {
        console.log(`[scope3-estimator] Insufficient data for ${category.code}: ${records.length} records`);
        continue;
      }

      // Prepare training data
      const trainingData: TrainingData[] = records
        .filter((r) => {
          const amount = Number(r.amount);
          return r.facilityId && amount > 0;
        })
        .map((r) => {
          return {
            features: {
              headcount: 50, // Default headcount estimate
              footprint: 5, // Default footprint in thousands of sqm
              month: new Date(r.activityDate || new Date()).getMonth() + 1,
              is_winter: [12, 1, 2].includes(new Date(r.activityDate || new Date()).getMonth()) ? 1 : 0,
            },
            target: Number(r.amount),
          };
        });

      if (trainingData.length < 10) {
        console.log(`[scope3-estimator] Insufficient valid data for ${category.code}`);
        continue;
      }

      // Train model
      const model = calculateLinearRegression(trainingData);
      const metrics = calculateMetrics(trainingData, model);

      // Calculate date range
      const dates = records
        .map((r) => new Date(r.activityDate || new Date()).getTime())
        .filter((t) => !isNaN(t));
      const dateRange = {
        from: new Date(Math.min(...dates)),
        to: new Date(Math.max(...dates)),
      };

      // Store model using organization + category as unique key
      const existing = await prisma.scope3EstimationModel.findFirst({
        where: {
          organizationId: orgId,
          emissionCategoryId: category.id,
          facilityType: null,
        },
      });

      if (existing) {
        await prisma.scope3EstimationModel.update({
          where: { id: existing.id },
          data: {
            coefficients: model as Prisma.InputJsonValue,
            modelMetrics: metrics as Prisma.InputJsonValue,
            featureImportance: calculateFeatureImportance(model.coefficients) as Prisma.InputJsonValue,
            trainingRecordCount: trainingData.length,
            trainingDataDateRange: dateRange,
            lastTrainedAt: new Date(),
            nextTrainAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      } else {
        await prisma.scope3EstimationModel.create({
          data: {
            organizationId: orgId,
            emissionCategoryId: category.id,
            facilityType: null,
            coefficients: model as Prisma.InputJsonValue,
            modelMetrics: metrics as Prisma.InputJsonValue,
            featureImportance: calculateFeatureImportance(model.coefficients) as Prisma.InputJsonValue,
            trainingRecordCount: trainingData.length,
            trainingDataDateRange: dateRange,
            lastTrainedAt: new Date(),
            nextTrainAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            modelType: 'linear-regression',
            confidenceThreshold: 0.7,
          },
        });
      }

      console.log(`✓ Trained model for ${category.code}: R²=${metrics.r_squared}, RMSE=${metrics.rmse}`);
    } catch (error) {
      console.error(`Error training model for ${category.code}:`, error);
    }
  }
}

function calculateFeatureImportance(coefficients: Record<string, number>): Record<string, number> {
  const maxAbs = Math.max(...Object.values(coefficients).map((v) => Math.abs(v)));
  const importance: Record<string, number> = {};

  Object.entries(coefficients).forEach(([key, value]) => {
    importance[key] = maxAbs > 0 ? Math.abs(value) / maxAbs : 0;
  });

  return importance;
}

export async function predictScope3Emission(
  orgId: string,
  categoryId: string,
  features: Record<string, number>,
): Promise<{
  estimated: number;
  confidence: number;
  interval: { lower: number; upper: number };
  explanation: string;
} | null> {
  const model = await prisma.scope3EstimationModel.findFirst({
    where: {
      organizationId: orgId,
      emissionCategoryId: categoryId,
      facilityType: null,
    },
  });

  if (!model) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coefficients = (model.coefficients as any) as Record<string, number>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metrics = (model.modelMetrics as any) as ModelMetrics;

  let predicted = coefficients.intercept || 0;
  Object.entries(coefficients).forEach(([key, coef]) => {
    if (key !== 'intercept') {
      predicted += coef * (features[key] || 0);
    }
  });

  // Ensure non-negative prediction
  predicted = Math.max(0, predicted);

  // Calculate confidence: higher R² and lower RMSE = higher confidence
  const confidence = (model.confidenceThreshold as unknown as number) * metrics.r_squared;

  // Calculate prediction interval based on RMSE
  const margin = 1.96 * metrics.rmse; // 95% confidence interval
  const interval = {
    lower: Math.max(0, predicted - margin),
    upper: predicted + margin,
  };

  const explanation = `Estimated based on ${metrics.sample_count} historical records. Model R²=${metrics.r_squared}, prediction confidence ${(confidence * 100).toFixed(1)}%.`;

  return {
    estimated: parseFloat(predicted.toFixed(2)),
    confidence: parseFloat(confidence.toFixed(2)),
    interval: {
      lower: parseFloat(interval.lower.toFixed(2)),
      upper: parseFloat(interval.upper.toFixed(2)),
    },
    explanation,
  };
}
