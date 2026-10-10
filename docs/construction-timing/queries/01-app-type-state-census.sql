-- Purpose: census of app_type x app_state over all applications (supports findings.md: app_type taxonomy, P1).
select coalesce(app_type, '(null)') as app_type,
       coalesce(app_state, '(null)') as app_state,
       count(*)::int as n,
       round(100.0 * count(*) / sum(count(*)) over (), 2) as pct
from applications
group by 1, 2
order by n desc
limit 80;
