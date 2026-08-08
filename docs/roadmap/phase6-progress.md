# Phase 6 Progress

## Status: In Progress

| Workstream | Priority | Status | Notes |
|---|---|---|---|
| WS1: UK Emission Factors | P0 | Complete | DEFRA 2024 + BEIS 2024 seed (`prisma/seed-uk-factors.ts`) |
| WS2: Waste Emissions Module | P1 | Complete | `WasteRecord` model, API, UI at `/waste` |
| WS3: Project Carbon Budgeting | P0 | Complete | `CarbonBudget` + phases, API, UI at project `/carbon-budget` |
| WS4: Client Dashboards | P1 | Pending | Not started - requires client auth role design |
| WS5: BIM/IFC Integration | P2 | Pending | web-ifc npm package available; IFC upload route needed |
| WS6: Equipment Emissions | P2 | Pending | Use existing activity records with equipment category |
| WS7: SBTi Net-Zero Roadmap | P1 | Complete | `SbtiTarget` model, API, trajectory UI at `/sbti` |
| WS8: UK Carbon Offsetting | P2 | Partial | Woodland Carbon Code / Peatland Code added to offsets UI standards |

## Completed in Phase 6

### WS1: UK Emission Factors (DEFRA 2024 + BEIS 2024)

New `prisma/seed-uk-factors.ts` adds:
- **UK regional grid intensity**: England (0.221), Scotland (0.109), Wales (0.238), Northern Ireland (0.371) kgCO2e/kWh
- **Alternative fuels**: HVO (0.195), MGO (2.68), kerosene (2.552), LPG (1.635) kgCO2e/litre
- **UK road transport**: Car petrol/diesel/EV, van diesel, HGV by size (per vehicle-km)
- **UK passenger transport**: National rail, London Underground, local bus, domestic aviation, ferry
- **Refrigerants** (IPCC AR6 GWP100): R-134a (771), R-410A (2088), R-32 (771), R-22 (1760), HFO-1234yf (4)
- **BEIS industrial**: Steel EAF (0.70), cement (0.83), lime (1.08), aluminium (8.24), paper (0.61) kgCO2e/kg

Run: `pnpm tsx prisma/seed-uk-factors.ts`

### WS2: Waste Emissions Module

- **`WasteRecord` model** - tracks waste type, disposal route, weight, computed CO2e, EWC code, carrier
- **15 disposal routes** mapped to DEFRA 2024 kgCO2e/tonne factors
- **Auto-calculation** - CO2e computed server-side from weight × DEFRA factor on POST
- **Waste hierarchy** breakdown in UI (recycled %, recovery %, landfill %)
- **Pages**: `/orgs/[orgId]/waste` (full CRUD + hierarchy chart + factor reference)
- **Sidebar**: Waste nav item (Trash2 icon) under Planning

### WS3: Project Carbon Budgeting

- **`CarbonBudget` model** - per-project budget with total tCO2e, floor area (m2), contract value (GBP)
- **`CarbonBudgetPhase` model** - budget breakdown by phase (Design, Construction, Handover)
- **Intensity KPIs**: tCO2e/m2, tCO2e/£1M spend
- **Alert thresholds**: 80% (amber), 100% (orange), 120% (red) with banner + progress bar colours
- **API**: `GET/POST/PATCH /api/orgs/[orgId]/contracts/[contractId]/projects/[projectId]/carbon-budget`
- **Page**: Project detail `/carbon-budget` tab with progress bars, phase breakdown, on-track indicator

### WS7: SBTi Net-Zero Roadmap

- **`SbtiTarget` model** - org-level SBTi target with 1.5°C or WB2°C pathway
- **Baseline by scope** (S1, S2, S3 optional)
- **Near-term and net-zero targets** with configurable reduction percentages and years
- **Trajectory calculation** - linear interpolation from base year to near-term to net-zero
- **API**: `GET/PUT /api/orgs/[orgId]/sbti`
- **Page**: `/orgs/[orgId]/sbti` with scope breakdown bars, trajectory chart, SBTi info panel
- **Sidebar**: SBTi Roadmap nav item (TrendingDown icon) under Planning

## Database Changes

Migration: `prisma/migrations/20260808_phase6/migration.sql`

New tables: `carbon_budgets`, `carbon_budget_phases`, `waste_records`, `sbti_targets`

## Pending (P2+ or future phases)

- **WS4 Client Dashboards**: Requires new `ClientUser` role + separate auth flow + white-label report templates
- **WS5 BIM/IFC**: Install `web-ifc` npm, create IFC upload route, extract material quantities → embodied carbon
- **WS6 Equipment**: Add `s1-equipment` category, equipment-hour factors, telematics webhook integration
- **WS8 UK Offsetting**: Woodland Carbon Code + Peatland Code verification statuses in offset records

## Security Notes

- Run `gitleaks detect` before repo goes public
- Enable GitHub Secret Scanning + Push Protection in repo settings
- Enable Dependabot for npm + Dart dependency alerts
- See `docs/attributions.md` for third-party IP acknowledgements
