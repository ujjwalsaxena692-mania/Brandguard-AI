-- Profiles already created are kept.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists private.handle_new_user();
