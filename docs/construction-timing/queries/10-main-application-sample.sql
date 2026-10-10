-- Review sample: 40 projects with >=2 parent-less originals, seeded for reproducibility.
-- Output one row per member (original role), ordered per project, with what the current root rule picked.
with cand as (
  select pa.project_id
  from project_applications pa
  where pa.role = 'original' and not pa.has_parent_refs
  group by 1 having count(*) >= 2
),
pick as (
  select c.project_id
  from cand c join projects p on p.id = c.project_id
  where p.n_applications between 3 and 12
  order by md5(c.project_id::text || 'seed1')
  limit 40
)
select p.id as project_id, p.authority, p.name as project_address,
       (a.uid = p.root_uid) as is_root,
       a.uid, a.app_type, a.app_state, a.start_date, a.decided_date, a.n_dwellings,
       left(a.description, 140) as description
from pick
join projects p on p.id = pick.project_id
join project_applications pa on pa.project_id = p.id and pa.role = 'original' and not pa.has_parent_refs
join applications a on a.uid = pa.uid
order by p.id, a.start_date nulls last
limit 400;
