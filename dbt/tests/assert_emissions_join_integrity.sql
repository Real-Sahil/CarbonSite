-- Test to ensure all activity records have valid factor joins
-- Missing factor joins indicate data quality issues or factor library gaps

select a.id as activity_record_id
from {{ ref('stg_activity_records') }} a
left join {{ ref('stg_emission_factors') }} f
  on a.emission_category_id = f.emission_category_id
  and a.activity_date >= f.effective_date
  and (f.sunset_date is null or a.activity_date < f.sunset_date)
where f.id is null
  and a.review_status = 'approved'
