-- Root quality: what kind of application is projects.root_uid?
select 'a_root_type' as probe, coalesce(r.app_type,'null') as k1, 'all' as k2, count(*) as n
from projects p join applications r on r.uid = p.root_uid
group by 2
union all
select 'b_root_type_multi', coalesce(r.app_type,'null'), 'n_apps>=2', count(*)
from projects p join applications r on r.uid = p.root_uid
where p.n_applications >= 2
group by 2
union all
select 'c_root_role_vs_is_root', pa.role, pa.is_root::text, count(*)
from projects p join project_applications pa on pa.project_id = p.id and pa.uid = p.root_uid
group by 2, 3
union all
select 'd_conditions_root_has_parent_ref', (pa.parent_ref is not null)::text, 'root app_type=Conditions', count(*)
from projects p
join applications r on r.uid = p.root_uid and r.app_type = 'Conditions'
join project_applications pa on pa.project_id = p.id and pa.uid = p.root_uid
group by 2, 3
union all
select 'e_root_conditions_later_sibling_original', 'projects', 'root=Conditions & has non-Conditions member', count(distinct p.id)
from projects p
join applications r on r.uid = p.root_uid and r.app_type = 'Conditions'
join project_applications pa on pa.project_id = p.id
join applications m on m.uid = pa.uid and m.app_type in ('Full','Outline')
order by 1, 4 desc
limit 80;
