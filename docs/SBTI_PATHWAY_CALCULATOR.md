# SBTi Pathway Calculator

## Overview

The SBTi Pathway Calculator helps organizations set science-based emission reduction targets aligned with the Paris Agreement climate goals (1.5°C, 2°C, 2.5°C). It calculates annual reduction requirements and provides actionable recommendations for each scope.

## Supported Climate Pathways

| Pathway | Annual Reduction | Description | Use Case |
|---------|-----------------|-------------|----------|
| **1.5°C** | 4.2% | Paris Agreement limit; requires innovation | Climate leaders, committed orgs |
| **2°C** | 3.0% | Challenging but achievable | Most medium-sized orgs |
| **2.5°C** | 2.0% | Moderate pathway | Conservative approach |

**Reduction Rate Formula:**
```
Target Emissions = Baseline × (1 - Annual Rate)^Years
```

Example: 10,000 tonnes CO₂e baseline → 2°C pathway (3% annual) → 8 years → 7,724 tonnes target

## Components

### 1. Calculator Engine (`lib/calculation/sbti-calculator.ts`)

Core functions for pathway calculation and recommendations:

- **`calculateSBTiPathway(request)`** — Main calculation function
  - Input: baseline year/emissions, target year, pathway selection, optional scope breakdown
  - Output: year-by-year reduction targets, recommendations, confidence levels
  - Logic: Uses IPCC AR6 + SBTi methodology

- **`assessYearlyProgress(pathway, currentEmissions)`** — Progress tracking
  - Compares actual emissions to target
  - Returns: on-track/ahead/behind status, variance %, years of progress

- **`getMilestones(pathway, years)`** — Multi-year planning
  - Returns emissions targets for user-specified milestone years
  - Default milestones: 2030, 2035, 2040, 2050

### 2. API Endpoint (`app/api/orgs/[orgId]/targets/sbti-pathway`)

**POST** — Calculate pathways
```bash
curl -X POST https://carbonsite.app/api/orgs/org_123/targets/sbti-pathway \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "baselineYear": 2023,
    "baselineEmissions": 10000000,
    "targetYear": 2030,
    "pathway": "1.5C",
    "scope1": 2000000,
    "scope2": 3000000,
    "scope3": 5000000
  }'
```

**Response:**
```json
{
  "success": true,
  "pathway": {
    "baselineYear": 2023,
    "baselineEmissions": 10000000,
    "targetYear": 2030,
    "targetEmissions": 7724000,
    "totalReductionNeeded": 2276000,
    "totalReductionPercent": 22.76,
    "annualReductionRate": 4.2,
    "yearsToTarget": 7,
    "pathway": "1.5C",
    "pathwayDescription": "Paris Agreement 1.5°C limit...",
    "annualTargets": [
      {
        "year": 2024,
        "targetEmissions": 9578000,
        "annualReductionRate": 4.2,
        "annualReductionAmount": 422000,
        "cumulativeReduction": 4.22,
        "onTrack": true
      },
      ...
    ],
    "recommendations": [
      "Annual reduction rate 4%+: Requires systematic operational changes...",
      "Scope 3 >60% of emissions: Prioritize supplier engagement...",
      ...
    ]
  }
}
```

**GET** — Retrieve current emissions
```bash
curl https://carbonsite.app/api/orgs/org_123/targets/sbti-pathway \
  -H "Authorization: Bearer token"
```

Returns current emissions from latest published snapshot for use as baseline.

### 3. UI Components

#### `SBTiForm` — Input form with all three pathway calculations
- Inputs: baseline year, baseline emissions, target year, scope breakdown
- Outputs: comparison table + detailed pathway cards
- Auto-calculates all three pathways simultaneously

#### `SBTiPathwayCard` — Detailed pathway display
- Timeline visualization with annual reduction bars
- Scope-specific recommendations (Scope 1, 2, 3)
- Ambition indicator badge
- Warning alerts for challenging pathways

#### `SBTiComparison` — Side-by-side pathway comparison
- Reduction requirement summary
- Target emissions by pathway
- Decision support table

## Usage Examples

### Setting a 1.5°C Target

```typescript
// In a settings or targets page component
import { SBTiForm } from "@/components/targets/sbti-form";

export function TargetSettings({ orgId }: { orgId: string }) {
  const currentEmissions = 5000000; // kg CO2e from latest snapshot
  const currentYear = 2024;

  return (
    <SBTiForm
      orgId={orgId}
      currentEmissions={currentEmissions}
      currentYear={currentYear}
      onPathwaySelect={(pathway) => {
        // Save selected pathway to org settings
        console.log(`Selected ${pathway.pathway} pathway`);
        // Store in DB: org.sbtiPathway = pathway.pathway
        // Store in DB: org.sbtiTargetYear = pathway.targetYear
      }}
    />
  );
}
```

