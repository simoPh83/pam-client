-- Purpose: project population profile — size distribution and role mix (supports findings.md: population).
select case when n_applications = 1 then '1'
            when n_applications = 2 then '2'
            when n_applications <= 5 then '3-5'
            when n_applications <= 10 then '6-10'
            when n_applications <= 30 then '11-30'
            else '31+' end as n_apps_band,
       count(*)::int as projects,
       count(*) filter (where root_uid is not null)::int as with_root
from projects
group by 1
order by min(n_applications);
