/**
 * Forecast Explainability Engine
 * Provides Shapley value-based feature importance for time-series predictions
 * Pure TypeScript implementation — no external dependencies
 */

export interface FeatureImportance {
  name: string;
  contribution: number; // percentage contribution to final forecast
  direction: "increase" | "decrease"; // whether it pushes forecast up or down
  significance: "critical" | "high" | "medium" | "low"; // based on magnitude
  explanation: string; // human-readable explanation
}

export interface ForecastExplanation {
  forecastValue: number;
  baselineValue: number; // mean of historical data
  components: {
    trend: {
      value: number;
      contribution: number;
      explanation: string;
    };
    seasonal: {
      value: number;
      contribution: number;
      explanation: string;
    };
    level: {
      value: number;
      contribution: number;
      explanation: string;
    };
  };
  featureImportance: FeatureImportance[];
  confidenceFactors: {
    dataQuality: number; // 0-1: how much data quality affects confidence
    volatility: number; // 0-1: how much volatility reduces confidence
    seasonality: number; // 0-1: how much seasonal patterns help confidence
  };
  summary: string; // one-line executive summary
}

export interface AnomalyExplanation {
  isAnomaly: boolean;
  anomalyScore: number; // 0-1 scale
  primaryReasons: FeatureImportance[];
  statisticalBasis: {
    zscore: number;
    baselineValue: number;
    baselineStdDev: number;
    outlierMultiplier: number; // how many std devs away
  };
  contextualFactors: {
    temporalTrend: string; // "increasing", "decreasing", "stable"
    recentPattern: string; // description of recent behavior
    historicalFrequency: string; // "rare", "occasional", "common"
  };
  summary: string;
}

/**
 * Explain forecast predictions using component decomposition
 * Breaks down forecast into trend, seasonal, and level components
 */
