-- Prototype main_uid score vs current root on the same 40-project sample as query 10.
-- Score (higher wins): type + state + scale words - junk penalties; ties -> earliest start_date.
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
),
scored as (
  select p.id as project_id, p.name as addr, p.root_uid, a.uid, a.app_type, a.app_state, a.start_date,
    a.description,
    (case a.app_type when 'Full' then 40 when 'Outline' then 20 when 'Amendment' then 10 else 0 end
   + case a.app_state when 'Permitted' then 30 when 'Conditions' then 30 when 'Undecided' then 20
                      when 'Referred' then 15 else 0 end
   + case when a.description ~* '(storey|stories|flats?|dwellings?|apartments?|residential units|demolition|erection|construction of|new build|houses)' then 15 else 0 end
   + least(length(coalesce(a.description,'')), 400) / 40
   - case when a.description ~* '(lawful development|certificate of lawful|scoping|screening opinion|advertis|signage|tree|telecom|listed building consent|non-material|prior approval)' then 50 else 0 end
    ) as score,
    row_number() over (partition by p.id order by 1) as _rn
  from pick
  join projects p on p.id = pick.project_id
  join project_applications pa on pa.project_id = p.id and pa.role = 'original'
  join applications a on a.uid = pa.uid
),
ranked as (
  select *, row_number() over (partition by project_id order by score desc, start_date nulls last, uid) as rk
  from scored
)
select r.project_id, r.addr,
       (r.uid = r.root_uid) as main_is_root,
       r.app_type as main_type, r.app_state as main_state, r.score,
       left(r.description, 110) as main_desc,
       left((select a2.description from applications a2 where a2.uid = r.root_uid), 110) as root_desc
from ranked r
where rk = 1
order by main_is_root, r.project_id;
