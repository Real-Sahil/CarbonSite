# Emission Calculation Walkthrough

Complete step-by-step examples showing how MetricOra calculates carbon emissions, with real-world data and DEFRA/EPA factors.

## The Calculation Pipeline

Every emission calculation follows this pipeline:

```
1. Activity Record (raw data)
   ↓
2. Unit Normalization (convert to canonical unit)
   ↓
3. Factor Selection (match geography, date, methodology)
   ↓
4. Computation (gas-specific or scalar)
   ↓
5. Immutable Result (stored in EmissionCalculation)
```

Each step is documented in the database for audit purposes.

## Example 1: Stationary Energy (Electricity)

### Scenario
A UK manufacturing facility used 2,500 kWh of grid electricity in July 2025.

### Step 1: Activity Record
```json
{
  "category": "s1-stationary",  // Stationary combustion (scope 1)
  "value": 2500,
  "unit": "kWh",
  "date": "2025-07-15",
  "facility": {
    "name": "Main Factory",
    "country": "GB",
    "geography": "United Kingdom"
  },
  "description": "Monthly grid electricity usage"
}
```

### Step 2: Unit Normalization
Input unit is already canonical (kWh), so normalized value = input value.

```json
{
  "original_value": 2500,
  "original_unit": "kWh",
  "normalized_value": 2500,
  "normalized_unit": "kWh",
  "conversion_factor": 1.0
}
```

### Step 3: Factor Selection
**Decision Logic:**
- Category: `s1-stationary` → electricity
- Country: `GB` (United Kingdom)
- Date: `2025-07-15` → Year 2025, Q3
- Scope 2 Method: `location-based` (grid mix emission factor)

**Selected Factor (DEFRA 2025.1):**
```
Source: DEFRA UK electricity grid (2025)
Factor: 0.450 kg CO2e / kWh
Scope: Scope 2, Location-Based
Geography: United Kingdom
Validity: 2025-01-01 to 2025-12-31
```

**Selection Reason Stored:**
```
"UK grid electricity Q3 2025, DEFRA location-based method"
```

### Step 4: Computation
**Formula (scalar multiplication):**
```
CO2e = normalized_value × factor
CO2e = 2500 kWh × 0.450 kg CO2e/kWh
CO2e = 1125.0 kg CO2e
```

**Formula String (stored for audit):**
```
"2500 kWh × 0.450 kg CO2e/kWh (DEFRA 2025 UK grid, location-based)"
```

### Step 5: Immutable Result
```json
{
  "id": "calc-123",
  "activity_record_id": "record-1",
  "calculation_run_id": "run-789",
  "category": "s1-stationary",
  "original_value": 2500,
  "original_unit": "kWh",
  "normalized_value": 2500,
  "normalized_unit": "kWh",
  "co2e": 1125.0,
  "co2e_unit": "kg",
  "formula": "2500 kWh × 0.450 kg CO2e/kWh (DEFRA 2025 UK grid, location-based)",
  "factor_value": 0.450,
  "factor_unit": "kg CO2e / kWh",
  "factor_source": "DEFRA 2025.1",
  "methodology_version": "ghg-protocol-v2026-01",
  "selection_reason": "UK grid electricity Q3 2025, DEFRA location-based method",
  "created_at": "2025-08-24T15:30:00Z"
}
```

**Dashboard Impact:**
```
Scope 2 Total: +1125.0 kg CO2e
Category Total (s1-stationary): +1125.0 kg CO2e
```

---

## Example 2: Natural Gas Combustion

### Scenario
An office building in London burned 15,000 cubic meters of natural gas during January 2025 for heating.

### Step 1: Activity Record
```json
{
  "category": "s1-stationary",  // Stationary combustion
  "value": 15000,
  "unit": "m3",  // Cubic meters (raw input)
  "date": "2025-01-20",
  "facility": {
    "name": "London Office",
    "country": "GB",
    "geography": "United Kingdom"
  },
  "description": "Natural gas for heating"
}
```

### Step 2: Unit Normalization
Natural gas m³ must be converted to standardized unit (MWh or kWh).

