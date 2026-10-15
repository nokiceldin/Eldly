-- Run once in Supabase SQL Editor. Safe to re-run.
create table if not exists public.eldly_allowed_users (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.eldly_sync_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0
);
create table if not exists public.eldly_records (
 user_id uuid not null references auth.users(id) on delete cascade,
 record_key text not null, value jsonb, deleted boolean not null default false,
 revision bigint not null,
 primary key(user_id,record_key)
);
create index if not exists eldly_records_revision on public.eldly_records(user_id,revision);
alter table public.eldly_allowed_users enable row level security;
alter table public.eldly_sync_state enable row level security;
alter table public.eldly_records enable row level security;
drop policy if exists owner on public.eldly_allowed_users;
create policy owner on public.eldly_allowed_users for select to authenticated using (user_id=auth.uid());
drop policy if exists owner on public.eldly_sync_state;
create policy owner on public.eldly_sync_state for all to authenticated
 using (user_id=auth.uid() and exists(select 1 from public.eldly_allowed_users where user_id=auth.uid()))
 with check (user_id=auth.uid() and exists(select 1 from public.eldly_allowed_users where user_id=auth.uid()));
drop policy if exists owner on public.eldly_records;
create policy owner on public.eldly_records for all to authenticated
 using (user_id=auth.uid() and exists(select 1 from public.eldly_allowed_users where user_id=auth.uid()))
 with check (user_id=auth.uid() and exists(select 1 from public.eldly_allowed_users where user_id=auth.uid()));
revoke all on public.eldly_allowed_users, public.eldly_sync_state, public.eldly_records from anon, authenticated;
grant select on public.eldly_allowed_users to authenticated;
grant select,insert,update on public.eldly_sync_state, public.eldly_records to authenticated;
create or replace function public.eldly_pull(after_revision bigint default 0)
returns jsonb language sql stable security invoker set search_path = public as $$
 select jsonb_build_object('revision',coalesce((select revision from public.eldly_sync_state where user_id=auth.uid()),0),
 'records',coalesce((select jsonb_agg(jsonb_build_object('record_key',record_key,'value',value,'deleted',deleted))
 from public.eldly_records where user_id=auth.uid() and revision>after_revision),'[]'::jsonb))
 where exists(select 1 from public.eldly_allowed_users where user_id=auth.uid());
$$;
create or replace function public.eldly_apply(changes jsonb)
returns bigint language plpgsql security invoker set search_path = public as $$
declare next_revision bigint; entry jsonb; owner_id uuid := auth.uid();
begin
 if owner_id is null or not exists(select 1 from public.eldly_allowed_users where user_id=owner_id) then
  raise exception 'This account is not enabled for Eldly. Add its user ID to eldly_allowed_users.';
 end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>400 then raise exception 'Invalid sync batch'; end if;
 insert into public.eldly_sync_state(user_id) values(owner_id) on conflict do nothing;
 select revision+1 into next_revision from public.eldly_sync_state where user_id=owner_id for update;
 for entry in select * from jsonb_array_elements(changes) loop
  if length(entry->>'record_key')>4096 or jsonb_typeof((entry->>'record_key')::jsonb)<>'array' then raise exception 'Invalid record key'; end if;
  insert into public.eldly_records(user_id,record_key,value,deleted,revision)
  values(owner_id,entry->>'record_key',entry->'value',coalesce((entry->>'deleted')::boolean,false),next_revision)
  on conflict(user_id,record_key) do update set value=excluded.value,deleted=excluded.deleted,revision=excluded.revision;
 end loop;
 update public.eldly_sync_state set revision=next_revision where user_id=owner_id;
 return next_revision;
end;
$$;
revoke all on function public.eldly_pull(bigint), public.eldly_apply(jsonb) from public, anon;
grant execute on function public.eldly_pull(bigint), public.eldly_apply(jsonb) to authenticated;
-- After creating your user, run this separately (replace the UUID):
-- insert into public.eldly_allowed_users(user_id) values ('YOUR-AUTH-USER-UUID') on conflict do nothing;
