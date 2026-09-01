#!/usr/bin/env python3
"""
Phase 5A: Time-Series Emissions Forecasting with Prophet
Generates forecasts for emissions based on historical data.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any
import pandas as pd
import numpy as np
from prophet import Prophet
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:3000')
API_SECRET_TOKEN = os.getenv('PYTHON_WORKER_SECRET_TOKEN', '')
FORECAST_HORIZON_MONTHS = 12
MIN_DATA_POINTS = 12  # Minimum historical months for training

class EmissionsForecaster:
    def __init__(self, org_id: str, facility_id: str, category_id: str):
        self.org_id = org_id
        self.facility_id = facility_id
        self.category_id = category_id
        self.session = requests.Session()
        if API_SECRET_TOKEN:
            self.session.headers.update({
                'Authorization': f'Bearer {API_SECRET_TOKEN}',
                'Content-Type': 'application/json'
            })

    def fetch_historical_data(self) -> pd.DataFrame:
        """Fetch historical emissions data from API."""
        try:
            endpoint = (
                f"{API_BASE_URL}/api/orgs/{self.org_id}/activity-records"
                f"?facilityId={self.facility_id}&categoryId={self.category_id}"
                f"&limit=500"
            )
            response = self.session.get(endpoint)
            response.raise_for_status()

            data = response.json()
            records = data.get('records', [])

            if not records:
                logger.warning(f"No historical data found for facility {self.facility_id}")
                return pd.DataFrame()

            # Convert to time series DataFrame
            df = pd.DataFrame([
                {
                    'ds': pd.to_datetime(r['activityDate']),
                    'y': float(r['normalizedAmount'])
                }
                for r in records
                if r.get('normalizedAmount') is not None
            ])

            # Sort by date and aggregate by day (sum if multiple records per day)
            df = df.sort_values('ds')
            df = df.groupby('ds')['y'].sum().reset_index()

            logger.info(f"Loaded {len(df)} data points for forecasting")
            return df

        except Exception as e:
            logger.error(f"Error fetching historical data: {e}")
            raise

    def validate_data(self, df: pd.DataFrame) -> bool:
        """Validate that data is suitable for forecasting."""
        if df.empty:
            logger.error("No data available for forecasting")
            return False

        if len(df) < MIN_DATA_POINTS:
            logger.error(
                f"Insufficient data: {len(df)} points, minimum {MIN_DATA_POINTS} required"
            )
            return False

        # Check for excessive nulls
        if df['y'].isna().sum() > len(df) * 0.2:
            logger.error("Too many missing values in time series")
            return False

        # Remove outliers using IQR method
        Q1 = df['y'].quantile(0.25)
        Q3 = df['y'].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR

        outlier_count = ((df['y'] < lower_bound) | (df['y'] > upper_bound)).sum()
        if outlier_count > len(df) * 0.1:
            logger.warning(f"Found {outlier_count} outliers, removing")
            df = df[(df['y'] >= lower_bound) & (df['y'] <= upper_bound)]

        return len(df) >= MIN_DATA_POINTS

    def train_forecast_model(self, df: pd.DataFrame) -> Prophet:
        """Train Prophet model with emissions-specific seasonality."""
        try:
            model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
                interval_width=0.95,
                changepoint_prior_scale=0.05,
                seasonality_mode='additive',
                seasonality_prior_scale=10
            )

            # Add monthly seasonality (common for emissions)
            model.add_seasonality(
                name='monthly',
                period=30.5,
                fourier_order=5
            )

            model.fit(df)
            logger.info("Prophet model trained successfully")
            return model

        except Exception as e:
            logger.error(f"Error training Prophet model: {e}")
            raise

    def generate_forecast(self, model: Prophet) -> Dict[str, Any]:
        """Generate future forecast."""
        try:
            future = model.make_future_dataframe(periods=FORECAST_HORIZON_MONTHS, freq='MS')
            forecast = model.predict(future)

            # Calculate accuracy metrics on historical data
            forecast_historical = forecast[forecast['ds'] <= datetime.now()]

            # Simple accuracy metrics
            mape = self._calculate_mape(
                forecast_historical,
                forecast_historical['yhat'],
                forecast_historical['y'] if 'y' in forecast_historical else None
            )

            rmse = self._calculate_rmse(forecast_historical)

            # Extract future forecast points
            future_forecast = forecast[forecast['ds'] > datetime.now()].copy()

            forecast_data = []
            for _, row in future_forecast.iterrows():
                forecast_data.append({
                    'date': row['ds'].strftime('%Y-%m-%d'),
                    'predicted_value': round(float(row['yhat']), 2),
                    'lower_ci': round(float(row['yhat_lower']), 2),
                    'upper_ci': round(float(row['yhat_upper']), 2),
                    'confidence': 0.95
                })

            logger.info(f"Generated {len(forecast_data)} forecast points")

            return {
                'forecast_data': forecast_data,
                'mape': round(mape, 2) if mape else None,
                'rmse': round(rmse, 2) if rmse else None,
                'mae': None,
                'r_squared': None,
                'model_confidence': 0.75 if len(forecast_data) > 6 else 0.5,
                'data_quality_score': 0.8 if len(forecast_data) > 12 else 0.6
            }

        except Exception as e:
            logger.error(f"Error generating forecast: {e}")
            raise

    @staticmethod
    def _calculate_mape(forecast_df: pd.DataFrame, predicted: pd.Series, actual: pd.Series = None) -> float:
        """Calculate Mean Absolute Percentage Error."""
        if actual is None or actual.isna().all():
            return None

        try:
            mask = ~actual.isna() & ~predicted.isna()
            if mask.sum() == 0:
                return None

            actual_vals = actual[mask].values
            predicted_vals = predicted[mask].values

            # Avoid division by zero
            if (actual_vals == 0).any():
                return None

            mape = np.mean(np.abs((actual_vals - predicted_vals) / actual_vals)) * 100
            return float(mape)
        except Exception as e:
            logger.warning(f"Error calculating MAPE: {e}")
            return None

    @staticmethod
    def _calculate_rmse(forecast_df: pd.DataFrame) -> float:
        """Calculate Root Mean Squared Error."""
        try:
            if 'y' not in forecast_df.columns:
                return None

            mask = ~forecast_df['y'].isna()
            if mask.sum() == 0:
                return None

            residuals = forecast_df[mask]['y'] - forecast_df[mask]['yhat']
            rmse = np.sqrt(np.mean(residuals ** 2))
            return float(rmse)
        except Exception as e:
            logger.warning(f"Error calculating RMSE: {e}")
            return None

    def save_forecast(self, forecast_result: Dict[str, Any]) -> bool:
        """Save forecast to database via API."""
        try:
            endpoint = f"{API_BASE_URL}/api/orgs/{self.org_id}/forecasts"

            payload = {
                'organizationId': self.org_id,
                'facilityId': self.facility_id,
                'categoryId': self.category_id,
                'trainingPeriodMonths': 12,
                'trainingDataPoints': 12,  # Will be updated by API
                'forecastHorizonMonths': FORECAST_HORIZON_MONTHS,
                'forecastStartDate': datetime.now().strftime('%Y-%m-%d'),
                'forecastEndDate': (
                    datetime.now() + timedelta(days=30 * FORECAST_HORIZON_MONTHS)
                ).strftime('%Y-%m-%d'),
                'forecastData': json.dumps(forecast_result['forecast_data']),
                'forecastMethod': 'exponential_smoothing',
                'mape': forecast_result['mape'],
                'rmse': forecast_result['rmse'],
                'mae': forecast_result['mae'],
                'rSquared': forecast_result['r_squared'],
                'modelConfidence': forecast_result['model_confidence'],
                'dataQualityScore': forecast_result['data_quality_score'],
                'anomalyDetectionApplied': False
            }

            response = self.session.post(endpoint, json=payload)
            response.raise_for_status()

            logger.info(f"Forecast saved successfully")
            return True

        except Exception as e:
            logger.error(f"Error saving forecast: {e}")
            return False

    def run(self) -> bool:
        """Execute complete forecasting pipeline."""
        try:
            logger.info(
                f"Starting forecast for org={self.org_id}, "
                f"facility={self.facility_id}, category={self.category_id}"
            )

            # Fetch and validate data
            df = self.fetch_historical_data()
            if not self.validate_data(df):
                return False

            # Train model
            model = self.train_forecast_model(df)

            # Generate forecast
            forecast_result = self.generate_forecast(model)

            # Save results
            return self.save_forecast(forecast_result)

        except Exception as e:
            logger.error(f"Forecasting pipeline failed: {e}")
            return False


def forecast_emissions(org_id: str, facility_id: str, category_id: str) -> bool:
    """Main entry point for forecasting job."""
    forecaster = EmissionsForecaster(org_id, facility_id, category_id)
    return forecaster.run()


if __name__ == '__main__':
    # Example usage
    import sys

    if len(sys.argv) != 4:
        print("Usage: python phase5a_forecasting.py <org_id> <facility_id> <category_id>")
        sys.exit(1)

    org_id = sys.argv[1]
    facility_id = sys.argv[2]
    category_id = sys.argv[3]

    success = forecast_emissions(org_id, facility_id, category_id)
    sys.exit(0 if success else 1)