**Conversion Logic:**
- 1 m³ of natural gas ≈ 0.0108 kWh (calorific value)
- 15,000 m³ × 0.0108 = 162 kWh

```json
{
  "original_value": 15000,
  "original_unit": "m3",  // Cubic meters
  "normalized_value": 162,
  "normalized_unit": "kWh",
  "conversion_factor": 0.0108,
  "conversion_source": "DEFRA 2025 gas calorific values"
}
```

### Step 3: Factor Selection
**Decision Logic:**
- Category: `s1-stationary` → combustion
- Fuel: `natural_gas` (inferred from context)
- Geography: `United Kingdom`
- Date: `2025-01-20` → Year 2025, Q1
- Scope: Scope 1 (direct combustion)

**Selected Factor (DEFRA 2025.1):**
```
Source: DEFRA natural gas combustion (2025)
Factor: 0.185 kg CO2e / kWh
Scope: Scope 1, Direct Combustion
Fuel: Natural Gas
Validity: 2025-01-01 to 2025-12-31
```

### Step 4: Computation
**Formula (scalar multiplication on normalized value):**
```
CO2e = normalized_value × factor
CO2e = 162 kWh × 0.185 kg CO2e/kWh
CO2e = 29.97 kg CO2e ≈ 30.0 kg CO2e
```

**Formula String:**
```
"15000 m³ × 0.0108 kWh/m³ = 162 kWh; 162 × 0.185 = 29.97 kg CO2e (DEFRA 2025 natural gas)"
```

### Step 5: Immutable Result
```json
{
  "id": "calc-124",
  "activity_record_id": "record-2",
  "original_value": 15000,
  "original_unit": "m3",
  "normalized_value": 162,
  "normalized_unit": "kWh",
  "co2e": 29.97,
  "formula": "15000 m³ × 0.0108 = 162 kWh; 162 × 0.185 = 29.97 kg CO2e",
  "factor_value": 0.185,
  "factor_source": "DEFRA 2025.1 natural gas",
  "selection_reason": "UK natural gas combustion, Scope 1"
}
```

---

## Example 3: Vehicle Fuel (Scope 1 - Mobile)

### Scenario
A delivery vehicle traveled 5,000 km in February 2025, using diesel fuel. Average consumption: 6.5 L/100km.

### Step 1: Activity Record
```json
{
  "category": "s1-mobile",  // Mobile combustion (vehicles)
  "value": 5000,
  "unit": "km",
  "fuel_type": "diesel",
  "efficiency": 6.5,  // L/100km
  "efficiency_unit": "l_per_100km",
  "date": "2025-02-28",
  "vehicle_reg": "AB21CDE",
  "description": "Monthly delivery vehicle mileage"
}
```

### Step 2: Unit Normalization
Convert distance + fuel consumption to fuel volume (litres).

**Calculation:**
```
Distance: 5000 km
Consumption: 6.5 L/100km
Fuel consumed = 5000 × (6.5 / 100) = 325 litres
```

**Normalized:**
```json
{
  "original_value": 5000,
  "original_unit": "km",
  "original_efficiency": 6.5,
  "efficiency_unit": "l_per_100km",
  "normalized_value": 325,
  "normalized_unit": "l",  // Litres
  "conversion_notes": "5000 km × 6.5 L/100km = 325 L"
}
```

### Step 3: Factor Selection
**Decision Logic:**
- Category: `s1-mobile` → vehicle combustion
- Fuel: `diesel`
- Vehicle Type: `van` (inferred from consumption rate)
- Geography: `United Kingdom`
- Date: `2025-02-28` → Year 2025, Q1

**Selected Factor (DEFRA 2025.1):**
```
Source: DEFRA diesel van emissions (2025)
Factor: 2.663 kg CO2e / litre
Scope: Scope 1, Mobile Combustion
Fuel: Diesel
Vehicle: Van (average)
Validity: 2025-01-01 to 2025-12-31
```

### Step 4: Computation
**Formula:**
```
CO2e = fuel_volume × factor
CO2e = 325 L × 2.663 kg CO2e/L
CO2e = 865.48 kg CO2e
```

