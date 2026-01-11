-- Enterprise Schema Update
-- Run this in Supabase SQL Editor

-- 1. Add facial_id to jobs for strict isolation
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS facial_id uuid REFERENCES public.facials(id);

-- 2. Create Access Events (Rich Logs)
CREATE TABLE IF NOT EXISTS public.access_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id uuid NOT NULL,
    facial_id uuid REFERENCES public.facials(id),
    person_id uuid REFERENCES public.users(id), -- Nullable (unknown user)
    event_type text NOT NULL, -- e.g. "open_door", "access_granted", "access_denied"
    source text DEFAULT 'device', -- 'device' or 'app' or 'agent'
    occurred_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    meta jsonb
);

-- 3. Create Event Media (Snapshots)
CREATE TABLE IF NOT EXISTS public.event_media (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid REFERENCES public.access_events(id) ON DELETE CASCADE,
    storage_path text NOT NULL, -- path in 'access-snapshots' bucket
    public_url text, -- optional cached public url
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS
ALTER TABLE public.access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;

-- 5. Policies (Simple read/write for auth)
CREATE POLICY "Allow read access_events for authenticated" ON public.access_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert access_events for authenticated" ON public.access_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow read event_media for authenticated" ON public.event_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert event_media for authenticated" ON public.event_media FOR INSERT TO authenticated WITH CHECK (true);

-- 6. Create View for UI (Joins events with media & names)
CREATE OR REPLACE VIEW v_access_events_with_media AS
SELECT 
    e.id,
    e.site_id,
    e.facial_id,
    f.name as device_name,
    e.event_type,
    e.occurred_at,
    e.source,
    u.name as person_name,
    m.public_url as snapshot_url
FROM public.access_events e
LEFT JOIN public.facials f ON e.facial_id = f.id
LEFT JOIN public.users u ON e.person_id = u.id
LEFT JOIN public.event_media m ON m.event_id = e.id
ORDER BY e.occurred_at DESC;
