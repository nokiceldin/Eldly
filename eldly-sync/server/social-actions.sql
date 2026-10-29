create or replace function myspace_social_action(actor uuid,action text,p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
#variable_conflict use_variable
declare other uuid; req myspace_friends%rowtype; br myspace_best_requests%rowtype; pair myspace_best_pairs%rowtype; proposal myspace_coin_proposals%rowtype; notification myspace_notifications%rowtype; starts date; n integer; day date; result jsonb; badge jsonb; previous_level integer;
begin
 -- Social mutations are small and serialized to enforce singleton pairs and replay protection.
 perform pg_advisory_xact_lock(782631);
 if not exists(select 1 from myspace_users where id=actor and active) then raise exception 'SOCIAL: Please sign in again.';end if;
 starts:=date_trunc('week',current_date)::date+7;
 if action='friend_request' then
  select id into other from myspace_users where username=lower(trim(p->>'username')) and active;
  if other is null then raise exception 'SOCIAL: No account has that username.';end if;
  if other=actor then raise exception 'SOCIAL: You cannot add yourself.';end if;
  if exists(select 1 from myspace_friends where a=least(actor,other) and b=greatest(actor,other) and status in('accepted','pending')) then raise exception 'SOCIAL: You are already friends or have a pending request.';end if;
  insert into myspace_friends(id,a,b,requested_by,status) values((p->>'id')::uuid,least(actor,other),greatest(actor,other),actor,'pending') on conflict(a,b) do update set id=excluded.id,requested_by=actor,status='pending',created_at=now();
  insert into myspace_notifications(id,recipient,actor,kind,source_key) values(gen_random_uuid(),other,actor,'friend_request','friend-request:'||(p->>'id')) on conflict do nothing;
 elsif action in('friend_accept','friend_decline','friend_cancel','friend_remove') then
  select * into req from myspace_friends where id=(p->>'id')::uuid and actor in(a,b);
  if req.id is null then raise exception 'SOCIAL: Friend request no longer available.';end if;
  if action='friend_remove' then
   if req.status<>'accepted' then raise exception 'SOCIAL: You are not friends.';end if;
   other:=case when req.a=actor then req.b else req.a end;
   select q.* into pair from myspace_best_pairs q join myspace_best_members m on m.pair_id=q.id where m.user_id=actor and other in(q.a,q.b);
   if pair.id is not null then
    update myspace_best_pairs set ended_at=now() where id=pair.id;delete from myspace_best_members where pair_id=pair.id;
    update myspace_coin_proposals set status='canceled' where pair_id=pair.id and status='pending';
   end if;
   update myspace_best_requests set status='canceled' where status='pending' and requester in(req.a,req.b) and recipient in(req.a,req.b);
   update myspace_friends set status='removed' where id=req.id;
  else
   if req.status<>'pending' or (action='friend_cancel' and req.requested_by<>actor) or (action<>'friend_cancel' and req.requested_by=actor) then raise exception 'SOCIAL: This request is not yours to answer.';end if;
   update myspace_friends set status=case when action='friend_accept' then 'accepted' else 'declined' end where id=req.id;
   if action='friend_accept' then insert into myspace_notifications(id,recipient,actor,kind,source_key) values(gen_random_uuid(),req.requested_by,actor,'friend_accept','friend-accept:'||req.id) on conflict do nothing;end if;
  end if;
 elsif action='best_request' then
  other:=(p->>'userId')::uuid;
  if other=actor or not exists(select 1 from myspace_friends where a=least(actor,other) and b=greatest(actor,other) and status='accepted') then raise exception 'SOCIAL: Add and accept this friend first.';end if;
  if exists(select 1 from myspace_best_members where user_id in(actor,other)) then raise exception 'SOCIAL: One of you already has a best friend.';end if;
  if exists(select 1 from myspace_best_requests where least(requester,recipient)=least(actor,other) and greatest(requester,recipient)=greatest(actor,other) and status='pending') then raise exception 'SOCIAL: A best-friend request is already pending.';end if;
  insert into myspace_best_requests(id,requester,recipient) values((p->>'id')::uuid,actor,other);
 elsif action in('best_accept','best_decline','best_cancel') then
  select * into br from myspace_best_requests where id=(p->>'id')::uuid and status='pending';
  if br.id is null or (action='best_cancel' and br.requester<>actor) or (action<>'best_cancel' and br.recipient<>actor) then raise exception 'SOCIAL: Best-friend request no longer available.';end if;
  if action='best_accept' then
   other:=br.requester;
   if not exists(select 1 from myspace_friends where a=least(actor,other) and b=greatest(actor,other) and status='accepted') then raise exception 'SOCIAL: You must still be friends.';end if;
   if exists(select 1 from myspace_best_members where user_id in(actor,other)) then raise exception 'SOCIAL: One of you already has a best friend.';end if;
   insert into myspace_best_pairs(id,a,b,starts_on) values(br.id,least(actor,other),greatest(actor,other),starts);
   insert into myspace_best_members values(actor,br.id),(other,br.id);
   insert into myspace_coin_controls(user_id,starts_on,legacy) values(actor,starts,p->'mine'),(other,starts,p->'theirs') on conflict(user_id) do nothing;
   update myspace_coin_proposals set status='canceled' where owner_id in(actor,other) and status='pending';
   insert into myspace_coin_proposals(id,owner_id,reviewer_id,pair_id,config) values((p->>'mineId')::uuid,actor,other,br.id,p->'mine'),((p->>'theirsId')::uuid,other,actor,br.id,p->'theirs');
   update myspace_best_requests set status=case when id=br.id then 'accepted' else 'canceled' end where status='pending' and (requester in(actor,other) or recipient in(actor,other));
  else update myspace_best_requests set status=case when action='best_decline' then 'declined' else 'canceled' end where id=br.id;end if;
 elsif action='best_leave' then
  select q.* into pair from myspace_best_pairs q join myspace_best_members m on m.pair_id=q.id where m.user_id=actor;
  if pair.id is null then raise exception 'SOCIAL: You do not have a best friend.';end if;
  update myspace_best_pairs set ended_at=now() where id=pair.id;delete from myspace_best_members where pair_id=pair.id;
  update myspace_coin_proposals set status='canceled' where pair_id=pair.id and status='pending';
 elsif action='propose_rules' then
  select q.* into pair from myspace_best_pairs q join myspace_best_members m on m.pair_id=q.id where m.user_id=actor;
  if pair.id is null then raise exception 'SOCIAL: Choose a best friend first.';end if;
  other:=case when pair.a=actor then pair.b else pair.a end;
  update myspace_coin_proposals set status='superseded' where owner_id=actor and status='pending';
  insert into myspace_coin_proposals(id,owner_id,reviewer_id,pair_id,config) values((p->>'id')::uuid,actor,other,pair.id,p->'config');
 elsif action='review_rules' then
  select r.* into proposal from myspace_coin_proposals r join myspace_best_members m on m.pair_id=r.pair_id and m.user_id=actor where r.id=(p->>'id')::uuid and r.reviewer_id=actor and r.status='pending';
  if proposal.id is null then raise exception 'SOCIAL: This review is no longer available.';end if;
  if p->>'decision'='approve' then
   select greatest(starts_on,starts) into starts from myspace_best_pairs where id=proposal.pair_id;
   update myspace_coin_proposals set status='approved',reviewed_config=p->'config',reviewed_at=now(),effective_from=starts where id=proposal.id;
   update myspace_coin_controls set revision=revision+1,periods=(select coalesce(jsonb_agg(e),'[]') from jsonb_array_elements(periods) e where e->>'from'<>starts::text)||jsonb_build_array(jsonb_build_object('from',starts,'config',p->'config','reviewer',actor)) where user_id=proposal.owner_id;
  elsif p->>'decision'='decline' then update myspace_coin_proposals set status='declined',reviewed_at=now() where id=proposal.id;
  else raise exception 'SOCIAL: Choose approve or decline.';end if;
 elsif action='set_friend_rules' then
  other:=(p->>'userId')::uuid;
  select q.* into pair from myspace_best_pairs q join myspace_best_members m on m.pair_id=q.id and m.user_id=actor join myspace_best_members theirs on theirs.pair_id=q.id and theirs.user_id=other where q.id=(p->>'pairId')::uuid and q.ended_at is null and actor<>other;
  if pair.id is null then raise exception 'SOCIAL: You can only edit your current best friend’s coin rules.';end if;
  if not exists(select 1 from eldinos_account_state where user_id=other and revision=(p->>'dataRevision')::bigint) then raise exception 'SOCIAL: Their trackers changed. Reopen their profile.';end if;
  update myspace_coin_controls set starts_on=least(starts_on,(p->>'from')::date),periods=(select coalesce(jsonb_agg(e),'[]') from jsonb_array_elements(periods) e where e->>'from'<p->>'from')||jsonb_build_array(jsonb_build_object('from',p->>'from','config',p->'config','reviewer',actor)),revision=revision+1 where user_id=other and revision=(p->>'expectedRevision')::bigint;
  if not found then raise exception 'SOCIAL: These rules changed. Reopen your friend’s profile.';end if;
  update myspace_coin_proposals set status='superseded' where owner_id=other and status='pending';
  insert into myspace_notifications(id,recipient,actor,kind,source_key,rule_changes) values((p->>'id')::uuid,other,actor,'rules_changed','rules:'||(p->>'id'),p->'changes');
 elsif action='save_avatar' then
  update myspace_profiles set avatar_preset=p->>'avatarId' where user_id=actor;
  if not found then raise exception 'SOCIAL: Open your profile and try again.';end if;
 elsif action='visit' then
  day:=(p->>'day')::date;
  insert into myspace_profiles(user_id,timezone,timezone_locked) values(actor,p->>'timezone',true) on conflict(user_id) do update set timezone=case when myspace_profiles.timezone_locked then myspace_profiles.timezone else excluded.timezone end,timezone_locked=true;
 elsif action='track_streak' then
  day:=(p->>'day')::date;
  update myspace_profiles set last_visit=(p->>'lastTracked')::date,streak=(p->>'streak')::integer,longest=(p->>'longest')::integer where user_id=actor;
  n:=(p->>'streak')::integer;
  if (p->>'trackedToday')::boolean and (n in(7,25,50,100,200,365,500,1000) or (n>1000 and n%100=0)) then
   insert into myspace_notifications(id,recipient,actor,kind,source_key,milestone) select gen_random_uuid(),case when f.a=actor then f.b else f.a end,actor,'streak','streak:'||actor||':'||day||':'||n,n from myspace_friends f where actor in(f.a,f.b) and f.status='accepted' on conflict(recipient,source_key) do nothing;
  end if;
 elsif action='goal_events' then
  insert into myspace_notifications(id,recipient,actor,kind,source_key,rule_changes)
  select gen_random_uuid(),actor,actor,'goal_self','own-goal:'||e.key,jsonb_build_array(e.value) from jsonb_each_text(coalesce(p->'ownGoals','{}'::jsonb)) e on conflict(recipient,source_key) do nothing;
  insert into myspace_notifications(id,recipient,actor,kind,source_key)
  select gen_random_uuid(),case when f.a=actor then f.b else f.a end,actor,'goal','goal:'||actor||':'||e from jsonb_array_elements_text(p->'events') e cross join myspace_friends f where actor in(f.a,f.b) and f.status='accepted' on conflict(recipient,source_key) do nothing;
 elsif action='badge_events' then
  for badge in select value from jsonb_array_elements(p->'badges') loop
   select level into previous_level from myspace_badge_levels where user_id=actor and myspace_badge_levels.badge=badge->>'id';
   if previous_level is null then
    -- Establish a baseline on rollout; do not alert friends about old badges.
    insert into myspace_badge_levels(user_id,badge,level) values(actor,badge->>'id',(badge->>'level')::integer);
   elsif (badge->>'level')::integer>previous_level then
    update myspace_badge_levels set level=(badge->>'level')::integer where user_id=actor and myspace_badge_levels.badge=badge->>'id';
    insert into myspace_notifications(id,recipient,actor,kind,source_key,milestone,rule_changes)
    select gen_random_uuid(),case when f.a=actor then f.b else f.a end,actor,'badge','badge:'||actor||':'||(badge->>'id')||':'||(badge->>'level'),(badge->>'level')::integer,jsonb_build_array(badge->>'name') from myspace_friends f where actor in(f.a,f.b) and f.status='accepted' on conflict(recipient,source_key) do nothing;
   end if;
  end loop;
 elsif action='celebrate' then
  select * into notification from myspace_notifications where id=(p->>'id')::uuid and recipient=actor and kind in('goal','streak') and not celebrated;
  if notification.id is null then raise exception 'SOCIAL: This milestone was already celebrated or is unavailable.';end if;
  other:=notification.actor;
  if not exists(select 1 from myspace_friends where a=least(actor,other) and b=greatest(actor,other) and status='accepted') then raise exception 'SOCIAL: Only current friends can celebrate.';end if;
  if p ? 'giftAmount' then
   if notification.kind<>'goal' then raise exception 'SOCIAL: Coin gifts are for goal achievements.';end if;
   if exists(select 1 from myspace_celebration_coins where sender=actor and recipient=other and week=(p->>'week')::date) then raise exception 'SOCIAL: You already sent this friend a coin gift this week. Send congratulations instead.';end if;
   insert into myspace_celebration_coins(notification_id,sender,recipient,week,amount) values(notification.id,actor,other,(p->>'week')::date,(p->>'giftAmount')::numeric);
  end if;
  update myspace_notifications set celebrated=true,read_at=coalesce(read_at,now()) where id=notification.id;
  insert into myspace_notifications(id,recipient,actor,kind,source_key,milestone,gift_amount) values((p->>'newId')::uuid,other,actor,'celebration','celebration:'||notification.id,notification.milestone,coalesce((p->>'giftAmount')::numeric,0)) on conflict(recipient,source_key) do nothing;
 elsif action='notifications_read' then
  update myspace_notifications set read_at=now() where recipient=actor and read_at is null;
 else raise exception 'SOCIAL: Unknown action.';
 end if;
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function myspace_social_action(uuid,text,jsonb) from public;
