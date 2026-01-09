-- Add last_seen_at to facials for status tracking
alter table public.facials add column if not exists last_seen_at timestamp with time zone;

-- Grant permissions if needed (usually handled by RLS but explicit grant helps if using service role)
-- grant update on public.facials to authenticated;
