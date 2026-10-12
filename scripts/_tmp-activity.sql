select pid, state, wait_event_type, wait_event,
       now() - query_start as duration,
       left(query, 140) as query
from pg_stat_activity
where datname = current_database()
  and state is distinct from 'idle'
  and pid <> pg_backend_pid()
order by query_start nulls last
limit 20;
