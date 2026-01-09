-- Create Access Rules table for User-Device permissions
create table if not exists public.access_rules (
    id uuid default gen_random_uuid() primary key,
    site_id uuid not null,
    user_id uuid references public.users(id) on delete cascade not null,
    facial_id uuid references public.facials(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    unique(user_id, facial_id)
);

-- RLS
alter table public.access_rules enable row level security;

create policy "Allow all access to access_rules for authenticated users"
on public.access_rules for all
to authenticated
using (true);
