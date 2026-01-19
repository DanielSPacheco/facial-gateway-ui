"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Zap, Server, ShieldCheck } from "lucide-react";

interface FacialStatus {
    id: string;
    name: string;
    status: 'online' | 'offline' | 'unknown';
    latency_ms: number | null;
    last_seen_at: string | null;
    ip: string;
    location_description?: string;
}

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, DoorOpen, Loader2 } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

function LiveSnapshotPreview({ deviceId, channel = 1 }: { deviceId: string; channel?: number }) {
    const [timestamp, setTimestamp] = useState(Date.now());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const refreshImage = () => {
        // Schedule next update only after current one finishes (or fails)
        setTimeout(() => {
            setTimestamp(Date.now());
            setLoading(true);
        }, 800);
    };

    return (
        <div className="relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-inner flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                key={timestamp} // Force re-mount to ensure clean request
                src={`http://127.0.0.1:4000/facial/${deviceId}/snapshot?channel=${channel}&t=${timestamp}`}
                alt="Live Preview"
                className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}
                onLoad={() => {
                    setLoading(false);
                    setError(false);
                    refreshImage();
                }}
                onError={() => {
                    setLoading(false);
                    setError(true);
                    refreshImage(); // Retry even on error
                }}
            />

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
                    <span className="text-xs text-red-400 font-medium bg-black/80 px-2 py-1 rounded">Falha na conexão</span>
                </div>
            )}

            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 backdrop-blur-sm pointer-events-none z-10">
                <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-zinc-500' : 'bg-red-500 animate-pulse'}`} />
                AO VIVO
            </div>
        </div>
    );
}

export function DeviceStatusGrid({ lastRefreshed }: { lastRefreshed?: Date }) {
    const [devices, setDevices] = useState<FacialStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [deviceToOpen, setDeviceToOpen] = useState<FacialStatus | null>(null);

    const fetchData = async () => {
        try {
            const { siteId } = await getSiteContext();
            const { data } = await supabase
                .from("facials")
                .select("id, name, status, latency_ms, last_seen_at, ip, location_description")
                .eq("site_id", siteId)
                .order("name");

            if (data) setDevices(data as any);
        } catch (e) {
            console.error("Error fetching devices", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const channel = supabase
            .channel('facials-status')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'facials' }, (payload) => {
                setDevices(prev => prev.map(d => d.id === payload.new.id ? { ...d, ...payload.new } : d));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [lastRefreshed]);

    const handleOpenDoorClick = (device: FacialStatus) => {
        if (device.status !== 'online') {
            toast.error("Dispositivo offline. Não é possível abrir a porta.");
            return;
        }
        setDeviceToOpen(device);
    };

    const confirmOpenDoor = async () => {
        if (!deviceToOpen) return;

        const device = deviceToOpen;
        setActionLoading(device.id);
        setDeviceToOpen(null); // Close dialog immediately

        try {
            const { siteId, clientId } = await getSiteContext();

            // Get current user email for audit
            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = user?.email || "unknown";

            const { error } = await supabase.from("jobs").insert({
                site_id: siteId,
                client_id: clientId,
                type: "open_door",
                facial_id: device.id,
                payload: {
                    facial_id: device.id,
                    device_id: device.id, // Redundancy for agent/logs
                    door_index: 1,
                    triggered_by: userEmail
                },
                status: "pending"
            });

            if (error) throw error;
            toast.success("Comando enviado com sucesso.");
        } catch (e: any) {
            console.error("Failed to queue open door job", e);
            toast.error("Erro ao enviar comando: " + e.message);
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="text-sm text-muted-foreground animate-pulse">Loading devices...</div>;

    if (devices.length === 0) return (
        <Card className="border-dashed bg-card/50">
            <CardContent className="pt-6 text-center text-muted-foreground text-sm">
                No devices configured.
            </CardContent>
        </Card>
    );

    return (
        <>
            <div className="flex flex-col gap-4">
                {devices.map(device => (
                    <Card key={device.id} className={`border-l-4 bg-card/50 ${device.status === 'online' ? 'border-l-emerald-500' : 'border-l-red-500'
                        }`}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div className="flex flex-col">
                                <CardTitle className="text-lg font-medium truncate" title={device.name}>
                                    {device.name}
                                </CardTitle>
                                {device.location_description && (
                                    <span className="text-xs text-muted-foreground mt-0.5">
                                        {device.location_description}
                                    </span>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={`h-2.5 w-2.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                                        }`} />
                                    <span className={`text-sm font-bold capitalize ${device.status === 'online' ? 'text-emerald-500' : 'text-red-500'
                                        }`}>
                                        {device.status || 'unknown'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Stats */}
                                <div className="text-right text-xs text-muted-foreground hidden sm:block">
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="font-mono">{device.latency_ms ? `${device.latency_ms}ms` : '--'}</span>
                                        <Zap className="h-3 w-3" />
                                    </div>
                                    <div className="mt-1">
                                        {device.ip}
                                    </div>
                                </div>

                                {/* Action Button */}
                                <Button
                                    onClick={() => handleOpenDoorClick(device)}
                                    disabled={device.status !== 'online' || actionLoading === device.id}
                                    variant={device.status === 'online' ? "default" : "secondary"}
                                    className={device.status === 'online' ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                                >
                                    {actionLoading === device.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <DoorOpen className="h-4 w-4 mr-2" />
                                    )}
                                    Abrir Porta
                                </Button>
                            </div>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            <Dialog open={!!deviceToOpen} onOpenChange={(open) => !open && setDeviceToOpen(null)}>
                <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-500">
                            <DoorOpen className="h-5 w-5" />
                            Confirmar Abertura
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 pt-2">
                            Você está prestes a abrir a porta do dispositivo:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col items-center justify-center gap-4 py-4">
                        <span className="font-bold text-lg text-white block">{deviceToOpen?.name}</span>
                        {deviceToOpen?.location_description && (
                            <span className="text-sm text-zinc-500 block -mt-2">
                                {deviceToOpen.location_description}
                            </span>
                        )}

                        {/* Live Snapshot Preview */}
                        {deviceToOpen && (
                            <LiveSnapshotPreview deviceId={deviceToOpen.id} />
                        )}
                    </div>

                    <DialogFooter className="gap-2 mt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setDeviceToOpen(null)}
                            className="text-zinc-400 hover:text-white hover:bg-zinc-900"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={confirmOpenDoor}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold w-full sm:w-auto"
                        >
                            <Lock className="mr-2 h-4 w-4" />
                            Confirmar e Abrir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
