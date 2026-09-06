# MetricOra dbt Project

Data transformation layer for MetricOra emissions calculations and reporting.

## Architecture

### Three-Layer Model

1. **Staging (stg_*)** — Cleans and standardizes raw source data
   - `stg_activity_records` — Imported activity data with type normalization
   - `stg_emission_factors` — Emission factors from DEFRA, EPA, SustainMetrics
   - `stg_emission_categories` — Category metadata
   - `stg_calculation_runs` — Calculation run metadata with duration tracking

2. **Marts (fct_*, dim_*, agg_*)** — Analytics-ready tables for dashboards and reports
   - `fct_emissions` — Fact table: activity records × emission factors = CO2e
   - `dim_facilities` — Facility dimension
   - `agg_daily_emissions` — Daily aggregates by facility and category
   - `agg_organization_summary` — Organization-level totals by scope and period
   - `mart_data_lineage` — Audit trail: record → calculation → snapshot → report

### Calculation Formula

Each emission record is calculated as:

```
Total CO2e (tonnes) = (Activity Amount × Emission Factor) × (1 + GWP_CH4 + GWP_N2O) / 1000

Where:
- Activity Amount: normalized to canonical unit
- Emission Factor: DEFRA/EPA/SustainMetrics database value
- GWP values: AR6 (CH4: 27.9, N2O: 273)
```

Formula is denormalized into `fct_emissions` for audit robustness.

## Setup

### Prerequisites

- PostgreSQL 13+ (via Neon.tech or local Postgres)
- dbt-core 1.5+
- Python 3.10+ (if running locally; CI/CD can use Docker)

### Installation

```bash
# Install dbt dependencies
cd dbt
dbt deps

# Configure database connection
export DBT_POSTGRES_HOST=your-postgres-host
export DBT_POSTGRES_USER=your-user
export DBT_POSTGRES_PASS=your-password
export DBT_POSTGRES_DBNAME=metricora

# Verify connection
dbt debug
```

### Running Models & Tests

```bash
# Run all models
dbt run

# Run specific model
dbt run --select stg_activity_records

# Run only mart models (fact tables)
dbt run --select models/marts/*

# Run all tests
dbt test

# Run tests for specific model
dbt test --select fct_emissions

# Build everything with full lineage
dbt build

# Generate documentation and data lineage
dbt docs generate
dbt docs serve  # Opens browser to lineage DAG
```

## Testing Strategy

### Built-in Tests (in schema.yml)

- **Uniqueness:** Primary keys are unique (emission_id, summary_id, etc.)
- **Not-null:** Required fields must be present
- **Referential integrity:** Foreign keys must exist in source tables
- **Type validation:** Numeric fields contain valid numbers
- **Range checks:** Emissions >= 0 (no negative values)

### Custom Test Assertions

- `assert_no_negative_emissions.sql` — CO2e values cannot be negative
- `assert_emissions_join_integrity.sql` — All approved records must have valid factor matches
- `assert_organization_scoping.sql` — Organization IDs never null (security)

### Running Test Suite

```bash
# Run all tests
dbt test

# Run specific test
dbt test --select assert_no_negative_emissions

# Run tests with full output
dbt test --debug
```

## Integration with MetricOra

### Calculation Worker Flow

1. Web app triggers calculation: `POST /api/orgs/{orgId}/calculations/run`
2. Enqueues job: `{ calculationRunId, organizationId }`
3. Worker: `lib/jobs/workers/dbt-transform.ts`
   - Creates `DbtRun` record in database
   - Calls `dbt run --select models/marts/*`
   - Parses output: models created, tests passed/failed, row counts
   - Updates `CalculationRun.status` → "succeeded" or "failed"
4. Dashboard queries `agg_organization_summary` for totals (not raw emissions)

### API Routes

- `GET /api/orgs/{orgId}/dbt-runs` — List transformation runs
- `GET /api/orgs/{orgId}/dbt-runs/{dbtRunId}` — Transformation metadata and test results
- `GET /api/orgs/{orgId}/data-lineage?recordId={id}` — Trace record's path to reports

## Performance Tuning

### Indexes Created by dbt

- `(organization_id, reporting_period_id, facility_id, category_id)` on `fct_emissions`
- `(organization_id, reporting_period_id)` on `agg_organization_summary`
- `(organization_id)` on `agg_daily_emissions`

### Query Optimization

- Dashboard queries **never** touch raw `emission_calculations` table
- Always query pre-computed aggregates: `agg_organization_summary` (< 100ms for 100M base records)
- Fact table materialized as table (not view) for query performance

## Troubleshooting

### Common Issues

**"dbt run failed: source relation not found"**
- Ensure `DBT_POSTGRES_DBNAME` is set correctly
- Verify tables exist: `SELECT * FROM information_schema.tables WHERE table_schema = 'public'`

**"Test failed: column values_to_be_greater_than_or_equal_to"**
- Check for negative or null emissions in source data
- Run: `SELECT * FROM fct_emissions WHERE total_co2e_kg < 0`

**"No models were selected"**
- Verify `dbt_project.yml` paths are correct
- Check that models/*.sql files exist in expected directories

### Debugging

```bash
# Print all dbt variables and config
dbt debug

# Compile SQL without running (dry-run)
dbt compile

# Show generated SQL for a model
dbt show --select fct_emissions --limit 10

# Profile model execution time
dbt run --profile-dir dbt --record-timing
```

## Data Quality Monitoring

### Daily Checks (CI/CD)

- All tests must pass
- No negative emissions
- Organization scoping integrity
- Factor join integrity

### Alerting

- Test failures sent to Slack via n8n workflow
- Failed transformations pause report generation
- Detailed error logs stored in `DbtRun` table

## Documentation

Run `dbt docs generate && dbt docs serve` to view:
- Model lineage DAG (data flow)
- Column descriptions and tests
- Database-level constraints
- Source table metadata

## Contributing

When adding new models:

1. Create `stg_*.sql` for staging (if new source)
2. Add columns to `schema.yml` with tests
3. Create `fct_*` or `agg_*` for marts using refs
4. Document formula/logic in SQL comments
5. Run `dbt test --select your_model` before pushing

## References

- [dbt Best Practices](https://docs.getdbt.com/guides/best-practices)
- [GHG Protocol Calculation Guide](https://ghgprotocol.org)
- [dbt Expectations](https://github.com/calogica/dbt_expectations)
