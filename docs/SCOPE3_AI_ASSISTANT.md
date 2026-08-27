# Scope 3 AI Assistant

## Overview

The Scope 3 AI Assistant uses NVIDIA's LLM API to estimate missing Scope 3 emissions data based on organizational context and industry benchmarks. This reduces manual data entry for indirect emissions and improves baseline accuracy.

## Architecture

### Components

1. **Estimator Engine** (`lib/calculation/scope3-estimator.ts`)
   - Calls NVIDIA LLM API (meta/llama-3.1-405b-instruct)
   - Parses structured JSON responses
   - Returns confidence scores and uncertainty ranges

2. **API Endpoint** (`app/api/orgs/[orgId]/scope3/estimate`)
   - POST `/estimate` — get emissions estimate for spend category
   - POST `/estimate?operation=suggest` — suggest category from description
   - Requires `admin`, `editor`, or `auditor` role

3. **UI Components**
   - `Scope3EstimateForm` — input form for spend details
   - `Scope3EstimateCard` — display estimate with confidence interval
   - `Scope3EstimateList` — render multiple estimates

4. **React Hook** (`lib/hooks/use-scope3-estimate`)
   - `useScope3Estimate({ orgId })` — manage estimate state and API calls
   - Methods: `requestEstimate()`, `suggestCategory()`, `reset()`

## Usage Examples

### Basic Estimation

```typescript
const { estimate, isLoading, requestEstimate } = useScope3Estimate({
  orgId: "org_123",
});

await requestEstimate({
  spendCategory: "s3-business-travel",
  spendAmount: 25000,
  industry: "Construction",
  employees: 150,
  description: "Annual air travel budget",
});

// estimate.estimatedCo2e = 5400 kg CO2e (example)
// estimate.confidenceScore = 0.85
// estimate.estimatedCo2eLower = 4860 kg
// estimate.estimatedCo2eUpper = 5940 kg
```

### Category Suggestion

```typescript
const category = await suggestCategory(
  "Annual software licenses for office staff",
  "Technology"
);
// Returns: "s3-purchased-goods"
```

### Using Estimates in Activity Records

```typescript
// After estimate returns, user can "Use This Estimate"
const estimate = await requestEstimate({...});

// Pre-fill activity record form
setFormData({
  category: estimate.category,
  quantity: estimate.recommendedAmount,
  unit: estimate.recommendedUnit,
  description: estimate.suggestedRecordDescription,
});
```

## Supported Scope 3 Categories

| Category | Example | Unit |
|----------|---------|------|
| `s3-business-travel` | Air, rail, hotel stays | passenger-km or GBP spend |
| `s3-purchased-goods` | Office supplies, equipment | kg or GBP spend |
| `s3-upstream-transport` | Logistics, freight | tonne-km or GBP spend |
| `s3-commuting` | Employee commuting | km or GBP spend |
| `s3-waste` | Waste disposal | kg or GBP spend |

## Estimation Methodology

1. **Spend-Based Approach** (for categories with GBP input)
   - Maps annual spend to industry-standard emission factors
   - Example: £25k business travel ≈ 5-6 tonnes CO2e
   - Uses region-specific and carrier-specific factors

2. **Activity-Based Approach** (for direct quantities)
   - Uses distance, weight, or quantity as input
   - Example: 500 tonnes freight × 0.045 kg CO2e/tonne-km = ...

3. **Confidence Intervals**
   - Direct spend: ±15% (most reliable)
   - Estimated from sector: ±30% (moderate confidence)
   - Rough approximation: ±50% (conservative)

## Configuration

### Environment Variables

```bash
# .env or .env.production
NVIDIA_API_BASE=https://integrate.api.nvidia.com/v1
NVIDIA_API_KEY=nvapi-your-key-here
```

**Note:** NVIDIA API key should be set in Vercel Production environment variables.

### NVIDIA LLM Settings

