"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Zap, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type AgentStatus = 'online' | 'unstable' | 'offline' | 'loading';

interface JobInfo {
    desc: string;
    time: string;
}

export function AgentStatusCard() {
    const [status, setStatus] = useState<AgentStatus>('loading');
    const [lastChecked, setLastChecked] = useState<string | null>(null);
    const [deviceIp, setDeviceIp] = useState<string | null>(null);
    const [latency, setLatency] = useState<number | null>(null);
    const [lastAction, setLastAction] = useState<JobInfo | null>(null);
    const [lastError, setLastError] = useState<JobInfo | null>(null);

    const [config, setConfig] = useState<{ enabled: boolean; interval: number }>({ enabled: true, interval: 5 });

    // Fetch latest job info (action or error)
    const fetchJobHistory = useCallback(async (siteId: string) => {
        // Last success
        const { data: successJobs } = await supabase
            .from("jobs")
            .select("type, processed_at")
            .eq("status", "completed")
            .order("processed_at", { ascending: false })
            .limit(1);

        if (successJobs && successJobs.length > 0) {
            setLastAction({
                desc: successJobs[0].type.replace(/_/g, " "),
                time: new Date(successJobs[0].processed_at).toLocaleTimeString()
            });
        }

        // Last error
        const { data: failedJobs } = await supabase
            .from("jobs")
            .select("type, processed_at, error")
            .eq("status", "failed")
            .order("processed_at", { ascending: false })
            .limit(1);

        if (failedJobs && failedJobs.length > 0) {
            setLastError({
                desc: failedJobs[0].type.replace(/_/g, " "),
                time: new Date(failedJobs[0].processed_at).toLocaleTimeString()
            });
        }
    }, []);

    const checkDeviceStatus = useCallback(async () => {
        try {
            const { siteId } = await getSiteContext();

            // Refresh job history
            fetchJobHistory(siteId);

            // 1. Get Device Info & Config
            let targetIp = deviceIp;
            let currentConfig = config;

            const { data: facials, error: facialError } = await supabase
                .from("facials")
                .select("ip, keep_alive_enabled, probing_interval")
                .eq("site_id", siteId)
                .limit(1)
                .single();

            if (facials) {
                targetIp = facials.ip;
                setDeviceIp(facials.ip);
                currentConfig = {
                    enabled: facials.keep_alive_enabled ?? true,
                    interval: facials.probing_interval ?? 5
                };
                setConfig(currentConfig);
            } else {
                targetIp = process.env.NEXT_PUBLIC_DEVICE_IP || null;
            }

            if (!targetIp) {
                setStatus('offline');
                return { nextDelay: 10000 };
            }

            // Check if Monitoring is Disabled
            if (!currentConfig.enabled) {
                setStatus('loading'); // Reuse loading or add 'disabled' status
                return { nextDelay: 10000 }; // Check again in 10s if config changed
            }

            // 2. Ping with Latency Measurement
            const start = performance.now();
            const res = await fetch(`/api/device/ping?ip=${targetIp}`);
            const end = performance.now();
            const currentLatency = Math.round(end - start);

            setLatency(currentLatency);
            setLastChecked(new Date().toISOString());

            if (res.ok) {
                // If latency > 300ms, mark as unstable
                if (currentLatency > 300) {
                    setStatus('unstable');
                } else {
                    setStatus('online');
                }
            } else {
                setStatus('offline');
            }

            return { nextDelay: currentConfig.interval * 60 * 1000 };

        } catch (e) {
            console.error("Ping failed:", e);
            setStatus('offline');
            return { nextDelay: 10000 };
        }
    }, [deviceIp, config, fetchJobHistory]); // Dependencies might cause re-creation, be careful with loop

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        let isMounted = true;

        const loop = async () => {
            if (!isMounted) return;
            const result = await checkDeviceStatus();
            if (isMounted && result) {
                const delay = result.nextDelay < 5000 ? 5000 : result.nextDelay; // Minimum 5s safety
                timeoutId = setTimeout(loop, delay);
            }
        };

        loop();

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, []); // Run on mount only, internal loop handles logic

    // Helpers for UI
    const getStatusColor = () => {
        if (!config.enabled) return "text-gray-400";
        switch (status) {
            case 'online': return "text-emerald-500";
            case 'unstable': return "text-yellow-500";
            case 'offline': return "text-red-500";
            default: return "text-gray-500";
        }
    };

    const getStatusBg = () => {
        if (!config.enabled) return "bg-gray-400";
        switch (status) {
            case 'online': return "bg-emerald-500";
            case 'unstable': return "bg-yellow-500";
            case 'offline': return "bg-red-500";
            default: return "bg-gray-500";
        }
    };

    const getStatusText = () => {
        if (!config.enabled) return "Monitoramento Pausado";
        switch (status) {
            case 'online': return "Online";
            case 'unstable': return "Instável";
            case 'offline': return "Offline";
            default: return "Verificando...";
        }
    };

    return (
        <Card className={`border-l-4 bg-card/50 ${config.enabled ? (status === 'online' ? 'border-l-emerald-500' : status === 'unstable' ? 'border-l-yellow-500' : status === 'offline' ? 'border-l-red-500' : 'border-l-gray-500') : 'border-l-gray-300'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Device Status</CardTitle>
                <div suppressHydrationWarning>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent>
                {/* Main Status Line */}
                <div className="flex items-center gap-2 mb-4">
                    <div className={`h-3 w-3 rounded-full ${getStatusBg()} ${config.enabled && (status === 'online' || status === 'unstable') ? 'animate-pulse' : ''} shadow-[0_0_8px_rgba(0,0,0,0.2)]`} />
                    <span className={`text-2xl font-bold ${getStatusColor()}`}>
                        {getStatusText()}
                    </span>
                </div>

                {/* Metrics Grid */}
                <div className="grid gap-2 text-xs">
                    {/* Monitor Info */}
                    {!config.enabled && (
                        <div className="text-muted-foreground italic mb-2">
                            O monitoramento contínuo está desativado. Ative nas configurações do dispositivo.
                        </div>
                    )}

                    {/* Latency */}
                    {config.enabled && (
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Latência</span>
                            <span className="font-mono">{latency !== null ? `${latency}ms` : '--'}</span>
                        </div>
                    )}

                    {/* Last Action (Show if Online/Unstable) */}
                    {(status === 'online' || status === 'unstable' || status === 'loading') && config.enabled && (
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Última Ação</span>
                            <span className="truncate max-w-[120px]" title={lastAction?.desc}>
                                {lastAction ? `${lastAction.desc} (${lastAction.time})` : '--'}
                            </span>
                        </div>
                    )}

                    {/* Last Error (Show if Offline or Unstable) */}
                    {(status === 'offline' || status === 'unstable') && config.enabled && (
                        <div className="flex items-center justify-between text-red-400">
                            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Último Erro</span>
                            <span className="truncate max-w-[120px]" title={lastError?.desc}>
                                {lastError ? `${lastError.desc} (${lastError.time})` : '--'}
                            </span>
                        </div>
                    )}

                    {/* IP Info */}
                    <div className="pt-2 border-t border-white/5 mt-1 flex justify-between text-[10px] text-muted-foreground">
                        <span>{deviceIp || "Searching..."}</span>
                        <span>{lastChecked ? new Date(lastChecked).toLocaleTimeString() : ""}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
