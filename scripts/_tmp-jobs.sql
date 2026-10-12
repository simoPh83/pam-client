select id, kind, area, priority, status, attempts, started_at,
       now() - started_at as running_for
from jobs
where status in ('running', 'pending')
order by status, priority desc, id
limit 20;
