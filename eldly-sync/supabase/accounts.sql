-- Private accounts. Apply as project administrator. Does not delete legacy data.
begin;
create table if not exists public.eldinos_accounts (
 user_id uuid primary key references auth.users(id),
 username text not null unique check(username ~ '^[a-z0-9_]{3,32}$'),
 legacy_owner boolean not null default false,
 created_at timestamptz not null default now()
);
create unique index if not exists eldinos_one_legacy_owner on public.eldinos_accounts(legacy_owner) where legacy_owner;
create table if not exists public.eldinos_account_state (
 user_id uuid primary key references public.eldinos_accounts(user_id),
 revision bigint not null default 0,
 initialized boolean not null default false
);
create table if not exists public.eldinos_account_records (
 user_id uuid not null references public.eldinos_accounts(user_id),
 record_key text not null check(length(record_key)<=4096), value jsonb,
 deleted boolean not null default false, revision bigint not null,
 primary key(user_id,record_key),
 check(jsonb_typeof(record_key::jsonb)='array' and
  (jsonb_array_length(record_key::jsonb)=0 or record_key::jsonb->>0 in ('checkly-data-v1','packly-v1')))
);
create index if not exists eldinos_account_revision on public.eldinos_account_records(user_id,revision);
alter table public.eldinos_accounts enable row level security;
alter table public.eldinos_account_state enable row level security;
alter table public.eldinos_account_records enable row level security;
revoke all on public.eldinos_accounts,public.eldinos_account_state,public.eldinos_account_records from public,anon,authenticated;
grant select on public.eldinos_accounts,public.eldinos_account_state,public.eldinos_account_records to authenticated;
create policy account_profile_read on public.eldinos_accounts for select to authenticated using(user_id=(select auth.uid()));
create policy account_state_read on public.eldinos_account_state for select to authenticated using(user_id=(select auth.uid()));
create policy account_records_read on public.eldinos_account_records for select to authenticated using(user_id=(select auth.uid()));
create function public.eldinos_current_account() returns uuid language plpgsql stable security definer set search_path='' as $$
declare account uuid;
begin
 select user_id into account from public.eldinos_accounts where user_id=auth.uid();
 if account is null then raise exception 'Account not provisioned or session expired' using errcode='42501'; end if;
 return account;
end;$$;
create function public.eldinos_account_pull(after_revision bigint default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare account uuid:=public.eldinos_current_account(); result jsonb;
begin
 select jsonb_build_object('initialized',s.initialized,'revision',s.revision,'records',coalesce(
 (select jsonb_agg(jsonb_build_object('record_key',r.record_key,'value',r.value,'deleted',r.deleted))
 from public.eldinos_account_records r where r.user_id=account and r.revision>after_revision),'[]'::jsonb)) into result
 from public.eldinos_account_state s where s.user_id=account;
 return coalesce(result,'{"initialized":false,"revision":0,"records":[]}'::jsonb);
end;$$;
create function public.eldinos_account_apply(changes jsonb) returns bigint
language plpgsql security definer set search_path='' as $$
declare account uuid:=public.eldinos_current_account(); entry jsonb; result bigint; started boolean;
begin
 select initialized into started from public.eldinos_account_state where user_id=account for update;
 if started is distinct from true then raise exception 'Initialize your account first'; end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>50000 or octet_length(changes::text)>8388608 then raise exception 'Invalid or oversized change set';end if;
 update public.eldinos_account_state set revision=revision+1 where user_id=account returning revision into result;
 for entry in select * from jsonb_array_elements(changes) loop
  insert into public.eldinos_account_records(user_id,record_key,value,deleted,revision)
  values(account,entry->>'record_key',entry->'value',coalesce((entry->>'deleted')::boolean,false),result)
  on conflict(user_id,record_key) do update set value=excluded.value,deleted=excluded.deleted,revision=excluded.revision;
 end loop;
 return result;
end;$$;
create function public.eldinos_account_initialize(records jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare account uuid:=public.eldinos_current_account(); started boolean;
begin
 insert into public.eldinos_account_state(user_id) values(account) on conflict do nothing;
 select initialized into started from public.eldinos_account_state where user_id=account for update;
 if started then return false;end if;
 if jsonb_typeof(records)<>'array' or not exists(select 1 from jsonb_array_elements(records) e where e->>'record_key'='[]') then raise exception 'Invalid initial data';end if;
 update public.eldinos_account_state set initialized=true where user_id=account;
 perform public.eldinos_account_apply(records);return true;
end;$$;
revoke all on function public.eldinos_current_account(),public.eldinos_account_pull(bigint),public.eldinos_account_apply(jsonb),public.eldinos_account_initialize(jsonb) from public,anon,authenticated;
grant execute on function public.eldinos_current_account(),public.eldinos_account_pull(bigint),public.eldinos_account_apply(jsonb),public.eldinos_account_initialize(jsonb) to authenticated;
commit;
