-- Private server-only database. No browser database credentials or public registration.
begin;
create table if not exists public.myspace_users(id uuid primary key,username text unique not null,password_hash text not null,app_metadata jsonb not null,active boolean not null default true);
create table if not exists public.myspace_sessions(token_hash text primary key,user_id uuid not null references public.myspace_users(id) on delete cascade,expires_at timestamptz not null);
create index if not exists myspace_session_expiry on public.myspace_sessions(expires_at);
create table if not exists public.myspace_login_attempts(attempt_key text primary key,window_start timestamptz not null default now(),attempts integer not null default 1);
create table if not exists public.eldinos_accounts (
 user_id uuid primary key references public.myspace_users(id),
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
create or replace function public.myspace_account_pull(account uuid,after_revision bigint default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('initialized',s.initialized,'revision',s.revision,'records',coalesce(
 (select jsonb_agg(jsonb_build_object('record_key',r.record_key,'value',r.value,'deleted',r.deleted))
 from public.eldinos_account_records r where r.user_id=account and r.revision>after_revision),'[]'::jsonb)) into result
 from public.eldinos_account_state s where s.user_id=account;
 return coalesce(result,'{"initialized":false,"revision":0,"records":[]}'::jsonb);
end;$$;
create or replace function public.myspace_account_apply(account uuid,changes jsonb) returns bigint
language plpgsql security definer set search_path='' as $$
declare entry jsonb; result bigint; started boolean;
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
create or replace function public.myspace_account_initialize(account uuid,records jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare started boolean;
begin
 insert into public.eldinos_account_state(user_id) values(account) on conflict do nothing;
 select initialized into started from public.eldinos_account_state where user_id=account for update;
 if started then return false;end if;
 if jsonb_typeof(records)<>'array' or not exists(select 1 from jsonb_array_elements(records) e where e->>'record_key'='[]') then raise exception 'Invalid initial data';end if;
 update public.eldinos_account_state set initialized=true where user_id=account;
 perform public.myspace_account_apply(account,records);return true;
end;$$;
revoke all on public.myspace_users,public.myspace_sessions,public.myspace_login_attempts,public.eldinos_accounts,public.eldinos_account_state,public.eldinos_account_records from public;
revoke all on function public.myspace_account_pull(uuid,bigint),public.myspace_account_apply(uuid,jsonb),public.myspace_account_initialize(uuid,jsonb) from public;
commit;
