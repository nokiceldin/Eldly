-- Additive, server-only social tables. Existing personal account data stays private.
create table if not exists myspace_profiles(user_id uuid primary key references myspace_users(id),timezone text not null,avatar jsonb not null default '{}',last_visit date,streak integer not null default 0,longest integer not null default 0);
create table if not exists myspace_friends(id uuid primary key,a uuid not null references myspace_users(id),b uuid not null references myspace_users(id),requested_by uuid not null,status text not null check(status in ('pending','accepted','declined','removed')),created_at timestamptz not null default now(),unique(a,b),check(a<b),check(requested_by in(a,b)));
create table if not exists myspace_best_pairs(id uuid primary key,a uuid not null references myspace_users(id),b uuid not null references myspace_users(id),starts_on date not null,ended_at timestamptz,check(a<b));
create table if not exists myspace_best_members(user_id uuid primary key references myspace_users(id),pair_id uuid not null references myspace_best_pairs(id));
create table if not exists myspace_best_requests(id uuid primary key,requester uuid not null references myspace_users(id),recipient uuid not null references myspace_users(id),status text not null default 'pending',created_at timestamptz not null default now(),check(requester<>recipient));
create unique index if not exists myspace_pending_best on myspace_best_requests(least(requester,recipient),greatest(requester,recipient)) where status='pending';
create table if not exists myspace_coin_controls(user_id uuid primary key references myspace_users(id),starts_on date not null,legacy jsonb not null,periods jsonb not null default '[]');
create table if not exists myspace_coin_proposals(id uuid primary key,owner_id uuid not null references myspace_users(id),reviewer_id uuid not null references myspace_users(id),pair_id uuid not null references myspace_best_pairs(id),config jsonb not null,status text not null default 'pending' check(status in ('pending','approved','declined','superseded','canceled')),reviewed_config jsonb,effective_from date,created_at timestamptz not null default now(),reviewed_at timestamptz,check(owner_id<>reviewer_id));
create unique index if not exists myspace_one_pending_proposal on myspace_coin_proposals(owner_id) where status='pending';
create table if not exists myspace_notifications(id uuid primary key,recipient uuid not null references myspace_users(id),actor uuid not null references myspace_users(id),kind text not null check(kind in ('goal','streak','celebration')),source_key text not null,milestone integer,celebrated boolean not null default false,read_at timestamptz,created_at timestamptz not null default now(),unique(recipient,source_key));
create index if not exists myspace_notification_inbox on myspace_notifications(recipient,created_at desc);
revoke all on myspace_profiles,myspace_friends,myspace_best_pairs,myspace_best_members,myspace_best_requests,myspace_coin_controls,myspace_coin_proposals,myspace_notifications from public;

alter table myspace_profiles add column if not exists avatar jsonb not null default '{}';

alter table myspace_profiles add column if not exists avatar_preset text not null default 'original';

alter table myspace_notifications add column if not exists gift_amount numeric(12,2) not null default 0;
create table if not exists myspace_celebration_coins(
 notification_id uuid primary key references myspace_notifications(id),
 sender uuid not null references myspace_users(id),recipient uuid not null references myspace_users(id),
 week date not null,amount numeric(12,2) not null check(amount>0 and amount<=10000000),
 created_at timestamptz not null default now(),check(sender<>recipient)
);
revoke all on myspace_celebration_coins from public;
create index if not exists myspace_gift_recipient on myspace_celebration_coins(recipient);
alter table myspace_profiles add column if not exists timezone_locked boolean not null default false;
update myspace_profiles set timezone_locked=true where last_visit is not null and not timezone_locked;

-- Preserve existing gifts while changing the weekly limit to each friendship.
create unique index if not exists myspace_one_gift_per_friend_week on myspace_celebration_coins(sender,recipient,week);
alter table myspace_celebration_coins drop constraint if exists myspace_celebration_coins_sender_week_key;
alter table myspace_coin_controls add column if not exists revision bigint not null default 0;
alter table myspace_notifications add column if not exists rule_changes jsonb not null default '[]';

-- Preserve previously earned bonuses when introducing dated tracker archiving.
create table if not exists myspace_app_migrations(name text primary key,applied_at timestamptz not null default now());
revoke all on myspace_app_migrations from public;
DO $archive_migration$
declare account_row record;
begin
 if not exists(select 1 from myspace_app_migrations where name='dated-tracker-archives-v1') then
  for account_row in
   with archived as (
    select r.user_id,
     array_to_json(array(select jsonb_array_elements_text(jsonb_set(r.record_key::jsonb,'{4}','"archivedFrom"'::jsonb))))::text as key,
     to_char(date_trunc('week',now() at time zone coalesce(p.timezone,'UTC')),'YYYY-MM-DD') as stamp
    from eldinos_account_records r left join myspace_profiles p on p.user_id=r.user_id
    where not r.deleted and jsonb_array_length(r.record_key::jsonb)=5 and r.record_key::jsonb->>0='checkly-data-v1' and r.record_key::jsonb->>1='mapping' and r.record_key::jsonb->>2='habits' and r.record_key::jsonb->>4='archived' and r.value->'value'='true'::jsonb
   )
   select archived.user_id,jsonb_agg(jsonb_build_object('record_key',key,'value',jsonb_build_object('node','value','value',stamp))) as changes
   from archived where not exists(select 1 from eldinos_account_records a where a.user_id=archived.user_id and not a.deleted and a.record_key=archived.key)
   group by archived.user_id
  loop perform myspace_account_apply(account_row.user_id,account_row.changes);end loop;
  insert into myspace_app_migrations(name) values('dated-tracker-archives-v1');
 end if;
end;$archive_migration$;
