-- Device subscriptions belong to the signed-in session, and disappear on logout.
create table if not exists myspace_push_subscriptions(id uuid primary key,user_id uuid not null references myspace_users(id),session_hash text not null references myspace_sessions(token_hash) on delete cascade,endpoint text not null unique,keys jsonb not null,created_at timestamptz not null default now());
create index if not exists myspace_push_user on myspace_push_subscriptions(user_id);
create table if not exists myspace_push_outbox(notification_id uuid primary key references myspace_notifications(id),queued boolean not null default false,sent_at timestamptz);
create table if not exists myspace_push_deliveries(notification_id uuid references myspace_notifications(id),subscription_id uuid references myspace_push_subscriptions(id) on delete cascade,primary key(notification_id,subscription_id));
create table if not exists myspace_push_reminders(user_id uuid primary key references myspace_users(id),generation uuid not null,scheduled_for timestamptz not null,queued boolean not null default false);
alter table myspace_notifications drop constraint if exists myspace_notifications_kind_check;
alter table myspace_notifications add constraint myspace_notifications_kind_check check(kind in('goal_self','goal','streak','celebration','friend_request','friend_accept','reminder','rules_changed','badge'));
create or replace function myspace_push_enqueue() returns trigger language plpgsql security definer set search_path=public as $$begin
 if (new.kind in('friend_request','friend_accept','reminder','rules_changed','goal','badge') or (new.kind='celebration' and new.gift_amount>0)) and exists(select 1 from myspace_push_subscriptions p join myspace_sessions s on s.token_hash=p.session_hash where p.user_id=new.recipient and s.expires_at>now()) then
  insert into myspace_push_outbox(notification_id) values(new.id) on conflict do nothing;
 end if;return new;end;$$;
drop trigger if exists myspace_push_notify on myspace_notifications;
create trigger myspace_push_notify after insert on myspace_notifications for each row execute function myspace_push_enqueue();
revoke all on myspace_push_subscriptions,myspace_push_outbox,myspace_push_deliveries,myspace_push_reminders from public;
revoke all on function myspace_push_enqueue() from public;

create table if not exists myspace_push_health(id boolean primary key default true check(id),processed_at timestamptz not null default now());
revoke all on myspace_push_health from public;
