"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HardDrive, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { DeviceLogsCard } from "@/components/DeviceLogsCard";

interface Facial {
    id: string;
    name: string;
    ip: string;
    channel: number;
    status?: string;
    last_seen_at?: string;
}

export default function DeviceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [device, setDevice] = useState<Facial | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDevice = async () => {
            try {
                const { data, error } = await supabase
                    .from("facials")
                    .select("*")
                    .eq("id", id)
                    .single();

                if (data) setDevice(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchDevice();
    }, [id]);

    if (loading) return <div>Carregando...</div>;
    if (!device) return <div>Dispositivo não encontrado.</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">{device.name}</h1>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Info Card */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Informações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <HardDrive className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold">{device.name}</p>
                                <p className="text-sm text-muted-foreground">{device.ip}</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">ID:</span>
                                <span className="font-mono text-xs">{device.id}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Canal:</span>
                                <span>{device.channel}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Status:</span>
                                {device.status === 'online' ? (
                                    <Badge variant="outline" className="text-green-500 border-green-500/50">Online</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-red-500 border-red-500/50">Offline</Badge>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Action / Logs Area */}
                <div className="md:col-span-2 space-y-6">
                    <DeviceLogsCard deviceId={device.id} deviceIp={device.ip} />
                </div>
            </div>
        </div>
    );
}
