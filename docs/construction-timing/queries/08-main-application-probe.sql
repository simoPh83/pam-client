-- Is the root the "main" application? Probes for multi-app projects.
-- a) root_in_db vs root role
select 'a_root_in_db_vs_role' as probe, p.root_in_db::text as k1, pa.role as k2, count(*) as n
from projects p
join project_applications pa on pa.project_id = p.id and pa.uid = p.root_uid
group by 2, 3
union all
-- b) projects with >1 'original' member without parent refs (root choice is a date tiebreak)
select 'b_multi_original_candidates', 'projects', 'n_orig_noparent>=2', count(*)
from (
  select project_id from project_applications
  where role = 'original' and not has_parent_refs
  group by project_id having count(*) >= 2
) t
union all
-- c) of those, how often does a later original-type Full/Outline have more dwellings or a longer description than the root
select 'c_root_not_largest_desc', 'projects', 'root desc shorter than another orig candidate', count(*)
from (
  select p.id
  from projects p
  join applications r on r.uid = p.root_uid
  join project_applications pa on pa.project_id = p.id and pa.role = 'original' and not pa.has_parent_refs and pa.uid <> p.root_uid
  join applications c on c.uid = pa.uid
  where length(coalesce(c.description,'')) > length(coalesce(r.description,'')) * 1.5
    and c.app_type in ('Full','Outline')
  group by p.id
) t
union all
-- d) root app_type among projects with multiple original candidates
select 'd_root_type_multi_orig', coalesce(r.app_type,'null'), 'n', count(*)
from projects p
join applications r on r.uid = p.root_uid
where p.id in (
  select project_id from project_applications
  where role = 'original' and not has_parent_refs
  group by project_id having count(*) >= 2)
group by r.app_type
order by 1, 4 desc
limit 60;
