-- (a) n_dwellings population by app_size / app_type; (b) lag<=7d discharge cases; (c) lag from first discharge >=30d after root.
select 'a_dwellings_pop' as probe, app_size as k1, app_type as k2,
       count(*) as n, count(n_dwellings) as with_dw,
       min(n_dwellings) as min_dw, max(n_dwellings) as max_dw
from applications
group by app_size, app_type
union all
select 'b_lag_le7', coalesce(r.app_type,'null'), coalesce(r.app_state,'null'),
       count(*), count(distinct pa.project_id), null, null
from project_applications pa
join applications a on a.uid = pa.uid and a.app_state = 'Permitted' and a.decided_date is not null
join projects p on p.id = pa.project_id
join applications r on r.uid = p.root_uid and r.decided_date is not null
where pa.role = 'discharge' and a.decided_date between r.decided_date and r.decided_date + 7
group by r.app_type, r.app_state
union all
select 'c_first_ge30', 'all', 'all', count(*), null,
       percentile_cont(0.25) within group (order by lag)::int,
       percentile_cont(0.75) within group (order by lag)::int
from (
  select p.id, min(a.decided_date - r.decided_date) as lag
  from project_applications pa
  join applications a on a.uid = pa.uid and a.app_state = 'Permitted' and a.decided_date is not null
  join projects p on p.id = pa.project_id
  join applications r on r.uid = p.root_uid and r.app_state in ('Permitted','Conditions') and r.decided_date is not null
  where pa.role = 'discharge' and a.decided_date - r.decided_date >= 30
  group by p.id
) x
order by 1, 4 desc
limit 60;
