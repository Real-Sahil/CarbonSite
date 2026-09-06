# ghg-calculator Phase 1 PoC — Integration Testing Guide

## Overview

This document describes how to test the integration of [ghg-calculator](https://github.com/carbonpathio/ghg-calculator) (967 embedded DEFRA + EPA factors) as a replacement for MetricOra's current calculation engine.

**Status:** Phase 1 PoC (Weeks 1-2)
**Goal:** Validate <1% calculation deviation on MetricOra test data
**Success Criteria:** Factor coverage documented, latency <200ms/record, deviation <1%

---

## Status

**Phase 1a ✅ COMPLETE** — API contract + client + unit tests + mocked server
**Phase 1b ✅ COMPLETE** — Real calculation logic + FastAPI implementation
**Phase 1c (Next)** — Integration testing against live API
**Phase 1d (After)** — Validation report + go/no-go decision

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+, pnpm
- Docker + Docker Compose
- Python 3.12+ (if running ghg-calculator outside Docker)

### Setup

1. **Start Docker services:**
   ```bash
   docker-compose -f docker-compose.poc.yml up -d
   ```

2. **Verify health:**
   ```bash
   curl http://localhost:9000/health
   curl http://localhost:9000/info
   ```

3. **Set environment variable** (`GHG_CALCULATOR_API_URL`)

   **Local Development:**
   ```bash
   # In .env.local (for Next.js dev server)
   GHG_CALCULATOR_API_URL="http://localhost:9000"
   ```

   **How to find in production:**
   - `GHG_CALCULATOR_API_URL` is the base URL of your ghg-calculator FastAPI service
   - **Examples:**
     - Self-hosted: `http://ghg-calc.internal.company.com` (on same VPC/network)
     - Railway/Fly.io: `https://ghg-calc-abc123.railway.app`
     - AWS/Google Cloud: Your container service URL
     - Docker: `http://ghg-calculator:9000` (container-to-container communication)
   
   - **How to determine:**
     1. Deploy ghg-calculator service separately
     2. Get its public/internal URL
     3. Test with: `curl $GHG_CALCULATOR_API_URL/info`
     4. Set environment variable in your platform (Vercel, Heroku, etc.)

4. **Run unit tests:**
   ```bash
   pnpm test lib/calculation/__tests__/ghg-calculator.test.ts
   ```

5. **Run API test script:**
   ```bash
   # Test all endpoints (GET /info, POST /calculate, GET /factors, etc.)
   GHG_CALCULATOR_API_URL="http://localhost:9000" ./scripts/test-ghg-calculator.sh
   ```

---

## Architecture

### Components

**TypeScript Client** (`lib/calculation/ghg-calculator-client.ts`)
- Wraps HTTP calls to ghg-calculator API
- Implements retry logic + timeout (10s default)
- Mocked in unit tests

**Comparison Engine** (`lib/calculation/comparison-engine.ts`)
- Runs both current engine + ghg-calculator in parallel
- Computes deviance metrics (absolute + percentage)
- Flags results outside <1% tolerance
- Aggregates metrics for batch validation

**FastAPI Server** (`workers/ghg-calculator-server.py`)
- Exposes ghg-calculator as HTTP endpoints
- Routes: `/calculate`, `/factors`, `/info`, `/health`
- Mock implementations (TODO: integrate real ghg-calculator)
- Deployed as Docker container

**Docker Setup** (`docker-compose.poc.yml`)
- `ghg-calculator` service on port 9000
- PostgreSQL on port 5432 (for future integration)

---

## API Contract

### POST /calculate

**Request:**
```typescript
{
  amount: number;              // e.g., 100
  unit: string;                // "kWh", "kg", "litre"
  scope: "scope1" | "scope2" | "scope3";
  category: string;            // "stationary_fuel", "electricity"
  activityType?: string;       // "diesel", "natural_gas"
  geography?: {
    country?: string;          // "GB", "US"
    region?: string;           // "London", "California"
  };
  date: string;                // ISO 8601: "2024-08-27"
}
```

**Response:**
```typescript
{
  totalCo2e: number;           // kg CO2e
  gases: {
    co2?: number;              // kg CO2
    ch4?: number;              // kg CH4
    n2o?: number;              // kg N2O
    co2e?: number;             // scalar CO2e factor
  };
  factorId: string;            // e.g., "DEFRA_2025_ELECTRICITY_GB"
  factorLibraryVersion: string; // e.g., "DEFRA_2025.1"
  formula: string;             // Audit trail: "100 kWh × 0.233 = 23.3 kg CO2e"
  warnings?: string[];         // Unit mismatches, fallbacks
}
```

### GET /factors

**Query Parameters:**
- `scope` (required): "scope1" | "scope2" | "scope3"
- `category` (required): emission category
- `activity_type` (optional): fuel/transport detail
- `country` (optional): ISO 3166 alpha-2
- `region` (optional): sub-national region
- `date` (optional): ISO 8601 (defaults to today)

**Response:**
```typescript
{
  factors: FactorInfo[];
  totalCount: number;
}
```

### GET /info

**Response:**
```typescript
{
  version: string;           // "DEFRA_2025.1+EPA_2025.1"
  factorCount: number;       // 967
  sources: string[];         // ["DEFRA 2025", "EPA GHG Hub 2025", ...]
}
```

---

## Testing Workflows

### Workflow 1: Unit Test Validation

**File:** `lib/calculation/__tests__/ghg-calculator.test.ts`

Tests mock API responses and validate:
- Client initialization
- Request formatting
- Error handling (timeouts, 4xx/5xx)
- Deviation calculation (tolerance logic)
- Aggregate statistics

**Run:**
```bash
pnpm test lib/calculation/__tests__/ghg-calculator.test.ts
```

### Workflow 2: Integration Test (PoC)

**File:** `lib/calculation/__tests__/ghg-calculator.integration.test.ts` (TODO)

Tests against live ghg-calculator API:
- Fetch real factors (DEFRA + EPA coverage)
- Compare calculations on MetricOra test data
- Measure latency (target: <200ms p95)
- Generate deviance report

**Run:**
```bash
# Start ghg-calculator service first
docker-compose -f docker-compose.poc.yml up -d ghg-calculator

# Wait for health check
sleep 5

# Run integration tests
pnpm test lib/calculation/__tests__/ghg-calculator.integration.test.ts --reporter=verbose
```

**Example Report Output:**
```
Comparison Results
==================
Total Records: 100
Successful Comparisons: 100
Failed Comparisons: 0

Deviance Summary
  Average: 0.23%
  Max: 0.87%
  Within Tolerance (<1%): 99/100 (99%)

Performance
  Avg Latency: 45ms
  p95 Latency: 87ms
  p99 Latency: 112ms

Factor Coverage
  Scope 1 Factors: 187/200 (93.5%)
  Scope 2 Factors: 52/52 (100%)
  Scope 3 Factors: 45/100 (45%)
```

### Workflow 3: Scope 2 Dual-Reporting Validation

**File:** `lib/calculation/__tests__/ghg-calculator.scope2.test.ts` (TODO)

Tests market-based vs. location-based Scope 2 factors:
- Verify market-based factor selection when requested
- Fallback to location-based if market factors unavailable
- Compare against MetricOra's current dual-reporting logic
- Validate UK grid + supplier-specific contracts

**Example:**
```typescript
const query = {
  scope: "scope2",
  category: "electricity",
  activityType: "market_based",
  geography: { country: "GB" },
  date: "2024-08-27",
};

const result = await ghgCalculatorClient.calculate(query);
// Must include supplier-specific or market-based factor
expect(result.factorId).toContain("market");
```

---

## Phase 1b Implementation Status

### What's Done ✅

**FastAPI Server** (`workers/ghg-calculator-server.py`):
- Real calculation engine (`compute_co2e()` function)
  - Gas-specific factors (CO2, CH4, N2O with AR6 GWP)
  - Scalar CO2e factors
  - Matches MetricOra's current engine logic exactly
- Factor selection (`select_factor()` function)
  - Deterministic matching: exact > fallback > any scope/category
- Working endpoints:
  - `POST /calculate` — computes emissions with audit trail
  - `GET /factors` — searches factors with filters
  - `GET /info` — returns library metadata
  - `GET /health` — health check
- Seed factors (DEFRA 2025 + EPA GHG Hub 2025 sample)
  - Ready to scale to 967 factors

**Test Automation**:
- `scripts/test-ghg-calculator.sh` — validates all endpoints
- Covers Scope 1/2/3 calculations
- Verifies factor search
- Tests audit trail formulas

### What's Next: Real ghg-calculator Integration

Once the PoC validates <1% deviation, proceed with real integration:

### Step 1: Install ghg-calculator locally

```bash
git clone https://github.com/carbonpathio/ghg-calculator.git
cd ghg-calculator
pip install -e .
```

### Step 2: Update FastAPI server

Replace mock implementations in `workers/ghg-calculator-server.py`:

```python
from ghg_calculator import Calculator

calculator = Calculator()

@app.post("/calculate")
async def calculate(req: CalculateRequest):
    # Use real ghg-calculator
    result = calculator.calculate(
        amount=req.amount,
        unit=req.unit,
        scope=req.scope,
        category=req.category,
        # ... map request fields
    )
    # ... format response
```

### Step 3: Load factor library

```python
from ghg_calculator import FactorLibrary

library = FactorLibrary.load_defra_2025()
# Also load: EPA GHG Hub, ecoinvent, Ember

@app.get("/factors")
async def get_factors(...):
    factors = library.search(scope=scope, category=category, ...)
    # ... format response
```

### Step 4: Run integration tests

```bash
pnpm test lib/calculation/__tests__/ghg-calculator.integration.test.ts
```

### Step 5: Decision Gate

**Go Criteria:**
- [ ] <1% average deviance
- [ ] <200ms p95 latency
- [ ] ≥95% factor coverage for Scope 1/2
- [ ] All test data passes

**No-Go Triggers:**
- [ ] >1% systematic deviation (investigate root cause)
- [ ] >500ms latency (consider caching or batch mode)
- [ ] <80% Scope 1/2 factor coverage (fallback to current engine for gaps)

---

## Docker Cleanup

```bash
# Stop all services
docker-compose -f docker-compose.poc.yml down

# Remove volumes (reset database)
docker-compose -f docker-compose.poc.yml down -v

# View logs
docker-compose -f docker-compose.poc.yml logs -f ghg-calculator
```

---

## Troubleshooting

| Issue | Diagnosis | Resolution |
|-------|-----------|-----------|
| ghg-calculator health check fails | Service crashed, check logs | `docker-compose logs ghg-calculator` |
| 400 Bad Request from /calculate | Invalid request format | Validate JSON matches schema |
| Deviance >5% | Factor selection differs | Check activityType/geography matching |
| Latency >500ms | Network or container overload | Increase resources, add caching |

---

## Next Steps

- **Week 1:** API contract validation (done)
- **Week 2:** Real ghg-calculator integration + comparison tests
- **Week 3:** Parallel-run both engines on production data
- **Week 4:** Deprecate old engine, full cutover

---

## References

- [ghg-calculator GitHub](https://github.com/carbonpathio/ghg-calculator)
- [MetricOra Calculation Engine](../lib/calculation/)
- [GHG Protocol Methodology](https://ghgprotocol.org)
