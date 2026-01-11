"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, CheckCircle2, AlertTriangle, Lock, Unlock, User, Activity, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface AccessEvent {
    id: string;
    event_type: string;
    occurred_at: string;
    device_name: string;
    person_name?: string;
    snapshot_url?: string;
    source: string;
}

export function DashboardHistory() {
    const [events, setEvents] = useState<AccessEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const fetchHistory = useCallback(async () => {
        try {
            const { siteId } = await getSiteContext();

            // Try fetching from the view first (Enterprise feature)
            const { data, error } = await supabase
                .from("v_access_events_with_media")
                .select("*")
                .eq("site_id", siteId)
                .order("occurred_at", { ascending: false })
                .limit(10);

            if (error) {
                // Fallback to searching jobs if view doesn't exist yet (migration pending)
                console.warn("View not found, falling back might be needed", error);
            } else if (data) {
                setEvents(data);
            }
        } catch (e) {
            console.error("Failed to fetch history:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
        // Subscribe to real-time events
        const channel = supabase
            .channel('access_events_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'access_events' }, () => {
                fetchHistory();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchHistory]);

    const formatEvent = (type: string) => {
        switch (type) {
            case 'open_door_remote': return "Abertura Remota";
            case 'access_granted': return "Acesso Permitido";
            case 'access_denied': return "Acesso Negado";
            default: return type.replace(/_/g, " ");
        }
    };

    const formatTime = (isoString: string) => {
        if (!isoString) return "--:--";
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <Card className="col-span-1 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Timeline de Acesso
                </CardTitle>
                <Badge variant="outline" className="text-xs font-normal">Ao Vivo</Badge>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {loading && events.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Carregando eventos...</p>
                    ) : events.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum evento registrado hoje.</p>
                    ) : (
                        events.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-3 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
                                        <Unlock className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-900 dark:text-slate-100">
                                            {formatEvent(item.event_type)}
                                        </span>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{item.device_name || 'Dispositivo Desconhecido'}</span>
                                            {item.person_name && (
                                                <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                                    • {item.person_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {item.snapshot_url && (
                                        <button
                                            onClick={() => setSelectedImage(item.snapshot_url || null)}
                                            className="group relative h-8 w-12 overflow-hidden rounded border bg-slate-100 dark:bg-slate-800 hover:ring-2 hover:ring-offset-2 ring-blue-500 transition-all"
                                        >
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Camera className="h-3 w-3 text-white" />
                                            </div>
                                            {/* Generic placeholder logic if simple URL */}
                                            <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${item.snapshot_url})` }} />
                                        </button>
                                    )}
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {formatTime(item.occurred_at)}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>

            <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
                <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-black border-slate-800">
                    <DialogHeader className="p-4 absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent z-10">
                        <DialogTitle className="text-white text-sm">Registro Visual</DialogTitle>
                    </DialogHeader>
                    {selectedImage && (
                        <img
                            src={selectedImage}
                            alt="Snapshot"
                            className="w-full h-auto object-contain max-h-[80vh]"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}