### Tracking Annual Progress

```typescript
const { pathway } = usePathwayData();
const { currentEmissions } = useLatestSnapshot();

const progress = assessYearlyProgress(pathway, currentEmissions);

if (progress.status === "ahead") {
  console.log(`🎉 Ahead of schedule by ${progress.yearsAhead} years!`);
} else if (progress.status === "behind") {
  console.log(`⚠️ Behind target by ${progress.variance}%`);
}
```

### Milestone Tracking

```typescript
const pathway = calculateSBTiPathway({...});
const milestones = getMilestones(pathway, [2030, 2035, 2040]);

// Display milestone card for progress dashboard
milestones.forEach(m => {
  console.log(`${m.year}: ${m.emissions / 1000}t CO₂e`);
});
```

## Recommendations Engine

Recommendations are generated based on:

1. **Annual Reduction Rate**
   - 4%+ → Requires innovation (carbon capture, alternative fuels)
   - 3-4% → Steady investment approach
   - <3% → Quick wins focus

2. **Scope Breakdown** (if provided)
   - Scope 3 >60% → Supplier engagement priority
   - Scope 2 >30% → Renewable energy transition
   - Scope 1 >30% → Fleet electrification or fuel switching

3. **Timeline**
   - <5 years → Urgent, immediate action required
   - 5-10 years → Phased implementation possible
   - 10+ years → Long-term capital planning

4. **Pathway Specificity**
   - 1.5°C → Innovation required; consider carbon offsets
   - 2°C → Standard operational improvements
   - 2.5°C → Conservative; room for course correction

## Audit Trail

All pathway calculations are logged:

```
Action: sbti.pathway_created
ResourceType: SBTiPathway
Metadata: {
  pathway: "1.5C",
  baselineYear: 2023,
  targetYear: 2030,
  baselineEmissions: 10000000,
  targetEmissions: 7724000,
  totalReductionPercent: 22.76
}
```

## Integration with Other Features

### Scope 3 AI Assistant
- Use Scope 3 AI estimates to establish baseline for SBTi calculations
- Cross-check: "Your Scope 3 estimate is 5M kg CO₂e; this aligns with construction industry benchmark"

### Supplier Insights
- Track actual supplier emissions against SBTi targets
- Alert: "Supplier X emissions up 15%; impacts SBTi 2030 target"

### CSRD Compliance (Phase 2c)
- Map SBTi reduction targets to CSRD Article 8 requirements
- Show CSRD alignment status

## Performance

- **Calculation Time:** <50ms (all three pathways simultaneously)
- **Database:** Pathways stored as audit metadata, not separate table (keep schema lightweight)
- **Scalability:** No performance impact for orgs with 100k+ records (calculation is O(n) in years, not records)

## Limitations & Caveats

1. **Science Assumptions**
   - Uses linear reduction; real-world progress is non-linear
   - Does not account for marginal abatement costs (harder to reduce harder)
   - No carbon offsetting included (assumes operational reductions only)

2. **Scope Specificity**
   - Recommendations are generic; org-specific bottlenecks not detected
   - Scope 3 is highly variable; estimates assume sector average

3. **External Factors**
   - Does not factor in policy changes, carbon pricing, technology breakthroughs
   - Assumes current emissions intensity; does not account for growth

## Future Enhancements

- **Phase 2b:** Sensitivity analysis (cost of missing targets, uncertainty bands)
- **Phase 2c:** Interactive pathway simulator (what-if scenarios)
- **Phase 3:** Supplier pathway mapping (aggregate supplier targets)
- **Phase 3:** Carbon offsetting integration (show offset cost to reach targets faster)
- **Phase 3:** Temporal forecasting (project next year's emissions based on growth rate)

## Testing

Unit tests:

```bash
pnpm test lib/calculation/sbti-calculator.ts
```

Integration tests (with Prisma seeded data):

```bash
pnpm test app/api/orgs/*/targets/sbti-pathway
```

## References

- **SBTi Methodology:** https://sciencebasedtargets.org
- **IPCC AR6:** https://www.ipcc.ch/report/ar6/syr/
- **GHG Protocol:** https://ghgprotocol.org
- **1.5°C Emissions Gap:** https://unep.org/emissions-gap-report
