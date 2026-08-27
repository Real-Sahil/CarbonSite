#!/bin/bash
# Test script for ghg-calculator FastAPI server
# Usage: ./scripts/test-ghg-calculator.sh

set -e

API_URL="${GHG_CALCULATOR_API_URL:-http://localhost:9000}"
DELAY=1  # Seconds between requests

echo "Testing ghg-calculator FastAPI server at $API_URL"
echo "=================================================="
echo ""

# Health check
echo "[1/6] Health check..."
curl -s "$API_URL/health" | jq .
sleep $DELAY

# Library info
echo "[2/6] Library info..."
curl -s "$API_URL/info" | jq .
sleep $DELAY

# Calculate Scope 2 electricity (location-based)
echo "[3/6] Calculate: 1000 kWh electricity (location-based)..."
curl -s -X POST "$API_URL/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "unit": "kWh",
    "scope": "scope2",
    "category": "electricity",
    "activityType": "location_based",
    "geography": {"country": "GB"},
    "date": "2024-08-27"
  }' | jq .
sleep $DELAY

# Calculate Scope 1 natural gas
echo "[4/6] Calculate: 100 m³ natural gas (Scope 1)..."
curl -s -X POST "$API_URL/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "unit": "m3",
    "scope": "scope1",
    "category": "stationary_fuel",
    "activityType": "natural_gas",
    "geography": {"country": "GB"},
    "date": "2024-08-27"
  }' | jq .
sleep $DELAY

# Search factors
echo "[5/6] Search factors: Scope 2 electricity..."
curl -s "$API_URL/factors?scope=scope2&category=electricity&country=GB" | jq .
sleep $DELAY

# Calculate Scope 3 business travel
echo "[6/6] Calculate: 10000 km air short-haul (Scope 3)..."
curl -s -X POST "$API_URL/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "unit": "km",
    "scope": "scope3",
    "category": "business_travel",
    "activityType": "air_short_haul",
    "geography": {"country": "GB"},
    "date": "2024-08-27"
  }' | jq .

echo ""
echo "All tests completed!"
