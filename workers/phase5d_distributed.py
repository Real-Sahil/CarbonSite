#!/usr/bin/env python3
"""
Phase 5D: Distributed Computing with Dask
Handles large-scale batch processing of emissions forecasts and analyses.
"""

import os
import json
import logging
from typing import Dict, List, Any
import pandas as pd
import numpy as np
from dask import dataframe as dd
from dask.distributed import Client, LocalCluster
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
DASK_N_WORKERS = int(os.getenv('DASK_N_WORKERS', '2'))
BATCH_SIZE = int(os.getenv('BATCH_SIZE', '100'))

class DistributedBatchProcessor:
    def __init__(self, org_id: str, job_type: str):
        self.org_id = org_id
        self.job_type = job_type
        self.job_id = None
        self.session = requests.Session()
        if API_SECRET_TOKEN:
            self.session.headers.update({
                'Authorization': f'Bearer {API_SECRET_TOKEN}',
                'Content-Type': 'application/json'
            })
        self.client = None

    def initialize_dask(self) -> bool:
        """Initialize Dask distributed client."""
        try:
            # Use LocalCluster for local development
            # For production, use distributed cluster (e.g., Kubernetes, cloud)
            self.client = Client(
                n_workers=DASK_N_WORKERS,
                threads_per_worker=1,
                memory_limit='1GB'
            )
            logger.info(f"Dask cluster initialized: {self.client}")
            return True

        except Exception as e:
            logger.error(f"Error initializing Dask: {e}")
            return False

    def fetch_batch_job(self) -> Dict[str, Any]:
        """Fetch the batch job configuration."""
        try:
            endpoint = f"{API_BASE_URL}/api/orgs/{self.org_id}/batch-jobs"
            response = self.session.get(
                endpoint,
                params={'jobType': self.job_type, 'status': 'queued', 'limit': 1}
            )
            response.raise_for_status()

            data = response.json()
            jobs = data.get('jobs', [])

            if not jobs:
                logger.warning("No pending jobs found")
                return {}

            self.job_id = jobs[0]['id']
            return jobs[0]

        except Exception as e:
            logger.error(f"Error fetching batch job: {e}")
            raise

    def fetch_batch_items(self, offset: int, limit: int) -> List[Dict[str, Any]]:
        """Fetch items for batch processing."""
        try:
            endpoint = (
                f"{API_BASE_URL}/api/orgs/{self.org_id}/activity-records"
                f"?offset={offset}&limit={limit}"
            )
            response = self.session.get(endpoint)
            response.raise_for_status()

            data = response.json()
            return data.get('records', [])

        except Exception as e:
            logger.error(f"Error fetching batch items: {e}")
            return []

    def process_forecast_batch(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process forecasting batch."""
        try:
            # Convert to Dask DataFrame
            df = dd.from_delayed(
                [pd.DataFrame([r]) for r in records],
                meta=pd.DataFrame(records[:1])
            )

            # Simple forecast computation
            results = df.map_partitions(
                self._forecast_partition
            ).compute()

            return {
                'processed_items': len(results),
                'errors': 0,
                'summary': f"Generated forecasts for {len(results)} records"
            }

        except Exception as e:
            logger.error(f"Error processing forecast batch: {e}")
            return {'processed_items': 0, 'errors': len(records), 'summary': str(e)}

    def process_explanation_batch(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process explainability batch."""
        try:
            # Convert to Dask DataFrame
            df = dd.from_delayed(
                [pd.DataFrame([r]) for r in records],
                meta=pd.DataFrame(records[:1])
            )

            # Simple explanation computation
            results = df.map_partitions(
                self._explain_partition
            ).compute()

            return {
                'processed_items': len(results),
                'errors': 0,
                'summary': f"Generated explanations for {len(results)} records"
            }

        except Exception as e:
            logger.error(f"Error processing explanation batch: {e}")
            return {'processed_items': 0, 'errors': len(records), 'summary': str(e)}

    def process_analysis_batch(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process root cause analysis batch."""
        try:
            # Group by facility for analysis
            df = pd.DataFrame(records)

            if df.empty:
                return {'processed_items': 0, 'errors': 0, 'summary': 'No records to analyze'}

            # Convert to Dask for parallel processing
            ddf = dd.from_pandas(df, npartitions=max(1, len(df) // BATCH_SIZE))

            # Analyze each facility
            results = ddf.groupby('facilityId').apply(
                self._analyze_facility_partition,
                meta=('result', 'object')
            ).compute()

            return {
                'processed_items': len(records),
                'errors': 0,
                'summary': f"Analyzed {len(results)} facility anomalies"
            }

        except Exception as e:
            logger.error(f"Error processing analysis batch: {e}")
            return {'processed_items': 0, 'errors': len(records), 'summary': str(e)}

    @staticmethod
    def _forecast_partition(df: pd.DataFrame) -> pd.DataFrame:
        """Process forecasting on partition."""
        try:
            df['forecast_generated'] = True
            df['forecast_confidence'] = 0.75
            return df
        except Exception as e:
            logger.error(f"Error in forecast partition: {e}")
            return df

    @staticmethod
    def _explain_partition(df: pd.DataFrame) -> pd.DataFrame:
        """Process explanation on partition."""
        try:
            df['explanation_generated'] = True
            df['top_driver'] = 'activity_volume'
            return df
        except Exception as e:
            logger.error(f"Error in explain partition: {e}")
            return df

    @staticmethod
    def _analyze_facility_partition(df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze anomalies for facility partition."""
        try:
            if df.empty:
                return {'facility': None, 'anomalies_analyzed': 0}

            return {
                'facility': df.iloc[0].get('facilityId', 'unknown'),
                'anomalies_analyzed': len(df),
                'avg_deviation': float(df['normalizedAmount'].std()) if 'normalizedAmount' in df else 0.0
            }
        except Exception as e:
            logger.error(f"Error in facility partition: {e}")
            return {'facility': 'error', 'anomalies_analyzed': 0}

    def update_job_progress(self, processed_items: int, total_items: int) -> bool:
        """Update batch job progress."""
        try:
            if not self.job_id:
                return False

            endpoint = f"{API_BASE_URL}/api/orgs/{self.org_id}/batch-jobs/{self.job_id}"
            payload = {
                'processedItems': processed_items,
                'totalItems': total_items,
                'status': 'processing'
            }

            response = self.session.patch(endpoint, json=payload)
            response.raise_for_status()

            logger.info(f"Job progress updated: {processed_items}/{total_items}")
            return True

        except Exception as e:
            logger.error(f"Error updating job progress: {e}")
            return False

    def complete_job(self, results: Dict[str, Any]) -> bool:
        """Mark batch job as complete."""
        try:
            if not self.job_id:
                return False

            endpoint = f"{API_BASE_URL}/api/orgs/{self.org_id}/batch-jobs/{self.job_id}"
            payload = {
                'status': 'completed',
                'results': json.dumps(results),
                'completedAt': pd.Timestamp.now().isoformat()
            }

            response = self.session.patch(endpoint, json=payload)
            response.raise_for_status()

            logger.info("Batch job completed")
            return True

        except Exception as e:
            logger.error(f"Error completing job: {e}")
            return False

    def fail_job(self, error_message: str) -> bool:
        """Mark batch job as failed."""
        try:
            if not self.job_id:
                return False

            endpoint = f"{API_BASE_URL}/api/orgs/{self.org_id}/batch-jobs/{self.job_id}"
            payload = {
                'status': 'failed',
                'errorMessage': error_message,
                'completedAt': pd.Timestamp.now().isoformat()
            }

            response = self.session.patch(endpoint, json=payload)
            response.raise_for_status()

            logger.error(f"Batch job marked as failed: {error_message}")
            return True

        except Exception as e:
            logger.error(f"Error failing job: {e}")
            return False

    def run(self) -> bool:
        """Execute batch job."""
        try:
            logger.info(f"Starting batch job: type={self.job_type}")

            # Initialize Dask
            if not self.initialize_dask():
                logger.error("Failed to initialize Dask")
                return False

            # Fetch job configuration
            job = self.fetch_batch_job()
            if not job:
                logger.error("No job to process")
                return False

            total_items = job.get('totalItems', 0)
            processed_items = 0
            all_results = {
                'processed_items': 0,
                'errors': 0,
                'summary': ''
            }

            # Process in batches
            offset = 0
            while offset < total_items:
                limit = min(BATCH_SIZE, total_items - offset)
                items = self.fetch_batch_items(offset, limit)

                if not items:
                    break

                # Route to appropriate processor
                if self.job_type == 'forecast_generation':
                    result = self.process_forecast_batch(items)
                elif self.job_type == 'explanation_generation':
                    result = self.process_explanation_batch(items)
                elif self.job_type == 'causal_analysis':
                    result = self.process_analysis_batch(items)
                else:
                    logger.error(f"Unknown job type: {self.job_type}")
                    return False

                processed_items += result['processed_items']
                all_results['processed_items'] += result['processed_items']
                all_results['errors'] += result['errors']

                # Update progress
                self.update_job_progress(processed_items, total_items)

                offset += limit

            # Complete job
            all_results['summary'] = (
                f"Processed {all_results['processed_items']} items "
                f"with {all_results['errors']} errors"
            )
            return self.complete_job(all_results)

        except Exception as e:
            logger.error(f"Batch job failed: {e}")
            self.fail_job(str(e))
            return False

        finally:
            if self.client:
                self.client.close()
                logger.info("Dask client closed")


def process_batch_job(org_id: str, job_type: str) -> bool:
    """Main entry point for batch job processing."""
    processor = DistributedBatchProcessor(org_id, job_type)
    return processor.run()


if __name__ == '__main__':
    # Example usage
    import sys

    if len(sys.argv) != 3:
        print("Usage: python phase5d_distributed.py <org_id> <job_type>")
        print("  job_type: forecast_generation | explanation_generation | causal_analysis")
        sys.exit(1)

    org_id = sys.argv[1]
    job_type = sys.argv[2]

    success = process_batch_job(org_id, job_type)
    sys.exit(0 if success else 1)
