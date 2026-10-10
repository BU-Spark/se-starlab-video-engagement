-- Smoke-test table: one row per button click sent from the frontend.
create table public.button_clicks (
  id bigint generated always as identity primary key,
  -- When the click happened, according to the device's clock.
  clicked_at timestamptz not null,
  -- When the row reached the database.
  created_at timestamptz not null default now()
);

-- No policies: only the backend (secret key) can read or write.
alter table public.button_clicks enable row level security;
