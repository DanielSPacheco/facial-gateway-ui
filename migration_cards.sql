-- Create Cards table for Multi-Card Support
create table if not exists public.cards (
    id uuid default gen_random_uuid() primary key,
    site_id uuid not null,
    user_id uuid references public.users(id) on delete cascade not null,
    card_number text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    unique(site_id, card_number)
);

-- RLS
alter table public.cards enable row level security;

create policy "Allow all access to cards for authenticated users"
on public.cards for all
to authenticated
using (true);

-- Optional: Migrate old data (if you want to keep data from the single column)
-- insert into public.cards (site_id, user_id, card_number)
-- select client_id, id, card_no from public.users where card_no is not null;
