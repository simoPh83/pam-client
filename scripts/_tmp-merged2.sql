select p.id, p.grouping_state, p.n_applications, p.root_uid, pa.uid, pa.is_root, pa.has_parent_refs
from projects p
join project_applications pa on pa.project_id = p.id
where p.id in (select project_id from project_applications where uid in ('Croydon/25/00586/FUL', 'Croydon/25/00568/FUL', 'Croydon/06/01368/FUL'))
order by p.id, pa.uid;
