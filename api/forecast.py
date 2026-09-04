"""
Prophet-based time-series forecasting, exposed as a Vercel Python Function.

Stateless by design: the caller (lib/jobs/workers/forecasting.ts) already
holds the historical data (pulled from DashboardAggregate /
SupplierPerformanceHistory / InvoiceAnomaly via Prisma) and writes the
result to the Forecast table itself. This function does one thing only —
fit Prophet on a given monthly series and return predictions plus a
genuinely out-of-sample accuracy estimate. No database credentials, no
outbound calls back into the app, nothing to leak if this endpoint is
ever reached by something it shouldn't be.
"""

import os
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, Header, HTTPException
from prophet import Prophet
from pydantic import BaseModel

app = FastAPI()

MIN_DATA_POINTS = 12
SERVICE_SECRET = os.environ.get("FORECAST_SERVICE_SECRET", "")


class ForecastPoint(BaseModel):
    date: str  # YYYY-MM-DD
    value: float


class ForecastRequest(BaseModel):
    points: list[ForecastPoint]
    periods: int = 12


class PredictionOut(BaseModel):
    date: str
    forecast: float
    lowerBound: float
    upperBound: float
    confidence: float


class ForecastResponse(BaseModel):
    predictions: list[PredictionOut]
    accuracy: float
    method: str
    metadata: dict
    trainingDataPoints: int


def _remove_outliers(df: pd.DataFrame) -> pd.DataFrame:
    """IQR-based outlier removal. Skipped if it would leave too little
    data to forecast from — a few genuine spikes are better training
    signal than an empty series."""
    q1 = df["y"].quantile(0.25)
    q3 = df["y"].quantile(0.75)
    iqr = q3 - q1
    lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    filtered = df[(df["y"] >= lower) & (df["y"] <= upper)]
    return filtered if len(filtered) >= MIN_DATA_POINTS else df


def _fit(df: pd.DataFrame) -> Prophet:
    # Data is monthly-aggregated before it reaches this function — weekly/
    # daily seasonality would be meaningless noise at this granularity.
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        interval_width=0.95,
        changepoint_prior_scale=0.05,
        seasonality_mode="additive",
    )
    model.fit(df)
    return model


def _compute_accuracy(df: pd.DataFrame) -> tuple[float, str]:
    """Holdout backtest: fit on all but the last few points, forecast
    them, compare to what actually happened. That's a real out-of-sample
    number, unlike grading a model against the data it was trained on.
    Falls back to in-sample fit error (flagged low-confidence) only when
    there isn't enough history to hold anything out."""
    holdout = min(3, max(1, len(df) // 6))
    if len(df) - holdout < MIN_DATA_POINTS:
        model = _fit(df)
        in_sample = model.predict(df[["ds"]])
        mape = float(
            np.mean(np.abs((df["y"].values - in_sample["yhat"].values) / np.maximum(np.abs(df["y"].values), 1e-6)))
            * 100
        )
        return max(0.0, min(100.0, 100 - mape)), "low"

    train, test = df.iloc[:-holdout], df.iloc[-holdout:]
    model = _fit(train)
    pred = model.predict(test[["ds"]])
    mape = float(
        np.mean(np.abs((test["y"].values - pred["yhat"].values) / np.maximum(np.abs(test["y"].values), 1e-6))) * 100
    )
    return max(0.0, min(100.0, 100 - mape)), "holdout"


@app.post("/api/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest, x_forecast_secret: Optional[str] = Header(default=None)):
    if SERVICE_SECRET and x_forecast_secret != SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if len(req.points) < MIN_DATA_POINTS:
        raise HTTPException(
            status_code=422,
            detail=f"Need at least {MIN_DATA_POINTS} data points, got {len(req.points)}",
        )

    df = pd.DataFrame([{"ds": pd.to_datetime(p.date), "y": p.value} for p in req.points])
    df = df.sort_values("ds").reset_index(drop=True)
    df = _remove_outliers(df)

    accuracy, confidence = _compute_accuracy(df)

    model = _fit(df)
    future = model.make_future_dataframe(periods=req.periods, freq="MS")
    forecast_df = model.predict(future)

    last_historical_date = df["ds"].max()
    future_only = forecast_df[forecast_df["ds"] > last_historical_date]

    predictions = [
        PredictionOut(
            date=row["ds"].strftime("%Y-%m-%d"),
            forecast=max(0.0, round(float(row["yhat"]), 2)),
            lowerBound=max(0.0, round(float(row["yhat_lower"]), 2)),
            upperBound=round(float(row["yhat_upper"]), 2),
            confidence=0.95 if confidence == "holdout" else 0.65,
        )
        for _, row in future_only.iterrows()
    ]

    trend_start = float(forecast_df["trend"].iloc[0])
    trend_end = float(forecast_df["trend"].iloc[len(df) - 1])
    trend_slope = (trend_end - trend_start) / max(len(df), 1)
    seasonal_component = float(forecast_df["yearly"].iloc[len(df) - 1]) if "yearly" in forecast_df.columns else 0.0

    return ForecastResponse(
        predictions=predictions,
        accuracy=round(accuracy, 2),
        method="prophet",
        metadata={
            "trendSlope": trend_slope,
            "seasonalComponent": seasonal_component,
            "accuracyConfidence": confidence,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        },
        trainingDataPoints=len(df),
    )


@app.get("/api/forecast/health")
def health():
    return {"status": "ok"}
