-- 0005: create a profile whenever a Supabase Auth user is created
-- Requires: 0002. auth.users remains the identity source; no password data is copied.
--
-- Failure policy: a problem creating the profile must not block sign-up, so errors are
-- logged as a WARNING and the user is still created. A missing profile is recoverable
-- (re-run the backfill below, or create it server-side in Part 02B).

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text;
  v_avatar text;
begin
  v_name := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 200), '');
  v_avatar := new.raw_user_meta_data ->> 'avatar_url';
  if v_avatar is null or v_avatar !~ '^https://' or char_length(v_avatar) > 2048 then
    v_avatar := null;
  end if;

  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, v_name, v_avatar)
  on conflict (id) do nothing;

  return new;
exception
  when others then
    raise warning 'handle_new_user failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Idempotent backfill for users who signed up before this migration.
insert into public.profiles (id, full_name, avatar_url)
select
  u.id,
  nullif(left(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), 200), ''),
  case
    when (u.raw_user_meta_data ->> 'avatar_url') ~ '^https://'
     and char_length(u.raw_user_meta_data ->> 'avatar_url') <= 2048
    then u.raw_user_meta_data ->> 'avatar_url'
  end
from auth.users u
on conflict (id) do nothing;
