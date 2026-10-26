-- Compare-and-swap on account and approved-policy revisions. The receipt and
-- cursor commit together, so competing devices cannot spend the same snapshot.
create or replace function myspace_reward_apply(account uuid,expected bigint,policy_revision bigint,changes jsonb) returns bigint
language plpgsql security definer set search_path=public as $$
declare actual bigint;
begin
 perform pg_advisory_xact_lock(782631);
 select revision into actual from eldinos_account_state where user_id=account for update;
 if actual is distinct from expected then return null;end if;
 if coalesce((select revision from myspace_coin_controls where user_id=account),-1)<>policy_revision then return null;end if;
 return myspace_account_apply(account,changes);
end;$$;
revoke all on function myspace_reward_apply(uuid,bigint,bigint,jsonb) from public;