**Formula String:**
```
"5000 km ÷ 100 × 6.5 L/100km = 325 L; 325 L × 2.663 kg CO2e/L = 865.48 kg CO2e"
```

### Step 5: Immutable Result
```json
{
  "id": "calc-125",
  "activity_record_id": "record-3",
  "original_value": 5000,
  "original_unit": "km",
  "normalized_value": 325,
  "normalized_unit": "l",
  "co2e": 865.48,
  "formula": "5000 km × 6.5 L/100km = 325 L; 325 × 2.663 = 865.48 kg CO2e",
  "factor_value": 2.663,
  "factor_unit": "kg CO2e / L",
  "factor_source": "DEFRA 2025.1 diesel van"
}
```

---

## Example 4: Scope 3 (Purchased Goods)

### Scenario
A construction company purchased 2.5 tonnes of steel reinforcing bars for a project in May 2025.

### Step 1: Activity Record
```json
{
  "category": "s3-purchased-goods",  // Scope 3, upstream
  "value": 2.5,
  "unit": "tonne",
  "product_type": "steel",
  "product_code": "steel_reinforcing_bar",
  "date": "2025-05-15",
  "supplier": "SteelCorp UK",
  "purchase_value": 1500,  // GBP
  "description": "Reinforcing bars for Project Alpha"
}
```

### Step 2: Unit Normalization
Input unit (tonnes) is already canonical.

```json
{
  "original_value": 2.5,
  "original_unit": "tonne",
  "normalized_value": 2.5,
  "normalized_unit": "tonne",
  "conversion_factor": 1.0
}
```

### Step 3: Factor Selection
**Decision Logic:**
- Category: `s3-purchased-goods`
- Product: `steel` / `reinforcing_bar`
- Geography: `United Kingdom` (or global if UK-specific unavailable)
- Date: `2025-05-15` → Year 2025, Q2
- Scope: Scope 3, Upstream (cradle-to-gate)

**Selected Factor (EPA 2025.1 or SustainMetrics):**
```
Source: EPA GHG Emission Factors Hub (2025)
Factor: 2.0 kg CO2e / kg (or 2000 kg CO2e / tonne)
Scope: Scope 3, Upstream Production
Product: Steel reinforcing bar (cradle-to-gate)
Validity: 2025-01-01 to 2025-12-31
```

### Step 4: Computation
**Formula:**
```
CO2e = tonnes × 1000 × factor
CO2e = 2.5 tonnes × 1000 kg/tonne × 2.0 kg CO2e/kg
CO2e = 2.5 × 2000
CO2e = 5000 kg CO2e
```

**Formula String:**
```
"2.5 tonnes steel × 2000 kg CO2e/tonne (EPA 2025 steel cradle-to-gate) = 5000 kg CO2e"
```

### Step 5: Immutable Result
```json
{
  "id": "calc-126",
  "activity_record_id": "record-4",
  "category": "s3-purchased-goods",
  "original_value": 2.5,
  "original_unit": "tonne",
  "normalized_value": 2500,  // Converted to kg for calculation
  "normalized_unit": "kg",
  "co2e": 5000.0,
  "formula": "2.5 tonnes × 2000 kg CO2e/tonne = 5000 kg CO2e",
  "factor_value": 2000,
  "factor_unit": "kg CO2e / tonne",
  "factor_source": "EPA 2025.1 steel reinforcing bar",
  "selection_reason": "Steel cradle-to-gate, global average"
}
```

---

## Example 5: Greenhouse Gas Mix (Scope 1 Refrigeration)

### Scenario
An HVAC system leaked 12 kg of HFC-134a refrigerant in September 2025 (Scope 1, fugitive emissions).

### Step 1: Activity Record
```json
{
  "category": "s1-fugitive",  // Fugitive emissions
  "gas_type": "HFC-134a",
  "value": 12,
  "unit": "kg",
  "date": "2025-09-10",
  "facility": { "name": "Warehouse C" },
  "description": "Refrigerant leak during maintenance"
}
```

### Step 2: Unit Normalization
Refrigerant mass is already in kg (canonical).

```json
{
  "original_value": 12,
  "original_unit": "kg",
  "normalized_value": 12,
  "normalized_unit": "kg"
}
```

