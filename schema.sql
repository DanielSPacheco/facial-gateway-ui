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
with check (true);
