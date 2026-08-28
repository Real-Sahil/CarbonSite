# dbt SQL Transformation Setup Guide

dbt (data build tool) orchestrates SQL transformations in CarbonSite. All emissions calculations flow through dbt models to maintain lineage, enable testing, and support incremental rebuilds.

## Quick Start

### 1. Install dbt

```bash
pip install dbt-postgres
```

### 2. Configure Connection

Create `dbt/profiles.yml`:

```yaml
carbonsite:
  outputs:
    dev:
      type: postgres
      host: localhost
      user: postgres
      password: postgres
      port: 5432
      dbname: carbonsite
      schema: public
      threads: 4
      keepalives_idle: 0
    prod:
      type: postgres
      host: neon.tech
      user: neon_user
      password: "{{ env_var('DATABASE_PASSWORD') }}"
      port: 5432
      dbname: carbonsite
      schema: public
      threads: 8
      keepalives_idle: 0
  target: dev
```

### 3. Run Models

```bash
# Staging models (views)
dbt run --select tag:staging

# Mart models (tables)
dbt run --select tag:marts

# All models
dbt run

# Specific model
dbt run --select fct_emissions
```

### 4. Test Data Quality

```bash
dbt test

# Test specific model
dbt test --select fct_emissions
```

### 5. Generate Documentation

```bash
dbt docs generate
dbt docs serve  # Opens DAG at http://localhost:8000
```

## Project Structure

```
dbt/
├── dbt_project.yml           # Project configuration
├── profiles.yml              # Database connection
├── models/
│   ├── staging/              # Raw data views
│   │   ├── stg_activity_records.sql
│   │   └── stg_emission_factors.sql
│   ├── marts/                # Transformed tables
│   │   ├── fct_emissions.sql
│   │   ├── dim_facilities.sql
│   │   └── agg_daily_emissions.sql
│   ├── tests/                # Data quality tests
│   │   └── assertions/
│   └── schema.yml            # Model documentation
├── seeds/                    # Static reference data
├── macros/                   # Reusable SQL functions
└── snapshots/                # SCD Type 2 slowly-changing dimensions
```

## Core Models

### Staging Layer (`staging/`)

**Purpose:** Rename and normalize raw tables, apply light transformations.

- **stg_activity_records** — Activity records with renamed columns, filters for org
- **stg_emission_factors** — Currently valid emission factors, filtered by date range

**Materialization:** Views (no disk cost, query-time computation)

### Mart Layer (`marts/`)

**Purpose:** Analytical tables optimized for dashboards and reports.

- **fct_emissions** — Fact table: activity records × factors = CO2e calculations
  - One row per approved activity record + matched factor
  - Denormalizes factor version, methodology for audit trail
  - Columns: CO2, CH4 GWP, N2O GWP, total CO2e

- **agg_daily_emissions** — Daily totals by org + facility + category
  - Feeds dashboard tiles (no per-record query at dashboard load time)
  - Columns: record count, total CO2e, variants, quality metrics

- **dim_facilities** — Facility dimensions (name, country, region, risk level)
- **dim_categories** — Emission category dimensions (scope, code, name)

**Materialization:** Incremental tables (rebuild only changed data)

## Integration with CarbonSite

### Running dbt from Node.js Worker

```typescript
// lib/jobs/workers/dbt-transform.ts
import { spawn } from "child_process";

export async function runDbtTransformation(calculationRunId: string, orgId: string) {
  const startTime = Date.now();

  // 1. Run dbt with organization filter
  const dbtProcess = spawn("dbt", [
    "run",
    "--select",
    "tag:marts",
    "--vars",
    JSON.stringify({
      org_id: orgId,
      calculation_run_id: calculationRunId,
      start_date: "2024-01-01",
      end_date: new Date().toISOString().split("T")[0],
    }),
  ]);

  let output = "";
  dbtProcess.stdout?.on("data", (data) => {
    output += data.toString();
    console.log(`[dbt] ${data}`);
  });
  dbtProcess.stderr?.on("data", (data) => {
    console.error(`[dbt error] ${data}`);
  });

  // 2. Wait for completion
  await new Promise((resolve, reject) => {
    dbtProcess.on("close", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`dbt run failed with code ${code}`));
    });
  });

  // 3. Log run metadata
  await prisma.dbtRun.create({
    data: {
      calculationRunId,
      organizationId: orgId,
      status: "success",
      output,
      duration: Date.now() - startTime,
      rowsAffected: parseRowsFromOutput(output),
    },
  });

  console.log(`[dbt] Transformation complete for org ${orgId} in ${Date.now() - startTime}ms`);
}
```

