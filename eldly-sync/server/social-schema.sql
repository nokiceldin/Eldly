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
 created_at timestamptz not null default now(),unique(sender,week),check(sender<>recipient)
);
revoke all on myspace_celebration_coins from public;
create index if not exists myspace_gift_recipient on myspace_celebration_coins(recipient);
alter table myspace_profiles add column if not exists timezone_locked boolean not null default false;
update myspace_profiles set timezone_locked=true where last_visit is not null and not timezone_locked;
