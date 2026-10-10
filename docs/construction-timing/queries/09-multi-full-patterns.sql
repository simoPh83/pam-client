-- Why do projects contain >=2 Full applications?
with fulls as (
  select pa.project_id, a.uid, a.app_state, a.start_date, a.decided_date, a.address
  from project_applications pa
  join applications a on a.uid = pa.uid
  where a.app_type = 'Full' and pa.role = 'original'
),
per as (
  select project_id,
         count(*) as n_full,
         count(*) filter (where app_state in ('Permitted','Conditions')) as n_live,
         count(*) filter (where app_state in ('Rejected','Withdrawn')) as n_dead,
         count(*) filter (where app_state = 'Undecided' or app_state is null) as n_open,
         count(distinct lower(btrim(address))) as n_addr,
         max(start_date) - min(start_date) as span_days
  from fulls group by 1 having count(*) >= 2
)
select 'a_total_multi_full' as probe, 'projects' as k, count(*)::text as v from per
union all
select 'b_pattern',
  case
    when n_live >= 2 then 'two+ live permissions'
    when n_live = 1 and n_dead >= 1 and n_open = 0 then '1 live + earlier/later refused/withdrawn'
    when n_live = 1 and n_open >= 1 then '1 live + open'
    when n_live = 0 and n_dead >= 1 and n_open >= 1 then 'dead + open (resubmission pending)'
    when n_live = 0 and n_open = 0 then 'all refused/withdrawn'
    else 'other' end,
  count(*)::text
from per group by 2
union all
select 'c_distinct_addresses', case when n_addr = 1 then '1' when n_addr = 2 then '2' else '3+' end, count(*)::text
from per group by 2
union all
select 'd_span', case when span_days < 365 then '<1y' when span_days < 3*365 then '1-3y' else '3y+' end, count(*)::text
from per group by 2
union all
select 'e_two_live_span', case when span_days < 365 then '<1y' when span_days < 3*365 then '1-3y' else '3y+' end, count(*)::text
from per where n_live >= 2 group by 2
order by 1, 2
limit 60;