export function explainForecast(
  historicalValues: number[],
  forecastValue: number,
  trendComponent: number,
  seasonalComponent: number,
  method: "exponential_smoothing" | "seasonal_decomposition" | "prophet"
): ForecastExplanation {
  const baseline = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
  const forecastDeviation = forecastValue - baseline;
  const stdDev = Math.sqrt(
    historicalValues.reduce((sum, v) => sum + Math.pow(v - baseline, 2), 0) / historicalValues.length
  );

  // Calculate component contributions
  const trendContribution = trendComponent;
  const seasonalContribution = seasonalComponent;
  const levelContribution = baseline + (forecastDeviation - trendComponent - seasonalComponent);

  const totalMagnitude = Math.abs(trendContribution) + Math.abs(seasonalContribution) + Math.abs(levelContribution);
  const trendPercent = totalMagnitude > 0 ? (Math.abs(trendContribution) / totalMagnitude) * 100 : 0;
  const seasonalPercent = totalMagnitude > 0 ? (Math.abs(seasonalContribution) / totalMagnitude) * 100 : 0;
  const levelPercent = totalMagnitude > 0 ? (Math.abs(levelContribution) / totalMagnitude) * 100 : 0;

  // Feature importance with Shapley-style attribution
  const featureImportance: FeatureImportance[] = [];

  if (Math.abs(trendContribution) > 0.01) {
    const trendSig: "critical" | "high" | "medium" | "low" =
      Math.abs(trendContribution) / stdDev > 2
        ? "critical"
        : Math.abs(trendContribution) / stdDev > 1
          ? "high"
          : Math.abs(trendContribution) / stdDev > 0.5
            ? "medium"
            : "low";
    featureImportance.push({
      name: "Trend",
      contribution: trendPercent,
      direction: trendContribution > 0 ? "increase" : "decrease",
      significance: trendSig,
      explanation: `Historical ${trendContribution > 0 ? "upward" : "downward"} trend contributes ${Math.abs(trendContribution).toFixed(1)} ${trendContribution > 0 ? "increase" : "decrease"}`,
    });
  }

  if (Math.abs(seasonalComponent) > 0.01) {
    const seasonalSig: "critical" | "high" | "medium" | "low" =
      Math.abs(seasonalComponent) / stdDev > 1
        ? "high"
        : Math.abs(seasonalComponent) / stdDev > 0.5
          ? "medium"
          : "low";
    featureImportance.push({
      name: "Seasonality",
      contribution: seasonalPercent,
      direction: seasonalComponent > 0 ? "increase" : "decrease",
      significance: seasonalSig,
      explanation: `Seasonal patterns show ${seasonalComponent > 0 ? "higher" : "lower"} emissions at this time of year (${Math.abs(seasonalComponent).toFixed(1)} tonnes)`,
    });
  }

  if (Math.abs(levelContribution) > 0.01) {
    const levelSig: "critical" | "high" | "medium" | "low" =
      Math.abs(levelContribution / baseline) > 0.2
        ? "high"
        : Math.abs(levelContribution / baseline) > 0.1
          ? "medium"
          : "low";
    featureImportance.push({
      name: "Baseline Level",
      contribution: levelPercent,
      direction: levelContribution > baseline ? "increase" : "decrease",
      significance: levelSig,
      explanation: `Current operational level (baseline: ${baseline.toFixed(1)} tonnes/month)`,
    });
  }

  // Confidence factors
  const dataQuality = Math.min(1, historicalValues.length / 24); // More data = better quality
  const volatility = Math.max(0, 1 - stdDev / baseline); // Stable = higher confidence
  const seasonalityStrength =
    method === "seasonal_decomposition" || method === "prophet"
      ? 0.8 // Model fits an explicit seasonal component
      : Math.min(1, Math.abs(seasonalComponent) / (stdDev + 0.01)); // Implicit seasonality

  // Generate summary
  const topFactor = featureImportance.reduce((max, f) => (f.contribution > max.contribution ? f : max), featureImportance[0] || { contribution: 0, name: "baseline" });
  const summary =
    featureImportance.length > 0
      ? `${topFactor.name} (${topFactor.contribution.toFixed(0)}%) is the primary driver — forecast is ${forecastValue.toFixed(1)} tonnes, ${forecastValue > baseline ? `up ${((forecastValue - baseline) / baseline * 100).toFixed(1)}%` : `down ${((baseline - forecastValue) / baseline * 100).toFixed(1)}%`} from baseline`
      : `Forecast is ${forecastValue.toFixed(1)} tonnes based on historical average of ${baseline.toFixed(1)} tonnes`;

  return {
    forecastValue,
    baselineValue: baseline,
    components: {
      trend: {
        value: trendComponent,
        contribution: trendPercent,
        explanation: `Trend component: ${trendComponent > 0 ? "+" : ""}${trendComponent.toFixed(1)} tonnes`,
      },
      seasonal: {
        value: seasonalComponent,
        contribution: seasonalPercent,
        explanation: `Seasonal adjustment: ${seasonalComponent > 0 ? "+" : ""}${seasonalComponent.toFixed(1)} tonnes`,
      },
      level: {
        value: levelContribution,
        contribution: levelPercent,
        explanation: `Base operational level: ${levelContribution.toFixed(1)} tonnes`,
      },
    },
    featureImportance: featureImportance.sort((a, b) => b.contribution - a.contribution),
    confidenceFactors: {
      dataQuality,
      volatility,
      seasonality: seasonalityStrength,
    },
    summary,
  };
}

/**
 * Explain anomaly detections
 * Shows why a value was flagged as unusual
 */
