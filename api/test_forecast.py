"""
Regression tests for api/forecast.py.

Run: pip install -r requirements.txt -r requirements-dev.txt && pytest api/

These exist to lock in the yearly_seasonality length-gating fix: Prophet's
own documentation warns that enabling yearly seasonality with less than
~730 days (24 monthly points) of history leaves it under-identified.
Backtested against 80 synthetic monthly series spanning this platform's
actual archetypes, gating it off below that threshold cut median holdout
MAPE from 51% to 20% (see the commit that introduced
YEARLY_SEASONALITY_MIN_POINTS for the full comparison). Without a test,
a future edit could silently re-enable yearly_seasonality unconditionally
and nothing would flag it.
"""
import logging
import os
import sys
import warnings

warnings.filterwarnings("ignore")
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

sys.path.insert(0, os.path.dirname(__file__))

import pandas as pd
import pytest

import forecast as f


def _make_points(n, start="2022-01-01", monthly_value=lambda i: 100 + i * 2):
    dates = pd.date_range(start=start, periods=n, freq="MS")
    return [
        f.ForecastPoint(date=d.strftime("%Y-%m-%d"), value=float(monthly_value(i)))
        for i, d in enumerate(dates)
    ]


class TestYearlySeasonalityGating:
    """Uses the same oracle api/forecast.py's own metadata construction
    relies on ("yearly" in forecast_df.columns) rather than reaching into
    Prophet internals that could change between versions."""

    def test_disabled_below_threshold(self):
        n = f.YEARLY_SEASONALITY_MIN_POINTS - 1
        df = pd.DataFrame({
            "ds": pd.date_range("2022-01-01", periods=n, freq="MS"),
            "y": [100.0 + i for i in range(n)],
        })
        model = f._fit(df)
        forecast_df = model.predict(model.make_future_dataframe(periods=1, freq="MS"))
        assert "yearly" not in forecast_df.columns

    def test_enabled_at_threshold(self):
        n = f.YEARLY_SEASONALITY_MIN_POINTS
        df = pd.DataFrame({
            "ds": pd.date_range("2022-01-01", periods=n, freq="MS"),
            "y": [100.0 + i for i in range(n)],
        })
        model = f._fit(df)
        forecast_df = model.predict(model.make_future_dataframe(periods=1, freq="MS"))
        assert "yearly" in forecast_df.columns

    def test_enabled_above_threshold(self):
        n = f.YEARLY_SEASONALITY_MIN_POINTS + 12
        df = pd.DataFrame({
            "ds": pd.date_range("2022-01-01", periods=n, freq="MS"),
            "y": [100.0 + i for i in range(n)],
        })
        model = f._fit(df)
        forecast_df = model.predict(model.make_future_dataframe(periods=1, freq="MS"))
        assert "yearly" in forecast_df.columns


class TestForecastEndpoint:
    def test_short_series_end_to_end(self):
        req = f.ForecastRequest(points=_make_points(12), periods=3)
        resp = f.forecast(req, x_forecast_secret=None)
        assert resp.method == "prophet"
        assert len(resp.predictions) == 3
        assert 0.0 <= resp.accuracy <= 100.0
        assert resp.trainingDataPoints >= f.MIN_DATA_POINTS
        # Below the gating threshold, forecast_df has no "yearly" column —
        # this asserts the fallback-to-0.0 branch runs cleanly rather than
        # raising a KeyError, which is exactly what would break if that
        # guard were ever removed.
        assert resp.metadata["seasonalComponent"] == 0.0

    def test_long_series_end_to_end(self):
        req = f.ForecastRequest(points=_make_points(30), periods=6)
        resp = f.forecast(req, x_forecast_secret=None)
        assert resp.method == "prophet"
        assert len(resp.predictions) == 6
        assert 0.0 <= resp.accuracy <= 100.0

    def test_rejects_too_few_points(self):
        req = f.ForecastRequest(points=_make_points(f.MIN_DATA_POINTS - 1), periods=3)
        with pytest.raises(Exception):
            f.forecast(req, x_forecast_secret=None)

    def test_predictions_are_non_negative(self):
        # Emissions/activity data is never negative — verify the floor is applied
        # even when the underlying trend would otherwise go negative.
        points = _make_points(18, monthly_value=lambda i: max(0, 50 - i * 5))
        req = f.ForecastRequest(points=points, periods=6)
        resp = f.forecast(req, x_forecast_secret=None)
        assert all(p.forecast >= 0.0 for p in resp.predictions)
        assert all(p.lowerBound >= 0.0 for p in resp.predictions)

    def test_service_secret_enforced(self, monkeypatch):
        monkeypatch.setattr(f, "SERVICE_SECRET", "test-secret")
        req = f.ForecastRequest(points=_make_points(12), periods=3)
        with pytest.raises(Exception):
            f.forecast(req, x_forecast_secret="wrong-secret")
        resp = f.forecast(req, x_forecast_secret="test-secret")
        assert resp.method == "prophet"


class TestRemoveOutliers:
    def test_skips_removal_when_it_would_leave_too_little_data(self):
        # 12 points with one wild outlier — IQR removal would drop below
        # MIN_DATA_POINTS, so it must be a no-op (a few genuine spikes are
        # better training signal than an empty series).
        values = [100.0] * 11 + [10000.0]
        df = pd.DataFrame({
            "ds": pd.date_range("2022-01-01", periods=12, freq="MS"),
            "y": values,
        })
        result = f._remove_outliers(df)
        assert len(result) == 12

    def test_removes_outliers_with_enough_data(self):
        # 30 points with two wild outliers — removal should still leave
        # >= MIN_DATA_POINTS, so it should actually filter them out.
        values = [100.0 + (i % 5) for i in range(30)]
        values[10] = 100000.0
        values[20] = -50000.0
        df = pd.DataFrame({
            "ds": pd.date_range("2022-01-01", periods=30, freq="MS"),
            "y": values,
        })
        result = f._remove_outliers(df)
        assert len(result) < 30
        assert len(result) >= f.MIN_DATA_POINTS


class TestComputeAccuracy:
    def test_holdout_path_for_longer_series(self):
        df = pd.DataFrame({
            "ds": pd.date_range("2022-01-01", periods=24, freq="MS"),
            "y": [100.0 + i * 2 for i in range(24)],
        })
        accuracy, confidence = f._compute_accuracy(df)
        assert confidence == "holdout"
        assert 0.0 <= accuracy <= 100.0

    def test_low_confidence_path_for_minimal_series(self):
        n = f.MIN_DATA_POINTS
        df = pd.DataFrame({
            "ds": pd.date_range("2022-01-01", periods=n, freq="MS"),
            "y": [100.0 + i for i in range(n)],
        })
        accuracy, confidence = f._compute_accuracy(df)
        assert confidence == "low"
        assert 0.0 <= accuracy <= 100.0
