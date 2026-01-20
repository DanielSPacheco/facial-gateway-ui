"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Server, HardDrive, Wifi, WifiOff, Plus } from "lucide-react";
import { DeviceConfigDialog } from "@/components/DeviceConfigDialog";

interface Agent {
    id: string;
    name: string;
    status: string; // 'online' | 'offline'
    last_seen_at: string;
}

interface Facial {
    id: string;
    name: string;
    ip: string;
    channel: number;
    keep_alive_enabled: boolean;
    probing_interval: number;
    protocol?: string;
    port?: number;
    username?: string;
    password?: string;
}

export default function DevicesPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [facials, setFacials] = useState<Facial[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { siteId } = await getSiteContext();

            // Fetch Agents
            const { data: agentsData } = await supabase
                .from("agents")
                .select("*")
                .eq("site_id", siteId);

            if (agentsData) setAgents(agentsData);

            // Fetch Facials
            const { data: facialsData } = await supabase
                .from("facials")
                .select("*")
                .eq("site_id", siteId);

            if (facialsData) setFacials(facialsData);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Optional: Poll every 10s to update status
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Equipamentos</h1>
                    <p className="text-muted-foreground">Gerencie os controladores de acesso e agentes.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <DeviceConfigDialog
                        onUpdate={fetchData}
                        trigger={
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Dispositivo
                            </Button>
                        }
                        device={null}
                    />
                    <Button variant="outline" size="icon" onClick={fetchData}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Agents Section */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                    <Card key={agent.id} className="border-l-4 border-l-primary bg-card/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Agente Local</CardTitle>
                            {agent.status === 'online' ? (
                                <Wifi className="h-4 w-4 text-green-500" />
                            ) : (
                                <WifiOff className="h-4 w-4 text-red-500" />
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{agent.name}</div>
                            <p className="text-xs text-muted-foreground pt-1">
                                {agent.status === 'online' ? (
                                    <span className="text-green-500 font-medium">Online</span>
                                ) : (
                                    <span className="text-red-500 font-medium">Offline</span>
                                )}
                                • Último visto: {agent.last_seen_at ? new Date(agent.last_seen_at).toLocaleTimeString() : 'N/A'}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Facials List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HardDrive className="h-5 w-5" />
                        Controladores Faciais
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {facials.length === 0 && <p className="text-sm text-muted-foreground">Nenhum dispositivo encontrado.</p>}

                        {facials.map((facial) => (
                            <div key={facial.id} className="flex items-center justify-between p-4 border rounded-lg bg-background/50">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <HardDrive className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">{facial.name}</p>
                                        <p className="text-sm text-muted-foreground">{facial.ip} • Canal {facial.channel}</p>
                                    </div>
                                </div>
                                <div
                                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors"
                                    onClick={() => window.location.href = `/devices/${facial.id}`}
                                >
                                    <Badge variant="outline" className="border-green-500/50 text-green-500">
                                        Ativo
                                    </Badge>
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <DeviceConfigDialog
                                            device={facial}
                                            onUpdate={fetchData}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div >
    );
}
