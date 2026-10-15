-- OPTIONAL, EXPLICIT PRIVATE -> PUBLIC COPY.
-- Run AFTER schema.sql and BEFORE opening the updated app.
-- WARNING: This publishes the chosen owner's entire Eldly dataset (Checkly,
-- Trackly, Progress history, and Packly). Anyone can then read/change/delete it.
-- Replace the UUID below with the previous Supabase Auth user's ID.
-- Existing private records are NEVER deleted or modified. If shared data already
-- exists, this script aborts instead of replacing anything.
begin;
do $$
declare owner_id uuid := 'REPLACE-WITH-YOUR-PREVIOUS-USER-UUID';
        entries jsonb;
begin
 select jsonb_agg(jsonb_build_object('record_key',record_key,'value',value,'deleted',deleted))
 into entries from public.eldly_records where user_id=owner_id;
 if entries is null then raise exception 'No private records for this user. Nothing changed.'; end if;
 if not public.eldly_shared_initialize(entries) then
  raise exception 'Shared checklist already exists. Nothing was overwritten.';
 end if;
end $$;
commit;
