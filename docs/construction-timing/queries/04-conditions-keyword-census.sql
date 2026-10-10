-- Split app_type='Conditions' by description keywords (H-KW).
select
  case
    when description ~* 'discharge|details pursuant|approval of details|condition(s)? ?[0-9]' then 'discharge'
    when description ~* 'section 73|s73|variation of condition|vary condition|removal of condition' then 's73_variation'
    when description ~* 'non[- ]material|minor material' then 'nma'
    when description ~* 'reserved matters' then 'reserved_matters'
    else 'other'
  end as kind,
  app_state,
  count(*) as n
from applications
where app_type = 'Conditions'
group by 1, 2
order by n desc
limit 60;
