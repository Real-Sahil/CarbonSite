/**
 * Time-series forecasting engine for emissions predictions
 * Uses exponential smoothing and seasonal decomposition
 * No external dependencies - pure TypeScript implementation
 */

interface ForecastPoint {
  date: string;
  value: number;
}

interface ForecastPrediction {
  date: string;
  forecast: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

interface ForecastResult {
  predictions: ForecastPrediction[];
  accuracy: number;
  method: string;
  metadata: Record<string, unknown>;
  trainingDataPoints: number;
}

/**
 * Simple exponential smoothing (SES) for trend forecasting
 * α (alpha) controls smoothing: 0.1 (very smooth) to 0.9 (responsive)
 */
export function exponentialSmoothing(
  data: ForecastPoint[],
  periods: number = 12,
  alpha: number = 0.3
): ForecastResult {
  if (data.length < 2) {
    throw new Error("Need at least 2 data points for forecasting");
  }

  const values = data.map((d) => d.value);
  const dates = data.map((d) => new Date(d.date));

  // Initialize with first value
  let S = values[0];
  const smoothed: number[] = [S];

  // Apply exponential smoothing
  for (let i = 1; i < values.length; i++) {
    S = alpha * values[i] + (1 - alpha) * S;
    smoothed.push(S);
  }

  // Calculate MAE for accuracy metric
  let mae = 0;
  for (let i = 1; i < values.length; i++) {
    mae += Math.abs(values[i] - smoothed[i - 1]);
  }
  mae /= values.length - 1;

  // Generate forecast
  const predictions: ForecastPrediction[] = [];
  const lastDate = new Date(dates[dates.length - 1]);
  let forecastValue = smoothed[smoothed.length - 1];

  // Calculate standard deviation for confidence intervals
  let variance = 0;
  for (let i = 1; i < values.length; i++) {
    variance += Math.pow(values[i] - smoothed[i - 1], 2);
  }
  const stdDev = Math.sqrt(variance / (values.length - 1));

  for (let i = 1; i <= periods; i++) {
    const date = new Date(lastDate);
    date.setMonth(date.getMonth() + i);

    // Confidence interval grows with forecast horizon (±1.96 std dev = 95% confidence)
    const confidence = Math.max(0.65, Math.exp(-i / periods)); // decays with distance
    const bound = 1.96 * stdDev * Math.sqrt(i);

    predictions.push({
      date: date.toISOString().split("T")[0],
      forecast: Math.max(0, forecastValue),
      lowerBound: Math.max(0, forecastValue - bound),
      upperBound: forecastValue + bound,
      confidence,
    });
  }

  // Calculate accuracy: (1 - MAPE) * 100, capped at 0-100
  const mape =
    values.length > 0
      ? (mae / (values.reduce((a, b) => a + b, 0) / values.length)) * 100
      : 0;
  const accuracy = Math.max(0, Math.min(100, 100 - mape));

  return {
    predictions,
    accuracy,
    method: "exponential_smoothing",
    metadata: { alpha, mae, mape },
    trainingDataPoints: data.length,
  };
}

/**
 * Seasonal decomposition with trend extraction
 * Identifies trend, seasonal, and residual components
 */
export function seasonalDecomposition(
  data: ForecastPoint[],
  periods: number = 12,
  seasonalWindow: number = 12
): ForecastResult {
  if (data.length < seasonalWindow * 2) {
    throw new Error(
      `Need at least ${seasonalWindow * 2} data points for seasonal decomposition`
    );
  }

  const values = data.map((d) => d.value);
  const dates = data.map((d) => new Date(d.date));

  // Extract trend using centered moving average
  const trend: (number | null)[] = Array(values.length).fill(null);
  const halfWindow = Math.floor(seasonalWindow / 2);

  for (let i = halfWindow; i < values.length - halfWindow; i++) {
    const sum = values
      .slice(i - halfWindow, i + halfWindow + 1)
      .reduce((a, b) => a + b, 0);
    trend[i] = sum / (seasonalWindow + 1);
  }

  // Extract seasonal component
  const seasonal: number[] = Array(seasonalWindow).fill(0);
  const seasonalCounts: number[] = Array(seasonalWindow).fill(0);

  for (let i = 0; i < values.length; i++) {
    if (trend[i] !== null) {
      const seasonalIdx = i % seasonalWindow;
      seasonal[seasonalIdx] += values[i] - (trend[i] as number);
      seasonalCounts[seasonalIdx]++;
    }
  }

  for (let i = 0; i < seasonalWindow; i++) {
    if (seasonalCounts[i] > 0) {
      seasonal[i] /= seasonalCounts[i];
    }
  }

  // Extract residuals
  const residuals: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (trend[i] !== null) {
      const residual = values[i] - (trend[i] as number) - seasonal[i % seasonalWindow];
      residuals.push(residual);
    }
  }

  const residualStdDev = Math.sqrt(
    residuals.reduce((a, b) => a + b * b, 0) / residuals.length
  );

  // Project trend into future
  const validTrends = trend.filter((t) => t !== null) as number[];
  const trendSlope =
    (validTrends[validTrends.length - 1] - validTrends[0]) /
    validTrends.length;
  let lastTrendValue = validTrends[validTrends.length - 1];

  // Generate predictions
  const predictions: ForecastPrediction[] = [];
  const lastDate = new Date(dates[dates.length - 1]);

  for (let i = 1; i <= periods; i++) {
    const date = new Date(lastDate);
    date.setMonth(date.getMonth() + i);

    const projectedTrend = lastTrendValue + trendSlope * i;
    const seasonalComponent =
      seasonal[(dates.length + i) % seasonalWindow];
    const forecast = projectedTrend + seasonalComponent;

    const confidence = Math.max(0.65, Math.exp(-i / periods));
    const bound = 1.96 * residualStdDev * Math.sqrt(i);

    predictions.push({
      date: date.toISOString().split("T")[0],
      forecast: Math.max(0, forecast),
      lowerBound: Math.max(0, forecast - bound),
      upperBound: forecast + bound,
      confidence,
    });
  }

  // Calculate accuracy
  let mse = 0;
  for (const residual of residuals) {
    mse += residual * residual;
  }
  const rmse = Math.sqrt(mse / residuals.length);
  const meanValue = values.reduce((a, b) => a + b, 0) / values.length;
  const mape = (rmse / meanValue) * 100;
  const accuracy = Math.max(0, Math.min(100, 100 - mape));

  return {
    predictions,
    accuracy,
    method: "seasonal_decomposition",
    metadata: {
      seasonalWindow,
      trendSlope,
      residualStdDev,
      mape,
    },
    trainingDataPoints: data.length,
  };
}

/**
 * Automatically select best forecasting method based on data characteristics
 */
export function autoForecast(
  data: ForecastPoint[],
  periods: number = 12
): ForecastResult {
  // Check for seasonality: calculate autocorrelation at lag 12
  const values = data.map((d) => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  let autocorr12 = 0;
  let variance = 0;

  for (const v of values) {
    variance += (v - mean) * (v - mean);
  }

  if (values.length > 12) {
    for (let i = 12; i < values.length; i++) {
      autocorr12 +=
        (values[i] - mean) * (values[i - 12] - mean);
    }
    autocorr12 /= variance;
  }

  // If strong seasonal pattern detected (|autocorr| > 0.5), use seasonal decomposition
  if (Math.abs(autocorr12) > 0.5 && values.length >= 24) {
    return seasonalDecomposition(data, periods, 12);
  }

  // Otherwise use simpler exponential smoothing
  return exponentialSmoothing(data, periods, 0.3);
}
