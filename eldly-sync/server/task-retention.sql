-- The device sends its retention week after saving overdue recurring occurrences.
alter table public.eldinos_account_state add column if not exists retention_revision bigint not null default 0;

create or replace function public.myspace_prune_history(account uuid) returns void
language plpgsql set search_path='' as $$
declare
  cutoff text;
  removed integer;
begin
  perform 1 from public.eldinos_account_state where user_id=account for update;

  select least(value->>'value', (date_trunc('week', now() at time zone 'UTC')::date)::text)
  into cutoff
  from public.eldinos_account_records
  where user_id=account and record_key='["checkly-data-v1","taskHistoryFrom"]' and not deleted
    and value->>'value' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
  if cutoff is null then return; end if;

  with fields as (
    select record_key::jsonb as path, value->>'value' as field
    from public.eldinos_account_records
    where user_id=account and not deleted and record_key::jsonb->>0='checkly-data-v1'
      and record_key::jsonb->>1 in ('tasks','overrides','routines')
  ), expired as (
    select path->>1 as section, path->>2 as id
    from fields where path->>2 is not null
    group by 1,2
    having case when path->>1='routines' then
      max(field) filter (where path->>3='end') < cutoff
    else
      (bool_or(field='true') filter (where path->>3='deleted') is true
        or max(field) filter (where path->>3='completed') is not null)
      and max(field) filter (where path->>3='scheduled') < cutoff
      and coalesce(max(field) filter (where path->>3='completed'
        or (path->>1='overrides' and path->>3='original')), '') < cutoff
    end
  )
  delete from public.eldinos_account_records r using expired
  where r.user_id=account and r.record_key::jsonb->>0='checkly-data-v1'
    and r.record_key::jsonb->>1=expired.section and r.record_key::jsonb->>2=expired.id;
  get diagnostics removed = row_count;
  if removed=0 then return; end if;

  -- Remove deleted IDs from the ordering records as well as their task rows.
  update public.eldinos_account_records list
  set value=jsonb_set(list.value, '{order}', retained.ids)
  from lateral (
    select '["checkly-data-v1","tasks"]' as key
    union all select '["checkly-data-v1","routines"]'
  ) sections
  cross join lateral (
    select coalesce(jsonb_agg(id order by position), '[]'::jsonb) as ids
    from public.eldinos_account_records source
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(source.value->'order')='array' then source.value->'order' else '[]'::jsonb end
    ) with ordinality as entries(id, position)
    where source.user_id=account and source.record_key=sections.key and not source.deleted
      and exists (
        select 1 from public.eldinos_account_records item
        where item.user_id=account and not item.deleted
          and item.record_key::jsonb=(source.record_key::jsonb || to_jsonb(entries.id))
      )
  ) retained
  where list.user_id=account and list.record_key=sections.key and not list.deleted
    and list.value->>'node'='list' and list.value->'order' is distinct from retained.ids;

  update public.eldinos_account_state set revision=revision+1,retention_revision=revision+1
  where user_id=account;
end;
$$;
revoke all on function public.myspace_prune_history(uuid) from public;

create or replace function public.myspace_current_apply(account uuid, changes jsonb, cursor_revision bigint) returns bigint
language plpgsql set search_path='' as $$
declare
  minimum_revision bigint;
  applied bigint;
begin
  select retention_revision into minimum_revision
  from public.eldinos_account_state where user_id=account for update;
  if cursor_revision < minimum_revision then return null; end if;
  applied := public.myspace_account_apply(account,changes);
  perform public.myspace_prune_history(account);
  return applied;
end;
$$;
revoke all on function public.myspace_current_apply(uuid,jsonb,bigint) from public;

create or replace function public.myspace_current_pull(account uuid, cursor_revision bigint, journal_access boolean) returns jsonb
language sql stable set search_path='' as $$
  with snapshot as (
    select case when cursor_revision > 0 and cursor_revision < coalesce((
      select retention_revision from public.eldinos_account_state where user_id=account
    ),0)
    then public.myspace_account_pull(account,0) || '{"reset":true}'::jsonb
    else public.myspace_account_pull(account,cursor_revision) end as data
  )
  select case when journal_access then data else jsonb_set(data, '{records}', coalesce((
    select jsonb_agg(record) from jsonb_array_elements(data->'records') as records(record)
    where (record->>'record_key')::jsonb->>1 is distinct from 'journal'
  ), '[]'::jsonb)) end from snapshot;
$$;
revoke all on function public.myspace_current_pull(uuid,bigint,boolean) from public;

DO $remove_packing$
begin
  if not exists (select 1 from public.myspace_app_migrations where name='remove-packing-v1') then
    update public.eldinos_account_state s set revision=revision+1,retention_revision=revision+1
    where exists (select 1 from public.eldinos_account_records r
      where r.user_id=s.user_id and r.record_key::jsonb->>0='packly-v1');
    delete from public.eldinos_account_records where record_key::jsonb->>0='packly-v1';
    insert into public.myspace_app_migrations(name) values ('remove-packing-v1');
  end if;
end;
$remove_packing$;
