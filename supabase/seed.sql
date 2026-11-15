-- LOCAL DEVELOPMENT ONLY.
--
-- The Supabase CLI runs this file after the migrations on `npx supabase start` / `npx supabase db reset`.
-- `npx supabase db push` never sends it to the cloud project.
--
-- Creates one researcher account for local testing, so the researcher pages run through the same
-- login and access rules as the cloud project:
--   email     researcher@starlab.test
--   password  starlab-local
-- Never create this account in the cloud project.

do $$
declare
  local_id constant uuid := '5d1e7c3a-0b4f-4e8a-9c2d-7a6b5e4f3d21';
  local_email constant text := 'researcher@starlab.test';
begin
  if not exists (select 1 from auth.users where id = local_id) then
    -- The empty strings matter: Supabase Auth cannot read these token columns when they are null.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', local_id, 'authenticated', 'authenticated', local_email,
      extensions.crypt('starlab-local', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), local_id, local_id::text,
      jsonb_build_object('sub', local_id::text, 'email', local_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;
  insert into public.researchers (user_id, email) values (local_id, local_email) on conflict (user_id) do nothing;
end $$;