### Step 3: Factor Selection
**Decision Logic:**
- Category: `s1-fugitive`
- Gas: `HFC-134a` (hydrofluorocarbon)
- Methodology: GHG Protocol + AR6 GWP
- Date: `2025-09-10` → Current year

**Selected Conversion (AR6 GWP):**
```
Gas: HFC-134a
Global Warming Potential (AR6): 3710 kg CO2e equivalent per 1 kg HFC-134a
Scope: Scope 1, Fugitive
```

### Step 4: Computation (Gas-Specific)
HFC-134a must be converted to CO2e using GWP factor.

**Formula:**
```
CO2e = mass_gas × GWP_value
CO2e = 12 kg HFC-134a × 3710 kg CO2e / kg
CO2e = 44,520 kg CO2e = 44.52 tonnes CO2e
```

**Formula String:**
```
"12 kg HFC-134a × GWP(AR6) 3710 = 44,520 kg CO2e (refrigerant fugitive emission)"
```

### Step 5: Immutable Result
```json
{
  "id": "calc-127",
  "activity_record_id": "record-5",
  "category": "s1-fugitive",
  "original_value": 12,
  "original_unit": "kg",
  "gas_type": "HFC-134a",
  "normalized_value": 12,
  "normalized_unit": "kg",
  "co2e": 44520.0,
  "co2e_unit": "kg",
  "formula": "12 kg HFC-134a × GWP(AR6) 3710 = 44,520 kg CO2e",
  "gwp_value": 3710,
  "gwp_standard": "AR6",
  "factor_source": "IPCC AR6 (2023)",
  "selection_reason": "HFC-134a refrigerant leak, AR6 GWP factor"
}
```

---

## Example 6: Complex Mix (Natural Gas + CH4 + N2O)

### Scenario (Educational)
A biogas facility produced 100 MWh of electricity from anaerobic digestion in Q3 2025.

Biogas composition (typical):
- 60% CH4 (methane)
- 40% CO2 (carbon dioxide)
- Trace N2O (nitrous oxide)

### Detailed Calculation

**Step 1: Activity Record**
```json
{
  "category": "s1-stationary",
  "value": 100,
  "unit": "MWh",
  "fuel_type": "biogas",
  "composition": {
    "ch4": 0.60,
    "co2": 0.40,
    "n2o": 0.0001
  },
  "date": "2025-09-30"
}
```

**Step 2: Normalize**
100 MWh = 100,000 kWh

**Step 3: Select Factors (AR6 GWP)**
- CH4 GWP: 27.9 kg CO2e per 1 kg CH4
- N2O GWP: 273 kg CO2e per 1 kg N2O
- CO2: 1.0 (direct emission)

**Step 4: Gas-Specific Calculation**
Assume biogas has energy density of 5 kWh/kg.

```
Biogas mass needed = 100,000 kWh ÷ 5 kWh/kg = 20,000 kg

CH4 content = 20,000 kg × 0.60 = 12,000 kg
CO2 content = 20,000 kg × 0.40 = 8,000 kg
N2O content = 20,000 kg × 0.0001 = 2 kg

CO2e from CH4 = 12,000 kg × 27.9 = 334,800 kg CO2e
CO2e from N2O = 2 kg × 273 = 546 kg CO2e
CO2e from CO2 = 8,000 kg × 1.0 = 8,000 kg CO2e

Total CO2e = 334,800 + 546 + 8,000 = 343,346 kg CO2e
```

**Step 5: Result**
```json
{
  "original_value": 100,
  "original_unit": "MWh",
  "co2e": 343346,
  "co2e_composition": {
    "from_ch4": 334800,
    "from_n2o": 546,
    "from_co2": 8000
  },
  "formula": "20000 kg biogas (60% CH4, 40% CO2, 0.01% N2O) → 12000×27.9 + 2×273 + 8000×1 = 343,346 kg CO2e",
  "gwp_factors": {
    "ch4": 27.9,
    "n2o": 273
  },
  "gwp_standard": "AR6"
}
```

---

## Dashboard Aggregation

### How Results Combine

