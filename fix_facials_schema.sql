-- Fix for Agent Heartbeat Error
-- Run this in Supabase SQL Editor

-- Add columns required for device status monitoring
ALTER TABLE public.facials ADD COLUMN IF NOT EXISTS status text DEFAULT 'offline';
ALTER TABLE public.facials ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone;
ALTER TABLE public.facials ADD COLUMN IF NOT EXISTS latency_ms integer;
ALTER TABLE public.facials ADD COLUMN IF NOT EXISTS ip text; -- Ensure IP column exists
