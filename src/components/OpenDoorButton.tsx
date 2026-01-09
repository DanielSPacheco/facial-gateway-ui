"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Loader2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Device {
    id: string;
    name: string;
    channel: number;
    location_description?: string;
    last_seen_at?: string;
}

export function OpenDoorButton({ channel = 1, specificDevice }: { channel?: number; specificDevice?: { id: string; name: string; channel: number } }) {
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    // We don't really use siteName for logic, but fine to keep if needed or remove.
    // Keeping minimal state.
    const [devices, setDevices] = useState<Device[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

    useEffect(() => {
        async function loadContext() {
            try {
                const { siteId } = await getSiteContext();

                if (!specificDevice) {
                    // Fetch Devices with Location & Status
                    const { data: devicesData } = await supabase
                        .from("facials")
                        .select("id, name, channel, location_description, last_seen_at")
                        .eq("site_id", siteId)
                        .order("name");

                    if (devicesData && devicesData.length > 0) {
                        setDevices(devicesData);
                        setSelectedDeviceId(devicesData[0].id);
                    }
                } else {
                    setSelectedDeviceId(specificDevice.id);
                }

            } catch (e) {
                console.error("Failed to load context", e);
            }
        }
        if (open) {
            loadContext();
        }
    }, [open, specificDevice]);

    const isOnline = (lastSeen?: string) => {
        if (!lastSeen) return false;
        const diff = new Date().getTime() - new Date(lastSeen).getTime();
        return diff < 5 * 60 * 1000; // 5 minutes
    };

    const handleOpenDoor = async () => {
        setLoading(true);

        try {
            const { siteId, clientId } = await getSiteContext();

            // 1. Get Current User for Audit
            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = user?.email || "Desconhecido";
            const userId = user?.id;

            // Find selected device info
            let targetDevice: Device | undefined;

            if (specificDevice) {
                // If specific device is passed, we might not have the full object with location in 'devices' array
                // but we have the ID and Name from props.
                targetDevice = {
                    id: specificDevice.id,
                    name: specificDevice.name,
                    channel: specificDevice.channel
                };
            } else {
                targetDevice = devices.find(d => d.id === selectedDeviceId);
            }

            const targetName = targetDevice?.name || "Dispositivo Desconhecido";
            const targetId = selectedDeviceId;

            if (!targetId) {
                toast.error("Nenhum dispositivo selecionado.");
                setLoading(false);
                return;
            }

            // 2. Insert Job with Target Device
            const { data: jobData, error } = await supabase
                .from("jobs")
                .insert({
                    site_id: siteId,
                    client_id: clientId,
                    created_by: userId,
                    type: "open_door",
                    payload: {
                        channel: targetDevice?.channel || channel,
                        device_id: targetId,
                        device_name: targetName,
                        triggered_by: userEmail
                    },
                    status: "pending",
                })
                .select()
                .single();

            if (error) {
                console.error("Error creating job:", error);
                toast.error("Erro ao iniciar comando: " + error.message);
                setLoading(false);
                return;
            }

            toast.info(`Abrindo ${targetName}...`, {
                duration: 2000
            });
            setOpen(false);

            // 3. Poll for Success (Max 5s)
            const jobId = jobData.id;
            let attempts = 0;
            const maxAttempts = 5;

            const pollInterval = setInterval(async () => {
                attempts++;
                const { data: currentJob } = await supabase
                    .from("jobs")
                    .select("status, result")
                    .eq("id", jobId)
                    .single();

                if (currentJob?.status === "done") {
                    clearInterval(pollInterval);
                    toast.success(`${targetName} Aberta! 🔓`, {
                        duration: 4000
                    });
                    setLoading(false);
                } else if (currentJob?.status === "failed") {
                    clearInterval(pollInterval);
                    const errorMsg = currentJob.result?.error || "Erro desconhecido";
                    toast.error(`Falha em ${targetName}: ${errorMsg}`);
                    setLoading(false);
                } else if (attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                    toast.warning("Comando enviado, mas sem confirmação imediata.");
                    setLoading(false);
                }
            }, 1000);

        } catch (err: any) {
            console.error("Unexpected error:", err);
            toast.error(err.message);
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className={specificDevice ? "gap-2" : "w-full sm:w-auto gap-2"} size={specificDevice ? "sm" : "lg"} variant={specificDevice ? "outline" : "default"}>
                    <Lock className="h-4 w-4" />
                    {specificDevice ? "Abrir" : "Abrir Porta"}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirmar Abertura</DialogTitle>
                    <DialogDescription className="pt-2">
                        {specificDevice
                            ? <span>Você está prestes a abrir a porta: <strong>{specificDevice.name}</strong></span>
                            : "Selecione a porta que deseja abrir remotamente e verifique o status."
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* Device Selector (Only if NOT specific) */}
                    {!specificDevice && devices.length > 0 ? (
                        <div className="space-y-2">
                            <Label>Porta / Dispositivo</Label>
                            <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                                <SelectTrigger>
                                    {devices.find(d => d.id === selectedDeviceId) ? (
                                        (() => {
                                            const dev = devices.find(d => d.id === selectedDeviceId)!;
                                            const online = isOnline(dev.last_seen_at);
                                            return (
                                                <div className="flex items-center gap-2 text-left">
                                                    <div className={`h-2 w-2 rounded-full shrink-0 ${online ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
                                                    <span className="font-medium">{dev.name}</span>
                                                    {dev.location_description && (
                                                        <span className="text-muted-foreground text-xs border-l border-border pl-2 ml-1 hidden sm:inline-block">
                                                            {dev.location_description}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })()
                                    ) : (
                                        <SelectValue placeholder="Selecione um dispositivo" />
                                    )}
                                </SelectTrigger>
                                <SelectContent>
                                    {devices.map((device) => {
                                        const online = isOnline(device.last_seen_at);
                                        return (
                                            <SelectItem key={device.id} value={device.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-2 w-2 rounded-full ${online ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
                                                    <span className="font-medium">{device.name}</span>
                                                    {device.location_description && (
                                                        <span className="text-muted-foreground text-xs border-l border-border pl-2 ml-1">
                                                            {device.location_description}
                                                        </span>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : null}

                    {!specificDevice && devices.length === 0 && (
                        <div className="text-sm text-yellow-500 bg-yellow-500/10 p-2 rounded">
                            Nenhum dispositivo encontrado neste local.
                        </div>
                    )}

                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 flex items-start gap-3 text-yellow-600 dark:text-yellow-400 text-sm">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>Esta ação liberará o acesso físico ao local imediatamente. Certifique-se de que é seguro.</p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleOpenDoor}
                        disabled={loading || (!specificDevice && devices.length === 0)}
                        variant="default"
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                        {loading ? "Abrindo..." : "Confirmar Abertura"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
