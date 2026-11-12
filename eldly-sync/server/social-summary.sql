create table if not exists public.myspace_social_summaries (
  user_id uuid not null references public.myspace_users(id) on delete cascade,
  kind text not null,
  source_version text not null,
  summary jsonb not null,
  primary key (user_id, kind)
);
revoke all on public.myspace_social_summaries from public;

-- Build a snapshot only on cache misses. Revisions include deleted records.
create or replace function public.myspace_social_summary(account uuid, projection text, as_of text)
returns table(source_version text, hit boolean, summary jsonb, records jsonb, policy jsonb, owner boolean)
language sql stable set search_path='' as $$
  with relevant as materialized (
    select r.record_key, r.value, r.deleted, r.revision
    from public.eldinos_account_records r
    cross join lateral (select r.record_key::jsonb as key) path
    where r.user_id=account and (
      path.key->>0 is null or (
        path.key->>0='checkly-data-v1' and (
          path.key->>1 is null or
          case projection
            when 'ranking' then path.key->>1='goalPlans' or (
              path.key->>1='mapping' and (
                path.key->>2 is distinct from 'entries' or path.key->>3 is null or
                path.key->>3 between date_trunc('week', nullif(as_of,'')::date::timestamp)::date::text and as_of
              )
            )
            when 'milestones' then path.key->>1 in ('mapping','goalPlans','coinBonusPlans','rewardPurchases')
            when 'rules' then path.key->>1 in ('goalPlans','coinBonusPlans') or (
              path.key->>1='mapping' and path.key->>2 is distinct from 'entries'
            )
            when 'gift' then path.key->>1 in ('rewards','rewardPurchases','mainRewardId')
          end
        )
      )
    )
  ), inputs as (
    select concat_ws(':', '1', as_of, coalesce(max(relevant.revision),0), count(relevant.record_key),
        coalesce(c.revision,-1), coalesce(u.app_metadata->'legacy_owner','false'::jsonb),
        case when projection='milestones' then (
          select md5(string_agg(f.id::text,',' order by f.id))
          from public.myspace_friends f where u.id in (f.a,f.b) and f.status='accepted'
        ) end) as version,
      case when c.user_id is not null then jsonb_build_object(
        'starts_on',c.starts_on,'legacy',c.legacy,'periods',c.periods,'revision',c.revision
      ) end as coin_policy,
      u.app_metadata->'legacy_owner'='true'::jsonb as is_owner
    from public.myspace_users u
    left join public.myspace_coin_controls c on c.user_id=u.id and projection in ('ranking','milestones')
    left join relevant on true
    where u.id=account
    group by u.id,c.user_id
  )
  select inputs.version, s.user_id is not null, s.summary,
    case when s.user_id is null then coalesce((
      select jsonb_agg(jsonb_build_object('record_key', record_key, 'value', value) order by record_key)
      from relevant where not deleted
    ),'[]'::jsonb) end,
    case when s.user_id is null then inputs.coin_policy end,
    inputs.is_owner
  from inputs
  left join public.myspace_social_summaries s
    on s.user_id=account and s.kind=projection and s.source_version=inputs.version;
$$;
revoke all on function public.myspace_social_summary(uuid,text,text) from public;
