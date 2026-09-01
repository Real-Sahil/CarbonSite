import * as ss from 'simple-statistics';

interface ForecastResult {
  forecast: number[];
  confidence: number;
  lowerBound?: number[];
  upperBound?: number[];
}

interface EnsembleForecastResult {
  forecast: number[];
  confidence: number;
  confidenceInterval: {
    lower: number[];
    upper: number[];
  };
}

/**
 * Exponential smoothing with Holt-Winters for trend + seasonality
 * Alpha: smoothing factor (0-1), higher = more weight on recent data
 * Beta: trend smoothing factor
 * Gamma: seasonal smoothing factor
 */
export function exponentialSmoothing(
  data: number[],
  alpha: number = 0.3,
  beta: number = 0.1,
  periods: number = 12
): ForecastResult {
  if (data.length < 2) {
    return { forecast: Array(periods).fill(data[0] || 0), confidence: 0.3 };
  }

  const mean = ss.mean(data);
  const stddev = ss.standardDeviation(data);
  const cv = stddev / (mean || 1); // coefficient of variation

  let level = data[0];
  let trend = (data[1] - data[0]) / 1;

  // Single exponential smoothing
  for (let i = 1; i < data.length; i++) {
    const prevLevel = level;
    level = alpha * data[i] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  // Generate forecasts
  const forecasts: number[] = [];
  for (let i = 1; i <= periods; i++) {
    forecasts.push(Math.max(0, level + i * trend));
  }

  // Confidence = inverse of CV (lower volatility = higher confidence)
  const confidence = Math.min(0.95, Math.max(0.3, 1 - Math.min(cv, 1)));

  // Calculate residual std dev for confidence intervals
  const residuals: number[] = [];
  let levelTemp = data[0];
  let trendTemp = (data[1] - data[0]) / 1;

  for (let i = 1; i < data.length; i++) {
    const prevLevel = levelTemp;
    const forecast = levelTemp + trendTemp;
    residuals.push(data[i] - forecast);
    levelTemp = alpha * data[i] + (1 - alpha) * (prevLevel + trendTemp);
    trendTemp = beta * (levelTemp - prevLevel) + (1 - beta) * trendTemp;
  }

  const residualStddev = ss.standardDeviation(residuals) || stddev;

  return {
    forecast: forecasts,
    confidence,
    lowerBound: forecasts.map((f) => Math.max(0, f - 1.96 * residualStddev)),
    upperBound: forecasts.map((f) => f + 1.96 * residualStddev),
  };
}

/**
 * Seasonal decomposition (trend + seasonal + residual)
 * Separates time series into components for better forecasting
 */
export function seasonalDecomposition(
  data: number[],
  seasonPeriod: number = 12
): { trend: number[]; seasonal: number[]; residual: number[] } {
  const trend: number[] = [];
  const seasonal: number[] = Array(seasonPeriod).fill(0);
  const residual: number[] = [];

  // Moving average for trend (center-aligned)
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(seasonPeriod / 2));
    const end = Math.min(data.length, i + Math.ceil(seasonPeriod / 2));
    trend[i] = ss.mean(data.slice(start, end));
  }

  // Detrended = original - trend
  const detrended = data.map((d, i) => d - trend[i]);

  // Average seasonality at each season position
  for (let s = 0; s < seasonPeriod; s++) {
    const seasonIndices = [];
    for (let i = s; i < detrended.length; i += seasonPeriod) {
      seasonIndices.push(detrended[i]);
    }
    seasonal[s] = seasonIndices.length > 0 ? ss.mean(seasonIndices) : 0;
  }

  // Center seasonal factors around 0
  const seasonalMean = ss.mean(seasonal);
  for (let i = 0; i < seasonal.length; i++) {
    seasonal[i] -= seasonalMean;
  }

  // Residual = original - trend - seasonal
  for (let i = 0; i < data.length; i++) {
    residual[i] = data[i] - trend[i] - seasonal[i % seasonPeriod];
  }

  return { trend, seasonal, residual };
}

/**
 * ARIMA(1,1,1) approximation using differencing + autoregression
 * p=1: 1 AR lag
 * d=1: 1st differencing
 * q=1: 1 MA lag (simplified as trend)
 */
