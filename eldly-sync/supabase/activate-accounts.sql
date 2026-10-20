-- Run once after accounts.sql and provisioning the two Auth users.
-- Atomic cutover: no legacy writes can race the owner's data migration.
begin;
lock table public.eldly_shared_state, public.eldly_shared_records in access exclusive mode;
insert into public.eldinos_accounts(user_id,username,legacy_owner)
 select id,'nokiceldin',true from auth.users where email='nokiceldin@accounts.eldinos.invalid'
 on conflict(user_id) do nothing;
insert into public.eldinos_accounts(user_id,username,legacy_owner)
 select id,'henriquesa',false from auth.users where email='henriquesa@accounts.eldinos.invalid'
 on conflict(user_id) do nothing;
do $$
declare owner_id uuid;
begin
 select user_id into strict owner_id from public.eldinos_accounts where legacy_owner and username='nokiceldin';
 if exists(select 1 from public.eldinos_account_state where user_id=owner_id and initialized) then
  raise exception 'Owner account already initialized; refusing to overwrite it';
 end if;
 if not exists(select 1 from public.eldly_shared_state where initialized) then raise exception 'Legacy data is missing; stop and restore the backup';end if;
 insert into public.eldinos_account_state(user_id,revision,initialized)
 select owner_id,revision,true from public.eldly_shared_state;
 insert into public.eldinos_account_records(user_id,record_key,value,deleted,revision)
 select owner_id,record_key,value,deleted,revision from public.eldly_shared_records;
 if (select count(*) from public.eldinos_account_records where user_id=owner_id)<>(select count(*) from public.eldly_shared_records) then
  raise exception 'Record counts do not match; migration rolled back';
 end if;
end;$$;
-- Keep every old record as an admin-only recovery copy. Guests and older app
-- versions lose all access to the former single public dataset.
revoke all on public.eldly_shared_state,public.eldly_shared_records from public,anon,authenticated;
revoke all on function public.eldly_shared_pull(bigint),public.eldly_shared_apply(jsonb),public.eldly_shared_initialize(jsonb) from public,anon,authenticated;
commit;
select a.username,count(r.record_key) as records from public.eldinos_accounts a left join public.eldinos_account_records r using(user_id) group by a.username order by a.username;