All immutable `EmissionCalculation` rows for a reporting period are summed to create `DashboardAggregate` rows:

```sql
SELECT
  category,
  SUM(co2e) as total_co2e,
  COUNT(*) as record_count
FROM emission_calculation
WHERE
  calculation_run_id = 'run-789'
  AND category IN ('s1-stationary', 's1-mobile', 's1-fugitive', 's2-electricity-lb', 's3-purchased-goods')
GROUP BY category;
```

**Example Results (Q3 2025):**
```
| Category | CO2e | Records |
|----------|------|---------|
| s1-stationary | 1,125.0 | 1 |
| s1-mobile | 865.48 | 1 |
| s1-fugitive | 44,520.0 | 1 |
| s2-electricity-lb | 0.0 | 0 |
| s3-purchased-goods | 5,000.0 | 1 |
| TOTAL | 51,510.48 | 4 |
```

**Published in Snapshot:**
```json
{
  "id": "snapshot-q3-2025",
  "period": "2025-Q3",
  "calculation_run_id": "run-789",
  "totals": {
    "co2e": 51510.48,
    "scope1": 46510.48,
    "scope2": 0.0,
    "scope3": 5000.0
  },
  "by_category": {
    "s1-stationary": 1125.0,
    "s1-mobile": 865.48,
    "s1-fugitive": 44520.0,
    "s3-purchased-goods": 5000.0
  },
  "calculation_timestamp": "2025-08-24T15:30:00Z"
}
```

---

## Audit Trail Example

Every calculation stores enough detail to audit and recalculate:

```json
{
  "emission_calculation_id": "calc-123",
  "activity_record_id": "record-1",
  "calculation_run_id": "run-789",
  "activity_snapshot": {
    "original_value": 2500,
    "original_unit": "kWh",
    "category": "s1-stationary",
    "date": "2025-07-15",
    "facility": "Main Factory, UK"
  },
  "factor_snapshot": {
    "factor_id": "factor-defra-uk-electricity-2025",
    "factor_value": 0.450,
    "factor_unit": "kg CO2e / kWh",
    "factor_source": "DEFRA 2025.1",
    "factor_validity_start": "2025-01-01",
    "factor_validity_end": "2025-12-31"
  },
  "methodology_snapshot": {
    "methodology_id": "ghg-protocol-v2026-01",
    "gwp_standard": "AR6",
    "gwp_ch4": 27.9,
    "gwp_n2o": 273
  },
  "calculation": {
    "formula": "2500 kWh × 0.450 kg CO2e/kWh = 1125.0 kg CO2e",
    "co2e_result": 1125.0,
    "timestamp": "2025-08-24T15:30:00Z"
  },
  "audit_notes": "Calculation performed during monthly reporting run. Factor selected based on UK geography and Q3 2025 date."
}
```

---

## Common Pitfalls & Corrections

### Pitfall 1: Forgetting Unit Conversion
```
❌ WRONG: 15,000 m³ natural gas × 0.185 factor = 2,775 kg CO2e
✅ CORRECT: 15,000 m³ × 0.0108 = 162 kWh; 162 × 0.185 = 29.97 kg CO2e
```

### Pitfall 2: Using Wrong Scope 2 Factor
```
❌ WRONG: Using market-based factor for location-based inventory
✅ CORRECT: Select location-based factor for UK grid mix
```

### Pitfall 3: Mixing GWP Standards
```
❌ WRONG: Using GWP(AR4) 25 for CH4 with GWP(AR6) 273 for N2O
✅ CORRECT: Use consistent standard (AR6): CH4=27.9, N2O=273
```

### Pitfall 4: Updating Immutable Calculations
```
❌ WRONG: UPDATE emission_calculation SET co2e = 1200 WHERE id = 'calc-123'
✅ CORRECT: Leave calculation immutable; run new calculation if factors change
```

---

## Resources

- **Factor Libraries:** Seeded from DEFRA 2025.1, EPA 2025.1, SustainMetrics
- **Methodology:** GHG Protocol v2026-01, AR6 GWP values
- **Schema:** See `prisma/schema.prisma` for EmissionCalculation structure
- **Code:** See `lib/calculation/` for calculation engine