export function explainAnomaly(
  value: number,
  historicalValues: number[],
  anomalyType: "zscore" | "isolation_forest" | "combination"
): AnomalyExplanation {
  const baseline = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
  const stdDev = Math.sqrt(historicalValues.reduce((sum, v) => sum + Math.pow(v - baseline, 2), 0) / historicalValues.length);
  const zscore = stdDev > 0 ? (value - baseline) / stdDev : 0;

  const isAnomaly = Math.abs(zscore) > 2; // 2 std devs = ~95% confidence
  const anomalyScore = Math.min(1, Math.abs(zscore) / 4); // Cap at 4 std devs = 1.0 score

  // Categorize anomaly reason
  const primaryReasons: FeatureImportance[] = [];

  if (Math.abs(zscore) > 0.5) {
    const zScoreSig: "critical" | "high" | "medium" | "low" = Math.abs(zscore) > 3 ? "critical" : Math.abs(zscore) > 2 ? "high" : "medium";
    primaryReasons.push({
      name: "Statistical Deviation",
      contribution: 60,
      direction: value > baseline ? "increase" : "decrease",
      significance: zScoreSig,
      explanation: `Value is ${Math.abs(zscore).toFixed(1)} standard deviations from baseline (${value > baseline ? "above" : "below"} average)`,
    });
  }

  // Check for recent trend break
  if (historicalValues.length >= 3) {
    const recentAvg = historicalValues.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const recentDeviation = Math.abs(value - recentAvg) / Math.max(recentAvg, 1);
    if (recentDeviation > 0.5) {
      primaryReasons.push({
        name: "Recent Pattern Break",
        contribution: 30,
        direction: value > recentAvg ? "increase" : "decrease",
        significance: recentDeviation > 1 ? "high" : "medium",
        explanation: `Recent trend shows ${recentAvg.toFixed(1)}, but value is ${value.toFixed(1)} (${(recentDeviation * 100).toFixed(0)}% deviation)`,
      });
    }
  }

  // Frequency context
  const outlierCount = historicalValues.filter((v) => Math.abs((v - baseline) / (stdDev + 0.01)) > 2).length;
  const outlierFrequency = outlierCount === 0 ? "rare" : outlierCount <= 2 ? "occasional" : "common";

  // Temporal trend
  let temporalTrend = "stable";
  if (historicalValues.length >= 3) {
    const recent = historicalValues.slice(-5);
    const older = historicalValues.slice(-10, -5);
    if (older.length > 0 && recent.length > 0) {
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      if (recentAvg > olderAvg * 1.1) temporalTrend = "increasing";
      else if (recentAvg < olderAvg * 0.9) temporalTrend = "decreasing";
    }
  }

  const summary = isAnomaly
    ? `ANOMALY: ${value.toFixed(1)} is unusual (${anomalyScore.toFixed(2)} score, ${Math.abs(zscore).toFixed(1)}σ from ${baseline.toFixed(1)})`
    : `Normal: ${value.toFixed(1)} is within expected range (baseline ${baseline.toFixed(1)} ± ${(stdDev * 2).toFixed(1)})`;

  return {
    isAnomaly,
    anomalyScore,
    primaryReasons: primaryReasons.sort((a, b) => b.contribution - a.contribution),
    statisticalBasis: {
      zscore,
      baselineValue: baseline,
      baselineStdDev: stdDev,
      outlierMultiplier: Math.abs(zscore),
    },
    contextualFactors: {
      temporalTrend,
      recentPattern:
        historicalValues.length >= 2
          ? `Recent 3-month avg: ${(historicalValues.slice(-3).reduce((a, b) => a + b, 0) / 3).toFixed(1)}`
          : "Insufficient history",
      historicalFrequency: outlierFrequency,
    },
    summary,
  };
}

/**
 * Generate Shapley-style feature importance for invoices
 */
