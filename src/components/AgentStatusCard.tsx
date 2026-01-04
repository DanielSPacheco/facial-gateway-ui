"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, WifiOff, Activity } from "lucide-react";

export function AgentStatusCard() {
    const [status, setStatus] = useState<'online' | 'offline' | 'loading'>('loading');
    const [lastChecked, setLastChecked] = useState<string | null>(null);
    const [deviceIp, setDeviceIp] = useState<string | null>(null);

    const checkDeviceStatus = async () => {
        try {
            const { siteId } = await getSiteContext();

            // 1. Get Device IP (Prioritize DB Facials, fallback to Env)
            // For this demo, we'll try to find the first facial device
            let targetIp = deviceIp;

            if (!targetIp) {
                const { data: facials } = await supabase
                    .from("facials")
                    .select("ip")
                    .eq("site_id", siteId)
                    .limit(1)
                    .single();

                // Fallback to Env if no DB record or empty
                targetIp = facials?.ip || process.env.NEXT_PUBLIC_DEVICE_IP || null;
                if (targetIp) setDeviceIp(targetIp);
            }

            if (!targetIp) {
                // If no IP found, fallback to "Agent" status from DB only
                const { data: agent } = await supabase
                    .from("agents")
                    .select("status")
                    .eq("site_id", siteId)
                    .single();
                setStatus(agent?.status as 'online' | 'offline' || 'offline');
                return;
            }

            // 2. Ping the Device via our API
            const res = await fetch(`/api/device/ping?ip=${targetIp}`);
            if (res.ok) {
                setStatus('online');
                setLastChecked(new Date().toISOString());
            } else {
                setStatus('offline');
            }

        } catch (e) {
            console.error("Ping failed:", e);
            setStatus('offline');
        }
    };

    useEffect(() => {
        checkDeviceStatus();
        const interval = setInterval(checkDeviceStatus, 5000); // Check every 5s (KeepAlive)
        return () => clearInterval(interval);
    }, [deviceIp]);

    return (
        <Card className="border-l-4 border-l-primary bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Device Status (KeepAlive)</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-2">
                    {status === 'loading' ? (
                        <div className="h-3 w-3 bg-gray-500 rounded-full animate-pulse" />
                    ) : status === 'online' ? (
                        <div className="h-3 w-3 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                    ) : (
                        <div className="h-3 w-3 bg-red-500 rounded-full" />
                    )}
                    <span className="text-2xl font-bold capitalize">
                        {status === 'loading' ? '--' : status}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    {deviceIp ? `Pinging ${deviceIp}` : "Checking Agent Status..."}
                </p>
                {lastChecked && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                        Last ping: {new Date(lastChecked).toLocaleTimeString()}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