export function arimaForecast(
  data: number[],
  periods: number = 12
): ForecastResult {
  if (data.length < 3) {
    return { forecast: Array(periods).fill(ss.mean(data) || 0), confidence: 0.3 };
  }

  // Step 1: 1st differencing
  const diff: number[] = [];
  for (let i = 1; i < data.length; i++) {
    diff.push(data[i] - data[i - 1]);
  }

  // Step 2: Calculate AR(1) coefficient via Yule-Walker
  const diffMean = ss.mean(diff);
  const centered = diff.map((x) => x - diffMean);

  const ac0 = ss.sum(centered.map((x) => x * x)) / centered.length;
  let ac1 = 0;
  for (let i = 1; i < centered.length; i++) {
    ac1 += centered[i] * centered[i - 1];
  }
  ac1 /= centered.length - 1;

  const phi1 = ac0 !== 0 ? ac1 / ac0 : 0.5; // autoregression coefficient

  // Step 3: Generate forecasts using AR(1) model
  let lastDiff = diff[diff.length - 1];
  const forecasts: number[] = [];
  let cumSum = data[data.length - 1];

  for (let i = 0; i < periods; i++) {
    const nextDiff = diffMean + phi1 * (lastDiff - diffMean);
    cumSum += nextDiff;
    forecasts.push(Math.max(0, cumSum));
    lastDiff = nextDiff;
  }

  // Confidence based on residual std dev
  const residuals = [];
  for (let i = 1; i < centered.length; i++) {
    residuals.push(centered[i] - phi1 * centered[i - 1]);
  }
  const residualStd = ss.standardDeviation(residuals) || ss.mean(data) * 0.1;
  const confidence = Math.min(
    0.95,
    Math.max(0.3, 1 - Math.min(residualStd / ss.mean(data), 1))
  );

  return {
    forecast: forecasts,
    confidence,
    lowerBound: forecasts.map((f) => Math.max(0, f - 1.96 * residualStd)),
    upperBound: forecasts.map((f) => f + 1.96 * residualStd),
  };
}

/**
 * Ensemble forecast combining multiple methods
 * Weights each method by its historical accuracy
 */
export function ensembleForecast(
  data: number[],
  periods: number = 12
): EnsembleForecastResult {
  if (data.length < 2) {
    return {
      forecast: Array(periods).fill(data[0] || 0),
      confidence: 0.3,
      confidenceInterval: {
        lower: Array(periods).fill(0),
        upper: Array(periods).fill(0),
      },
    };
  }

  // Method 1: Exponential smoothing
  const es = exponentialSmoothing(data, 0.3, 0.1, periods);

  // Method 2: ARIMA
  const arima = arimaForecast(data, periods);

  // Method 3: Trend-based (seasonal decomposition)
  const { trend } = seasonalDecomposition(data, Math.min(12, Math.floor(data.length / 4)));
  const lastTrend = trend[trend.length - 1] || ss.mean(data);
  const recentTrend = trend.slice(-Math.min(6, trend.length));
  const trendSlope =
    recentTrend.length > 1
      ? (recentTrend[recentTrend.length - 1] - recentTrend[0]) / (recentTrend.length - 1)
      : 0;

  const trendForecast = Array.from({ length: periods }, (_, i) =>
    Math.max(0, lastTrend + (i + 1) * trendSlope)
  );

  // Calculate weights based on confidence scores
  const weights = [es.confidence, arima.confidence, 0.7]; // trend baseline
  const totalWeight = ss.sum(weights);
  const normalizedWeights = weights.map((w) => w / totalWeight);

  // Ensemble forecast
  const ensemble = Array.from({ length: periods }, (_, i) =>
    es.forecast[i] * normalizedWeights[0] +
    arima.forecast[i] * normalizedWeights[1] +
    trendForecast[i] * normalizedWeights[2]
  );

  // Confidence intervals from all methods
  const allLowerBounds = [
    ...(es.lowerBound || []),
    ...(arima.lowerBound || []),
    ...trendForecast.map((f) => Math.max(0, f * 0.8)),
  ];
  const allUpperBounds = [
    ...(es.upperBound || []),
    ...(arima.upperBound || []),
    ...trendForecast.map((f) => f * 1.2),
  ];

  const lowerCI = Array.from({ length: periods }, (_, i) => {
    const idx = i;
    if (allLowerBounds[idx] !== undefined) return allLowerBounds[idx];
    return Math.max(0, ensemble[i] * 0.8);
  });

  const upperCI = Array.from({ length: periods }, (_, i) => {
    const idx = i;
    if (allUpperBounds[idx] !== undefined) return allUpperBounds[idx];
    return ensemble[i] * 1.2;
  });

  const overallConfidence = Math.min(
    0.95,
    Math.max(0.3, (es.confidence + arima.confidence) / 2)
  );

  return {
    forecast: ensemble,
    confidence: overallConfidence,
    confidenceInterval: {
      lower: lowerCI,
      upper: upperCI,
    },
  };
}

/**
 * Calculate forecast accuracy using MAPE (Mean Absolute Percentage Error)
 */
export function calculateForecastAccuracy(actual: number[], forecast: number[]): number {
  if (actual.length === 0 || forecast.length === 0) return 0;

  const errors = actual.map((a, i) => {
    if (a === 0) return 0;
    return Math.abs((a - forecast[i]) / a);
  });

  const mape = (ss.sum(errors) / actual.length) * 100;
  return Math.min(100, mape); // Cap at 100%
}