- **Model:** meta/llama-3.1-405b-instruct (high-capacity for accuracy)
- **Temperature:** 0.3 (deterministic, consistent outputs)
- **Max Tokens:** 500 (sufficient for JSON response)
- **Top P:** 0.9 (balanced sampling)

## Performance Characteristics

- **API Latency:** 1–3 seconds per estimate (depends on NVIDIA load)
- **Cost:** Minimal (NVIDIA free tier for development)
- **Reliability:** Fallback to zero estimate if API fails; no blocking of user workflows

## Limitations & Caveats

1. **Conservative Estimates** — Always under-rather than over-estimate to avoid false confidence
2. **Industry Variability** — Estimates use sector averages; actual emissions may vary ±30%
3. **Geographic Specificity** — Uses UK/EU factors by default; geographies not yet parameterized
4. **Time Dependency** — Does not factor in carbon intensity changes over time (use recent factor library)
5. **Scope 3 Complexity** — Only handles direct spend/activity; excludes complex upstream chains (e.g., embodied carbon in raw materials)

## Future Enhancements

- **Phase 2b:** Add sensitivity analysis (cost of uncertainty to business)
- **Phase 2c:** Integrate supplier data (actual Scope 3 from supply chain partners)
- **Phase 3:** Temporal forecasting (project next year's emissions based on growth)
- **Phase 3:** Multi-region support (EU, US, APAC factor libraries)

## Testing

Unit tests for Scope 3 estimator:

```bash
pnpm test lib/calculation/scope3-estimator.ts
```

Integration tests (with mock NVIDIA API):

```bash
pnpm test app/api/orgs/*/scope3/estimate
```

## API Reference

### POST /api/orgs/{orgId}/scope3/estimate

**Request (Estimate Operation):**
```json
{
  "operation": "estimate",
  "spendCategory": "s3-business-travel",
  "spendAmount": 25000,
  "currency": "GBP",
  "industry": "Construction",
  "employees": 150,
  "facilities": 5,
  "description": "Annual air and rail travel budget"
}
```

**Response:**
```json
{
  "success": true,
  "estimate": {
    "category": "s3-business-travel",
    "estimatedCo2e": 5400,
    "estimatedCo2eLower": 4860,
    "estimatedCo2eUpper": 5940,
    "confidenceScore": 0.85,
    "methodology": "Spend-based estimation using industry benchmarks (ICAO, DEFRA 2025)",
    "recommendedUnit": "kg",
    "recommendedAmount": 5400,
    "suggestedRecordDescription": "Annual business travel emissions (air + rail) for 150 employees, estimated from £25k spend",
    "warnings": ["Confidence based on sector averages; actual emissions may vary ±30%"]
  }
}
```

**Request (Suggest Category Operation):**
```json
{
  "operation": "suggest",
  "description": "Software licenses for office staff",
  "industry": "Technology"
}
```

**Response:**
```json
{
  "category": "s3-purchased-goods"
}
```

## Audit Trail

All Scope 3 estimates are logged in the audit trail with:
- Action: `scope3.estimate_used`
- Metadata: `{ estimate_category, confidence_score, estimated_co2e, methodology }`

This ensures traceability and allows auditors to review estimation methodology.

## Support & Troubleshooting

| Issue | Solution |
|-------|----------|
| API returns empty response | Check NVIDIA_API_KEY in .env; restart Next.js server |
| Estimates seem unrealistic | Verify industry and spend category are correct; add more context in description |
| Confidence score too low | Reduce scope or provide more specific context (employees, facilities) |
| Timeout errors | NVIDIA API is under load; retry in 30 seconds |

## Related Features

- **SBTi Pathway Calculator** — uses Scope 3 estimates to calculate reduction targets
- **Supplier Insights Dashboard** — aggregates actual Scope 3 from supplier data requests
- **Custom Factor Library** — allows org-specific Scope 3 factors override for refinement
