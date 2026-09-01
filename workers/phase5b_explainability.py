#!/usr/bin/env python3
"""
Phase 5B: Model Explainability with SHAP
Explains which features drive emissions predictions using SHAP values.
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Tuple
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import shap
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

class EmissionsExplainer:
    def __init__(self, org_id: str, emission_calculation_id: str):
        self.org_id = org_id
        self.emission_calculation_id = emission_calculation_id
        self.session = requests.Session()
        if API_SECRET_TOKEN:
            self.session.headers.update({
                'Authorization': f'Bearer {API_SECRET_TOKEN}',
                'Content-Type': 'application/json'
            })

    def fetch_calculation_context(self) -> Dict[str, Any]:
        """Fetch the emission calculation and related data."""
        try:
            endpoint = (
                f"{API_BASE_URL}/api/orgs/{self.org_id}/calculations/"
                f"{self.emission_calculation_id}"
            )
            response = self.session.get(endpoint)
            response.raise_for_status()
            return response.json()

        except Exception as e:
            logger.error(f"Error fetching calculation context: {e}")
            raise

    def fetch_training_data(self) -> Tuple[pd.DataFrame, pd.Series]:
        """Fetch historical emissions data for training baseline model."""
        try:
            endpoint = (
                f"{API_BASE_URL}/api/orgs/{self.org_id}/activity-records"
                f"?limit=1000"
            )
            response = self.session.get(endpoint)
            response.raise_for_status()

            data = response.json()
            records = data.get('records', [])

            if not records:
                logger.warning("No training data available")
                return pd.DataFrame(), pd.Series()

            # Feature engineering
            df_data = []
            y_data = []

            for record in records:
                try:
                    # Extract features
                    features = {
                        'activity_volume': float(record.get('normalizedAmount', 0)),
                        'facility_id_encoded': hash(str(record.get('facilityId', ''))) % 100,
                        'category_id_encoded': hash(str(record.get('categoryId', ''))) % 100,
                        'month': pd.to_datetime(record.get('activityDate')).month,
                        'year': pd.to_datetime(record.get('activityDate')).year,
                    }

                    # Calculate emissions (simplified)
                    emissions = float(record.get('normalizedAmount', 0)) * 0.5  # Placeholder factor

                    df_data.append(features)
                    y_data.append(emissions)
                except Exception as e:
                    logger.debug(f"Error processing record: {e}")
                    continue

            if not df_data:
                logger.warning("No valid training data")
                return pd.DataFrame(), pd.Series()

            X = pd.DataFrame(df_data)
            y = pd.Series(y_data)

            logger.info(f"Loaded {len(X)} training samples for explanation")
            return X, y

        except Exception as e:
            logger.error(f"Error fetching training data: {e}")
            raise

    def train_explanation_model(self, X: pd.DataFrame, y: pd.Series) -> Tuple[RandomForestRegressor, StandardScaler]:
        """Train a simple model for feature importance extraction."""
        try:
            # Scale features
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            # Train Random Forest for feature importance
            model = RandomForestRegressor(
                n_estimators=100,
                random_state=42,
                max_depth=10,
                n_jobs=-1
            )
            model.fit(X_scaled, y)

            logger.info(f"Explanation model trained with R²={model.score(X_scaled, y):.3f}")
            return model, scaler

        except Exception as e:
            logger.error(f"Error training explanation model: {e}")
            raise

    def generate_explanations(
        self,
        model: RandomForestRegressor,
        scaler: StandardScaler,
        X: pd.DataFrame,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate SHAP-based feature importance explanations."""
        try:
            # Scale data
            X_scaled = scaler.transform(X)

            # Create SHAP explainer
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X_scaled)

            # Calculate mean absolute SHAP values
            if isinstance(shap_values, list):
                # For multi-output models
                mean_shap = np.mean(np.abs(shap_values[0]), axis=0)
            else:
                mean_shap = np.mean(np.abs(shap_values), axis=0)

            # Get base value
            base_value = float(explainer.expected_value) if isinstance(explainer.expected_value, (int, float)) else 0

            # Prepare feature importance array
            feature_importance = []
            for i, col in enumerate(X.columns):
                importance = float(mean_shap[i]) if i < len(mean_shap) else 0.0
                feature_importance.append({
                    'feature_name': col,
                    'importance_value': round(importance, 4),
                    'impact_direction': 'positive' if mean_shap[i] > 0 else 'negative',
                    'confidence': 0.85
                })

            # Sort by importance
            feature_importance.sort(key=lambda x: x['importance_value'], reverse=True)

            # Top driver
            top_driver = feature_importance[0] if feature_importance else {
                'feature_name': 'activity_volume',
                'importance_value': 0.0,
                'impact_direction': 'positive',
                'confidence': 0.0
            }

            # Calculate prediction for context record
            activity_volume = float(context.get('normalizedAmount', 0))
            prediction_value = activity_volume * 0.5  # Placeholder
            factor_contribution = prediction_value * 0.4
            activity_contribution = prediction_value * 0.5
            methodology_contribution = prediction_value * 0.1

            # What-if scenarios
            what_if_scenarios = [
                {
                    'scenario_name': 'activity_reduced_20',
                    'predicted_value': round(prediction_value * 0.8, 2),
                    'change_pct': -20
                },
                {
                    'scenario_name': 'activity_increased_20',
                    'predicted_value': round(prediction_value * 1.2, 2),
                    'change_pct': 20
                }
            ]

            return {
                'feature_importance': feature_importance,
                'top_driver_feature': top_driver['feature_name'],
                'top_driver_contribution_pct': round(top_driver['importance_value'] * 100, 2),
                'base_value': round(base_value, 2),
                'prediction_value': round(prediction_value, 2),
                'prediction_delta': round(prediction_value - base_value, 2),
                'factor_contribution': round(factor_contribution, 2),
                'activity_contribution': round(activity_contribution, 2),
                'methodology_contribution': round(methodology_contribution, 2),
                'explanation_text': (
                    f"Emissions primarily driven by {top_driver['feature_name']} "
                    f"({top_driver['importance_value']*100:.1f}%). "
                    f"Predicted value: {prediction_value} CO2e tonnes. "
                    f"Based on {len(X)} historical records."
                ),
                'what_if_scenarios': what_if_scenarios
            }

        except Exception as e:
            logger.error(f"Error generating explanations: {e}")
            raise

    def save_explanations(self, explanation_result: Dict[str, Any]) -> bool:
        """Save explanations to database via API."""
        try:
            endpoint = f"{API_BASE_URL}/api/orgs/{self.org_id}/explanations"

            payload = {
                'organizationId': self.org_id,
                'emissionCalculationId': self.emission_calculation_id,
                'featureImportance': json.dumps(explanation_result['feature_importance']),
                'topDriverFeature': explanation_result['top_driver_feature'],
                'topDriverContributionPct': explanation_result['top_driver_contribution_pct'],
                'baseValue': explanation_result['base_value'],
                'predictionValue': explanation_result['prediction_value'],
                'predictionDelta': explanation_result['prediction_delta'],
                'factorContribution': explanation_result['factor_contribution'],
                'activityContribution': explanation_result['activity_contribution'],
                'methodologyContribution': explanation_result['methodology_contribution'],
                'explanationText': explanation_result['explanation_text'],
                'whatIfScenarios': json.dumps(explanation_result['what_if_scenarios'])
            }

            response = self.session.post(endpoint, json=payload)
            response.raise_for_status()

            logger.info("Explanations saved successfully")
            return True

        except Exception as e:
            logger.error(f"Error saving explanations: {e}")
            return False

    def run(self) -> bool:
        """Execute complete explainability pipeline."""
        try:
            logger.info(
                f"Starting explainability analysis for "
                f"calculation={self.emission_calculation_id}"
            )

            # Fetch context
            context = self.fetch_calculation_context()

            # Fetch training data
            X, y = self.fetch_training_data()
            if X.empty or y.empty:
                logger.error("Insufficient training data")
                return False

            # Train model
            model, scaler = self.train_explanation_model(X, y)

            # Generate explanations
            explanation_result = self.generate_explanations(model, scaler, X, context)

            # Save results
            return self.save_explanations(explanation_result)

        except Exception as e:
            logger.error(f"Explainability pipeline failed: {e}")
            return False


def explain_emissions(org_id: str, emission_calculation_id: str) -> bool:
    """Main entry point for explainability job."""
    explainer = EmissionsExplainer(org_id, emission_calculation_id)
    return explainer.run()


if __name__ == '__main__':
    # Example usage
    import sys

    if len(sys.argv) != 3:
        print("Usage: python phase5b_explainability.py <org_id> <emission_calculation_id>")
        sys.exit(1)

    org_id = sys.argv[1]
    emission_calculation_id = sys.argv[2]

    success = explain_emissions(org_id, emission_calculation_id)
    sys.exit(0 if success else 1)
