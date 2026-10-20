-- LEGACY TEST FIXTURE ONLY. DO NOT RUN IN PRODUCTION: accounts.sql replaces this model.
-- PUBLIC SHARED ELDLY, v2. Run the entire file in Supabase SQL Editor.
-- Existing private eldly_records / Auth tables are left untouched.
-- Anyone with the public key can read/change/delete this ONE shared dataset.
begin;
create table if not exists public.eldly_shared_state (
 dataset text primary key default 'eldly' check(dataset='eldly'),
 revision bigint not null default 0,
 initialized boolean not null default false
);
insert into public.eldly_shared_state(dataset) values('eldly') on conflict do nothing;
create table if not exists public.eldly_shared_records (
 dataset text not null default 'eldly' check(dataset='eldly'),
 record_key text not null check(length(record_key)<=4096),
 value jsonb,
 deleted boolean not null default false,
 revision bigint not null default 0,
 primary key(dataset,record_key),
 constraint eldly_shared_path check (
  jsonb_typeof(record_key::jsonb)='array' and
  (jsonb_array_length(record_key::jsonb)=0 or
   record_key::jsonb->>0 in ('checkly-data-v1','packly-v1'))
 )
);
create index if not exists eldly_shared_revision on public.eldly_shared_records(dataset,revision);
alter table public.eldly_shared_state enable row level security;
alter table public.eldly_shared_records enable row level security;
revoke all on public.eldly_shared_state,public.eldly_shared_records from anon,authenticated;
grant select on public.eldly_shared_state to anon;
grant select,insert,update,delete on public.eldly_shared_records to anon;
drop policy if exists shared_read on public.eldly_shared_state;
create policy shared_read on public.eldly_shared_state for select to anon using(dataset='eldly');
drop policy if exists shared_select on public.eldly_shared_records;
drop policy if exists shared_insert on public.eldly_shared_records;
drop policy if exists shared_update on public.eldly_shared_records;
drop policy if exists shared_delete on public.eldly_shared_records;
create policy shared_select on public.eldly_shared_records for select to anon using(dataset='eldly');
create policy shared_insert on public.eldly_shared_records for insert to anon with check(dataset='eldly');
create policy shared_update on public.eldly_shared_records for update to anon using(dataset='eldly') with check(dataset='eldly');
create policy shared_delete on public.eldly_shared_records for delete to anon using(dataset='eldly');
-- Every write, including direct REST writes, updates the pull cursor.
-- A DELETE becomes a tombstone, so offline devices learn about the deletion.
create or replace function public.eldly_shared_stamp()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if TG_OP='DELETE' then
  update public.eldly_shared_records set value=null,deleted=true
  where dataset=old.dataset and record_key=old.record_key;
  return null;
 end if;
 if TG_OP='UPDATE' and (new.dataset<>old.dataset or new.record_key<>old.record_key) then
  raise exception 'Record keys are immutable; delete and insert instead';
 end if;
 update public.eldly_shared_state set revision=revision+1 where dataset='eldly' returning revision into new.revision;
 return new;
end;
$$;
revoke all on function public.eldly_shared_stamp() from public,anon,authenticated;
drop trigger if exists eldly_shared_stamp on public.eldly_shared_records;
create trigger eldly_shared_stamp before insert or update or delete on public.eldly_shared_records
for each row execute function public.eldly_shared_stamp();
create or replace function public.eldly_shared_pull(after_revision bigint default 0)
returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
 select jsonb_build_object('initialized',s.initialized,'revision',s.revision,'records',coalesce(
 (select jsonb_agg(jsonb_build_object('record_key',r.record_key,'value',r.value,'deleted',r.deleted))
 from public.eldly_shared_records r where r.dataset='eldly' and r.revision>after_revision),'[]'::jsonb))
 from public.eldly_shared_state s where s.dataset='eldly';
$$;
-- Only this fixed shared dataset is writable by these RPCs. No dynamic SQL or
-- arbitrary table names. The lock serializes devices and makes initialization atomic.
create or replace function public.eldly_shared_apply(changes jsonb)
returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare entry jsonb; result bigint; started boolean;
begin
 select initialized into started from public.eldly_shared_state where dataset='eldly' for update;
 if not started then raise exception 'Initialize the shared checklist first'; end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>50000 or octet_length(changes::text)>8388608 then
  raise exception 'Invalid or oversized change set';
 end if;
 for entry in select * from jsonb_array_elements(changes) loop
  insert into public.eldly_shared_records(dataset,record_key,value,deleted)
  values('eldly',entry->>'record_key',entry->'value',coalesce((entry->>'deleted')::boolean,false))
  on conflict(dataset,record_key) do update set value=excluded.value,deleted=excluded.deleted;
 end loop;
 select revision into result from public.eldly_shared_state where dataset='eldly';
 return result;
end;
$$;
create or replace function public.eldly_shared_initialize(records jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare started boolean;
begin
 select initialized into started from public.eldly_shared_state where dataset='eldly' for update;
 if started then return false; end if;
 -- Do not overwrite records written directly through REST either.
 if exists(select 1 from public.eldly_shared_records where dataset='eldly') then
  raise exception 'Shared records already exist; inspect them before initializing';
 end if;
 if jsonb_typeof(records)<>'array' or not exists(select 1 from jsonb_array_elements(records) e where e->>'record_key'='[]') then
  raise exception 'Invalid initial data';
 end if;
 update public.eldly_shared_state set initialized=true where dataset='eldly';
 perform public.eldly_shared_apply(records);
 return true;
end;
$$;
revoke all on function public.eldly_shared_pull(bigint),public.eldly_shared_apply(jsonb),public.eldly_shared_initialize(jsonb) from public,anon,authenticated;
grant execute on function public.eldly_shared_pull(bigint),public.eldly_shared_apply(jsonb),public.eldly_shared_initialize(jsonb) to anon;
commit;
