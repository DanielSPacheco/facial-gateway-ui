"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

interface DeviceConfigDialogProps {
    device: {
        id: string;
        name: string;
        keep_alive_enabled?: boolean;
        probing_interval?: number;
    };
    onUpdate: () => void;
}

export function DeviceConfigDialog({ device, onUpdate }: DeviceConfigDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Config state
    const [keepAliveEnabled, setKeepAliveEnabled] = useState(device.keep_alive_enabled ?? true);
    const [probingInterval, setProbingInterval] = useState(device.probing_interval?.toString() ?? "5");

    const handleSave = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from("facials")
                .update({
                    keep_alive_enabled: keepAliveEnabled,
                    probing_interval: parseInt(probingInterval)
                })
                .eq("id", device.id);

            if (error) throw error;

            setOpen(false);
            onUpdate();
            toast.success("Configuração atualizada com sucesso!");
        } catch (error: any) {
            console.error("Error updating device config:", error);
            toast.error("Erro ao salvar: " + (error.message || "Erro desconhecido"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Configuração do Dispositivo</DialogTitle>
                    <DialogDescription>
                        Ajuste as configurações de monitoramento para {device.name}.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center justify-between space-x-2">
                        <div className="flex flex-col space-y-1">
                            <Label htmlFor="keep-alive" className="font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Monitoramento Contínuo
                            </Label>
                            <span className="text-xs text-muted-foreground">
                                "Always On" - Verifica o status do dispositivo periodicamente.
                            </span>
                        </div>
                        <Switch
                            id="keep-alive"
                            checked={keepAliveEnabled}
                            onCheckedChange={setKeepAliveEnabled}
                        />
                    </div>

                    {keepAliveEnabled && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="interval" className="text-right col-span-2">
                                Intervalo (minutos)
                            </Label>
                            <Input
                                id="interval"
                                type="number"
                                value={probingInterval}
                                onChange={(e) => setProbingInterval(e.target.value)}
                                className="col-span-2"
                                min="1"
                            />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleSave} disabled={loading}>
                        {loading ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
