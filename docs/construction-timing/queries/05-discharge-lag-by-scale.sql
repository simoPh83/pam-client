-- Discharge lag distribution (root decided_date -> discharge decided_date) and discharges per project by dwelling band.
with root as (
  select p.id as project_id, r.decided_date as root_decided, r.n_dwellings, r.app_state as root_state
  from projects p join applications r on r.uid = p.root_uid
  where r.app_state in ('Permitted','Conditions') and r.decided_date is not null
),
dis as (
  select pa.project_id, a.decided_date
  from project_applications pa
  join applications a on a.uid = pa.uid
  where pa.role = 'discharge' and a.app_state = 'Permitted' and a.decided_date is not null
),
first_dis as (
  select project_id, min(decided_date) as first_dec, count(*) as n_dis from dis group by 1
)
select
  case when root.n_dwellings is null then 'null'
       when root.n_dwellings = 0 then '0'
       when root.n_dwellings < 5 then '1-4'
       when root.n_dwellings < 10 then '5-9'
       when root.n_dwellings < 50 then '10-49'
       else '50+' end as dwellings_band,
  count(*) as projects_with_discharge,
  percentile_cont(0.25) within group (order by (f.first_dec - root.root_decided)) as p25_days,
  percentile_cont(0.5)  within group (order by (f.first_dec - root.root_decided)) as p50_days,
  percentile_cont(0.75) within group (order by (f.first_dec - root.root_decided)) as p75_days,
  round(avg(f.n_dis),1) as avg_discharges
from root join first_dis f using (project_id)
where f.first_dec >= root.root_decided
group by 1
order by 1
limit 20;
