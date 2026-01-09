-- Run this in Supabase SQL Editor to update the table structure

-- 1. Create Users table (Residents/Employees on the device)
create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  user_id text not null unique, -- e.g. "888" from the device
  name text not null,
  authority int default 2, -- 2=User, 1=Admin
  card_no text, -- Optional card number storage for UI convenience
  client_id uuid not null, -- Links to clients table (Multi-tenant support)
  
  -- Resident Organization Fields (New)
  block text, -- e.g "Bloco 1"
  apartment text, -- e.g "101"

  -- Role Based Access Control (New)
  email text unique, -- Login email (links to auth.users if needed)
  role text default 'resident' check (role in ('admin', 'operator', 'integrator', 'resident')),
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Jobs table (Already exists in your DB, listed here for reference)
-- create table if not exists public.jobs (
--   id uuid default gen_random_uuid() primary key,
--   site_id uuid not null,
--   client_id uuid not null,
--   agent_id uuid,
--   type text not null,
--   payload jsonb,
--   status text default 'pending',
--   result jsonb,
--   created_at timestamp with time zone default timezone('utc'::text, now()) not null,
--   updated_at timestamp with time zone default timezone('utc'::text, now()) not null
-- );

-- 3. Enable RLS (Row Level Security)
alter table public.users enable row level security;

-- 4. Create policies
create policy "Allow all access to users for authenticated users"
on public.users for all
to authenticated
using (true)

-- 5. Update Facials table (Add Keep Alive Config)
alter table public.facials add column if not exists keep_alive_enabled boolean default true;
alter table public.facials add column if not exists probing_interval integer default 5; -- In minutes

-- 9. Update Facials table (Multi-Device Support) - Metadata Only
alter table public.facials add column if not exists protocol text default 'isapi'; -- isapi, rpc, http
alter table public.facials add column if not exists port integer default 80;
alter table public.facials add column if not exists location_description text;
alter table public.facials add column if not exists channel integer default 1; -- door index

-- OLD MIGRATION (Deprecated by Secure Approach):
-- alter table public.facials add column if not exists username text;
-- alter table public.facials add column if not exists password text;

-- 10. Secure Secrets Table (Backend Only Access)
create table if not exists public.facial_secrets (
    facial_id uuid references public.facials(id) on delete cascade primary key,
    username text,
    password text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on secrets
alter table public.facial_secrets enable row level security;

-- Policy: DENY ALL for anon/authenticated (SERVICE ROLE ONLY)
-- No create policy -> default deny.
-- No select policy -> default deny.
-- Only Service Role can access.

-- Migration helper: If you already ran step 9 with username/password, move data:
-- insert into public.facial_secrets (facial_id, username, password)
-- select id, username, password from public.facials
-- where username is not null
-- on conflict do nothing;

-- Then drop columns from facials to be safe:
-- alter table public.facials drop column username;
-- alter table public.facials drop column password;

-- 6. Create Units table (For managing Blocks/Apartments)
create table if not exists public.units (
  id uuid default gen_random_uuid() primary key,
  site_id uuid not null, -- To filter by site
  block text not null, -- e.g. "Bloco 1"
  name text not null, -- e.g. "101"
  responsible_id uuid, -- Link to public.users(id)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(site_id, block, name) -- Prevent duplicates
);

-- 7. Add RLS for Units
alter table public.units enable row level security;

create policy "Allow all access to units for authenticated users"
on public.units for all
to authenticated
using (true);

-- 8. Fix Foreign Key (REQUIRED for Joins)
-- Run this if you are getting "Failed to load units" or join errors
alter table public.units 
add constraint units_responsible_id_fkey 
foreign key (responsible_id) 
references public.users(id)
on delete set null;
