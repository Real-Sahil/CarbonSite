{{
  config(
    materialized='table',
    indexes=[
      {'columns': ['organization_id', 'reporting_period_id']},
      {'columns': ['facility_id']},
      {'columns': ['calculation_run_id']},
      {'columns': ['emission_category_id']}
    ]
  )
}}

-- Fact table for emission calculations
-- Combines activity records with emission factors to calculate CO2e

with activity_records as (
  select * from {{ ref('stg_activity_records') }}
),

emission_factors as (
  select * from {{ ref('stg_emission_factors') }}
),

emission_categories as (
  select * from {{ ref('stg_emission_categories') }}
),

joined as (
  select
    a.id as activity_record_id,
    a.organization_id,
    a.facility_id,
    a.business_unit_id,
    a.emission_category_id,
    a.reporting_period_id,
    a.activity_date,
    a.original_amount,
    a.original_unit,
    a.normalized_amount,
    a.normalized_unit,
    f.emission_factor,
    f.gwp_factor_ch4,
    f.gwp_factor_n2o,
    f.factor_source,
    f.methodology_version,
    ec.scope,
    ec.name as category_name,
    -- Calculate CO2e: base emission + (CH4 * GWP) + (N2O * GWP)
    (a.normalized_amount * f.emission_factor) as co2e_kg,
    (a.normalized_amount * f.emission_factor * f.gwp_factor_ch4) as ch4_kg_co2e,
    (a.normalized_amount * f.emission_factor * f.gwp_factor_n2o) as n2o_kg_co2e,
    (a.normalized_amount * f.emission_factor * (1 + f.gwp_factor_ch4 + f.gwp_factor_n2o)) as total_co2e_kg,
    -- Convert to tonnes (1 tonne = 1000 kg)
    (a.normalized_amount * f.emission_factor * (1 + f.gwp_factor_ch4 + f.gwp_factor_n2o)) / 1000 as total_co2e_tonnes
  from activity_records a
  left join emission_factors f
    on a.emission_category_id = f.emission_category_id
    and a.activity_date >= f.effective_date
    and (f.sunset_date is null or a.activity_date < f.sunset_date)
  left join emission_categories ec
    on a.emission_category_id = ec.id
),

final as (
  select
    {{ generate_surrogate_key(['activity_record_id', 'organization_id']) }} as emission_id,
    *,
    now() as dbt_loaded_at
  from joined
  where total_co2e_kg is not null
)

select * from final
