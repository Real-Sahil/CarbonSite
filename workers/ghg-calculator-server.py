#!/usr/bin/env python3
"""
FastAPI server wrapping ghg-calculator for CarbonSite PoC.

Exposes ghg-calculator's calculation and factor lookup APIs via HTTP/JSON.
Matches the Typescript GhgCalculatorClient interface defined in
lib/calculation/ghg-calculator-client.ts
"""

import os
import logging
from typing import Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import uvicorn

# Note: ghg-calculator is installed via pip install -e .
# For MVP, we'll define placeholder types and mock responses.
# Real integration will call actual ghg-calculator methods.

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "info").upper(),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = FastAPI(
    title="ghg-calculator FastAPI",
    description="HTTP wrapper for carbonpathio/ghg-calculator",
    version="1.0.0",
)

# === Request/Response Models ===

class Geography(BaseModel):
    country: Optional[str] = None
    region: Optional[str] = None


class CalculateRequest(BaseModel):
    amount: float
    unit: str
    scope: str  # "scope1" | "scope2" | "scope3"
    category: str  # "stationary_fuel", "electricity", etc.
    activityType: Optional[str] = None
    geography: Optional[Geography] = None
    date: str  # ISO 8601


class GasBreakdown(BaseModel):
    co2: Optional[float] = None
    ch4: Optional[float] = None
    n2o: Optional[float] = None
    co2e: Optional[float] = None


class CalculateResponse(BaseModel):
    totalCo2e: float
    gases: GasBreakdown
    factorId: str
    factorLibraryVersion: str
    formula: str
    warnings: Optional[list[str]] = []


class FactorInfo(BaseModel):
    id: str
    externalId: Optional[str] = None
    scope: str
    category: str
    activityType: Optional[str] = None
    inputUnit: str
    gases: GasBreakdown
    geography: Optional[Dict[str, str]] = None
    libraryVersion: str
    effectiveStartDate: Optional[str] = None
    effectiveEndDate: Optional[str] = None


class FactorsResponse(BaseModel):
    factors: list[FactorInfo]
    totalCount: int


class LibraryInfo(BaseModel):
    version: str
    factorCount: int
    sources: list[str]


# === Health / Info Endpoints ===

@app.get("/info", response_model=LibraryInfo)
async def get_info():
    """Return ghg-calculator library metadata."""
    # TODO: Load real ghg-calculator metadata when integrated
    return LibraryInfo(
        version="DEFRA_2025.1+EPA_2025.1",
        factorCount=967,
        sources=["DEFRA 2025", "EPA GHG Hub 2025", "ecoinvent", "Ember"],
    )


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


# === Calculation Endpoints ===

@app.post("/calculate", response_model=CalculateResponse)
async def calculate(req: CalculateRequest):
    """
    Calculate CO2e emissions for a single activity record.

    Request body includes:
    - amount: numeric quantity
    - unit: kg, kWh, litre, tonnes, etc.
    - scope: "scope1" | "scope2" | "scope3"
    - category: emission category (e.g., "stationary_fuel", "electricity")
    - activityType: optional detail (e.g., "diesel", "natural_gas", "market_based")
    - geography: optional country/region filters
    - date: ISO 8601 date for factor effective date matching

    Returns:
    - totalCo2e: computed emissions in kg CO2e
    - gases: per-gas breakdown (CO2, CH4, N2O in kg / CO2e)
    - factorId: which factor was selected (audit trail)
    - factorLibraryVersion: factor source + version (audit trail)
    - formula: human-readable calculation trace
    - warnings: any selection fallbacks or unit mismatches
    """
    try:
        # TODO: Integrate actual ghg-calculator calculation
        # For now, return a mock response to validate API contract
        logger.info(
            f"Calculate: {req.amount} {req.unit} of {req.category} "
            f"({req.scope}) on {req.date}"
        )

        # Mock response for PoC
        return CalculateResponse(
            totalCo2e=req.amount * 0.5,  # Placeholder calculation
            gases=GasBreakdown(
                co2=req.amount * 0.5,
                ch4=None,
                n2o=None,
                co2e=None,
            ),
            factorId="DEFRA_2025_MOCK_001",
            factorLibraryVersion="DEFRA_2025.1",
            formula=f"{req.amount} {req.unit} × 0.5 kg CO2e/{req.unit} = {req.amount * 0.5} kg CO2e",
            warnings=[],
        )

    except Exception as e:
        logger.error(f"Calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Factor Lookup Endpoints ===

@app.get("/factors", response_model=FactorsResponse)
async def get_factors(
    scope: str,
    category: str,
    activity_type: Optional[str] = None,
    country: Optional[str] = None,
    region: Optional[str] = None,
    date: Optional[str] = None,
):
    """
    Search factors by scope, category, and optional filters.

    Query parameters:
    - scope: "scope1" | "scope2" | "scope3" (required)
    - category: emission category (required)
    - activity_type: optional fuel/transport detail
    - country: optional geography filter
    - region: optional sub-national geography
    - date: ISO 8601 for effective date matching (defaults to today)

    Returns:
    - factors: array of matching factors
    - totalCount: number of results
    """
    try:
        logger.info(
            f"Factor search: scope={scope}, category={category}, "
            f"activity_type={activity_type}, country={country}"
        )

        # TODO: Integrate actual ghg-calculator factor search
        # For now, return mock to validate API contract
        return FactorsResponse(
            factors=[
                FactorInfo(
                    id="DEFRA_2025_MOCK_001",
                    externalId="UK_DEFRA_2025_ELECTRICITY",
                    scope=scope,
                    category=category,
                    activityType=activity_type,
                    inputUnit="kWh",
                    gases=GasBreakdown(
                        co2e=0.233,
                        co2=None,
                        ch4=None,
                        n2o=None,
                    ),
                    geography={"country": country} if country else None,
                    libraryVersion="DEFRA_2025.1",
                    effectiveStartDate="2025-01-01",
                    effectiveEndDate=None,
                )
            ],
            totalCount=1,
        )

    except Exception as e:
        logger.error(f"Factor lookup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Server Startup ===

if __name__ == "__main__":
    port = int(os.getenv("GHG_CALCULATOR_PORT", 9000))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
    )