### Trigger Point in Calculation Pipeline

```typescript
// lib/calculation/run-worker.ts
import { runDbtTransformation } from "@/lib/jobs/workers/dbt-transform";

export async function completeCalculationRun(runId: string) {
  // 1. Calculations complete
  // 2. Run dbt transformations
  await runDbtTransformation(runId, orgId);
  // 3. Update dashboard aggregates from agg_daily_emissions
  await syncDashboardAggregates(orgId, runId);
  // 4. Trigger reporting
}
```

## Data Quality Testing

### Built-in Tests

```sql
-- tests/assert_unique_emissions.sql
SELECT *
FROM {{ ref('fct_emissions') }}
GROUP BY emission_id
HAVING COUNT(*) > 1;
```

### Run Tests

```bash
# All tests
dbt test

# Specific model
dbt test --select fct_emissions

# Specific test
dbt test --select assert_unique_emissions
```

### Test Results

Tests log to `target/compiled/` and `target/run/`. Failures block dbt run completion.

## Performance Optimization

### Incremental Builds

```sql
{{
  config(
    materialized='incremental',
    unique_key='emission_id',
    on_schema_change='fail'
  )
}}

SELECT * FROM ... emissions
{% if execute and execute_macros.get('check_build_type') == 'incremental' %}
  WHERE created_at >= (SELECT MAX(created_at) FROM {{ this }})
{% endif %}
```

### Indexes

dbt models can declare indexes to speed queries:

```sql
{{ config(
  indexes=[
    {'columns': ['organization_id', 'date']},
    {'columns': ['facility_id']}
  ]
) }}
```

### Query Execution

- **Staging views:** ~10ms (queries pass through to source)
- **Mart tables (weekly rebuild):** ~2-5s per org
- **Daily aggregates:** ~500ms-2s (only changed records)

## Monitoring & Debugging

### View Compiled SQL

```bash
dbt compile  # Generates SQL in target/compiled/
```

### Check Lineage

```bash
dbt deps  # Install packages
dbt docs generate
dbt docs serve  # Browse at http://localhost:8000
```

### Run with Debug Output

```bash
dbt run --debug --select fct_emissions
```

## Troubleshooting

### Model Not Found

```
 Runtime Error in model stg_activity_records: "carbonsite"."public"."activity_records" does not exist
```

**Solution:** Verify source table exists:
```sql
SELECT * FROM activity_records LIMIT 1;
```

### Factor Join Not Matching

```
[dbt] NULL factor_id in fct_emissions (100 records)
```

**Solution:** Verify factor dates overlap activity dates:
```sql
SELECT MIN(activity_date), MAX(activity_date) FROM activity_records;
SELECT MIN(effective_date), MAX(sunset_date) FROM emission_factors;
```

### Transformation Slow

**Solution:** Check indexes and table sizes:
```sql
-- Check row count
SELECT COUNT(*) FROM activity_records WHERE organization_id = '...';

-- Check for index scans
EXPLAIN ANALYZE SELECT * FROM activity_records WHERE facility_id = '...';
```

## Next Steps

1. Configure `dbt/profiles.yml` with production database credentials
2. Test connection: `dbt debug`
3. Run models: `dbt run`
4. Generate docs: `dbt docs generate`
5. Integrate into calculation worker (see "Integration" section above)
6. Schedule weekly full rebuild + daily incremental syncs
7. Monitor with Grafana (queries on `agg_daily_emissions` table)

## Best Practices

1. **Idempotency:** All models must be safe to re-run without side effects
2. **Documentation:** Add `description:` to every model and column
3. **Tests:** Every mart should have ≥2 tests (uniqueness, not-null)
4. **Staging:** Keep transformations simple; complex logic in marts
5. **Lineage:** Use `ref()` for all dependencies; never hard-code table names
6. **Version Control:** Commit `dbt_project.yml`, `schema.yml`, but not `target/` or `.env`

## References

- [dbt Documentation](https://docs.getdbt.com/)
- [dbt Best Practices](https://docs.getdbt.com/guides/best-practices)
- [dbt Incremental Models](https://docs.getdbt.com/docs/build/incremental-models)
- [CarbonSite Calculation Engine](../calculation/engine.md)