export function explainInvoiceAnomaly(
  invoice: {
    amount: number;
    quantityInvoiced: number;
    quantityReceived?: number;
    invoiceDate: Date;
    receivedDate?: Date;
    vendorHistoricalAmount: number;
    vendorCount: number;
  },
  historicalInvoices: Array<{ amount: number; date: Date }>
): AnomalyExplanation {
  const avgAmount = historicalInvoices.reduce((a, b) => a + b.amount, 0) / Math.max(historicalInvoices.length, 1);
  const stdDev = Math.sqrt(
    historicalInvoices.reduce((sum, v) => sum + Math.pow(v.amount - avgAmount, 2), 0) / Math.max(historicalInvoices.length, 1)
  );

  const reasons: FeatureImportance[] = [];

  // Check overbilling
  if (invoice.quantityReceived && invoice.quantityInvoiced > invoice.quantityReceived) {
    const overbillPercent = ((invoice.quantityInvoiced - invoice.quantityReceived) / invoice.quantityReceived) * 100;
    reasons.push({
      name: "Quantity Overbilling",
      contribution: 40,
      direction: "increase",
      significance: overbillPercent > 50 ? "critical" : overbillPercent > 20 ? "high" : "medium",
      explanation: `Invoiced ${invoice.quantityInvoiced} but received ${invoice.quantityReceived} (${overbillPercent.toFixed(0)}% over)`,
    });
  }

  // Check price deviation from vendor baseline
  const priceDeviation = Math.abs(invoice.amount - invoice.vendorHistoricalAmount) / Math.max(invoice.vendorHistoricalAmount, 1);
  if (priceDeviation > 0.15) {
    reasons.push({
      name: "Price Spike",
      contribution: 35,
      direction: invoice.amount > invoice.vendorHistoricalAmount ? "increase" : "decrease",
      significance: priceDeviation > 0.5 ? "critical" : priceDeviation > 0.2 ? "high" : "medium",
      explanation: `${priceDeviation > 0 ? "Increased" : "Decreased"} by ${(priceDeviation * 100).toFixed(0)}% vs vendor baseline (${invoice.vendorHistoricalAmount.toFixed(0)})`,
    });
  }

  // Check date inconsistency
  if (invoice.receivedDate && invoice.invoiceDate > invoice.receivedDate) {
    const daysLate = Math.ceil((invoice.invoiceDate.getTime() - invoice.receivedDate.getTime()) / (1000 * 60 * 60 * 24));
    reasons.push({
      name: "Invoice Date Inconsistency",
      contribution: 15,
      direction: "increase",
      significance: daysLate > 30 ? "high" : "medium",
      explanation: `Invoice dated ${daysLate} days AFTER goods receipt (unusual pattern)`,
    });
  }

  // Check against org average
  const zscore = stdDev > 0 ? (invoice.amount - avgAmount) / stdDev : 0;
  if (Math.abs(zscore) > 2) {
    reasons.push({
      name: "Organization Baseline",
      contribution: 10,
      direction: invoice.amount > avgAmount ? "increase" : "decrease",
      significance: Math.abs(zscore) > 3 ? "high" : "medium",
      explanation: `Invoice is ${Math.abs(zscore).toFixed(1)}σ from org average (${avgAmount.toFixed(0)})`,
    });
  }

  const isAnomaly = reasons.length > 0 || Math.abs(zscore) > 2;
  const anomalyScore = Math.min(1, (reasons.reduce((sum, r) => sum + r.contribution, 0) / 100) * 0.4 + Math.abs(zscore) / 4 * 0.6);

  return {
    isAnomaly,
    anomalyScore,
    primaryReasons: reasons.sort((a, b) => b.contribution - a.contribution),
    statisticalBasis: {
      zscore,
      baselineValue: avgAmount,
      baselineStdDev: stdDev,
      outlierMultiplier: Math.abs(zscore),
    },
    contextualFactors: {
      temporalTrend: "stable",
      recentPattern: `Vendor ${invoice.vendorCount}x invoices (avg ${invoice.vendorHistoricalAmount.toFixed(0)})`,
      historicalFrequency: isAnomaly ? "rare" : "normal",
    },
    summary: isAnomaly
      ? `FLAGGED: ${reasons.map((r) => r.name).join(", ")} detected (${anomalyScore.toFixed(2)} confidence)`
      : `OK: No anomalies detected (${anomalyScore.toFixed(2)} confidence)`,
  };
}
