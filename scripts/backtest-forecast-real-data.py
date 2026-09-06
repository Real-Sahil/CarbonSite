"""
Re-validates the api/forecast.py yearly_seasonality length-gating fix
against REAL per-org historical data, using the exact same holdout/MAPE
methodology used to justify that fix on a synthetic proxy dataset (median
holdout MAPE 51% -> 20% across 80 synthetic series).

Does not run standalone — scripts/backtest-forecast-real-data.ts pulls
real per-org monthly series via Prisma (the same DashboardAggregate query
production forecasting already runs) and writes them to
scripts/real_series.json; this script reads that file and reports
current (length-gated) vs. pre-fix (always yearly_seasonality=True)
Prophet accuracy, side by side.

Usage (from repo root, with DATABASE_URL pointing at real data):
  pip install -r requirements.txt -r requirements-dev.txt
  pnpm tsx scripts/backtest-forecast-real-data.ts
  python3 scripts/backtest-forecast-real-data.py
"""
import json
import logging
import os
import sys
import warnings

warnings.filterwarnings("ignore")
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

import numpy as np
import pandas as pd
from prophet import Prophet

import forecast as current_forecast_module  # api/forecast.py, as actually deployed

DATA_FILE = os.path.join(os.path.dirname(__file__), "real_series.json")


def holdout_len(n: int) -> int:
    # Mirrors api/forecast.py's _compute_accuracy() holdout split exactly.
    return min(3, max(1, n // 6))


def mape(actual, forecast) -> float:
    actual_arr = np.array(actual, dtype=float)
    forecast_arr = np.array(forecast, dtype=float)
    return float(np.mean(np.abs((actual_arr - forecast_arr) / np.maximum(np.abs(actual_arr), 1e-6))) * 100)


def fit_predict(train_df: pd.DataFrame, h: int, force_yearly):
    """force_yearly=None reuses the current production gating logic
    (api/forecast.py's own _fit()) exactly as deployed. True reproduces
    the pre-fix behavior (yearly_seasonality always on) for comparison."""
    if force_yearly is None:
        model = current_forecast_module._fit(train_df)
    else:
        model = Prophet(
            yearly_seasonality=force_yearly,
            weekly_seasonality=False,
            daily_seasonality=False,
            interval_width=0.95,
            changepoint_prior_scale=0.05,
            seasonality_mode="additive",
        )
        model.fit(train_df)
    future = model.make_future_dataframe(periods=h, freq="MS")
    fc = model.predict(future)
    return fc["yhat"].iloc[-h:].clip(lower=0).tolist()


def main():
    if not os.path.exists(DATA_FILE):
        print(f"No {DATA_FILE} found.")
        print("Run `pnpm tsx scripts/backtest-forecast-real-data.ts` first "
              "(with DATABASE_URL pointing at real data) to generate it.")
        sys.exit(1)

    with open(DATA_FILE) as fh:
        orgs = json.load(fh)

    if not orgs:
        print("No orgs with enough historical data points were found (need >= "
              f"{current_forecast_module.MIN_DATA_POINTS} months). Nothing to backtest yet — "
              "re-run once orgs have accumulated more history.")
        return

    current_scores, pre_fix_scores = [], []
    rows = []
    for org in orgs:
        dates, values = org["dates"], org["values"]
        n = len(values)
        if n < current_forecast_module.MIN_DATA_POINTS:
            continue
        h = holdout_len(n)
        df = pd.DataFrame({"ds": pd.to_datetime(dates), "y": values})
        train, test = df.iloc[:-h], df.iloc[-h:]
        actual = test["y"].tolist()

        current_mape = None
        pre_fix_mape = None
        try:
            current_pred = fit_predict(train, h, force_yearly=None)
            current_mape = mape(actual, current_pred)
        except Exception:
            pass
        try:
            pre_fix_pred = fit_predict(train, h, force_yearly=True)
            pre_fix_mape = mape(actual, pre_fix_pred)
        except Exception:
            pass

        if current_mape is not None:
            current_scores.append(current_mape)
        if pre_fix_mape is not None:
            pre_fix_scores.append(pre_fix_mape)

        rows.append({
            "orgId": org.get("orgId", "?"),
            "months": n,
            "holdout": h,
            "current_gated_mape": round(current_mape, 2) if current_mape is not None else None,
            "pre_fix_always_yearly_mape": round(pre_fix_mape, 2) if pre_fix_mape is not None else None,
        })

    print(f"{'orgId':<30} {'months':>7} {'holdout':>8} {'gated MAPE':>12} {'pre-fix MAPE':>14}")
    for r in rows:
        print(f"{r['orgId']:<30} {r['months']:>7} {r['holdout']:>8} "
              f"{str(r['current_gated_mape']):>12} {str(r['pre_fix_always_yearly_mape']):>14}")

    if current_scores and pre_fix_scores:
        print()
        print(f"Current (length-gated):  mean={np.mean(current_scores):.2f}  "
              f"median={np.median(current_scores):.2f}  n={len(current_scores)}")
        print(f"Pre-fix (always yearly): mean={np.mean(pre_fix_scores):.2f}  "
              f"median={np.median(pre_fix_scores):.2f}  n={len(pre_fix_scores)}")
        improvement = np.median(pre_fix_scores) - np.median(current_scores)
        verdict = "better" if improvement > 0 else ("worse" if improvement < 0 else "no change")
        print(f"Median MAPE delta: {improvement:+.2f} points ({verdict} with the length-gating fix)")


if __name__ == "__main__":
    main()
