-- Role x app_state census across project members, plus median gap (days) from the
-- project's root decision to each member's start_date.
select
  pa.role,
  a.app_state,
  count(*) as n,
  percentile_cont(0.5) within group (order by (a.start_date - r.decided_date)) as median_gap_days_from_root_decision
from project_applications pa
join applications a on a.uid = pa.uid
join projects p on p.id = pa.project_id
left join applications r on r.uid = p.root_uid
where p.n_applications >= 4
group by 1, 2
order by n desc
limit 60;
