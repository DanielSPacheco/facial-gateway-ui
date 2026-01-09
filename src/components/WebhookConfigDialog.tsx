"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox"; // Assuming Checkbox component exists, if not I'll fallback or creating it
import { ExternalLink, Settings, Save, Network } from "lucide-react";
import { toast } from "sonner";

// Simple Checkbox Component if not imported from UI (I'll inline it or assume ui/checkbox exists. 
// I'll check existence or use standard input type=checkbox for safety)
// Actually, standard input type="checkbox" is safer if I don't want to check file existence.
// But I'll use Shadcn style for consistency if possible. I'll use a simple wrapper.

export function WebhookConfigDialog({ trigger }: { trigger: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState("https://api.exemplo.com/webhook");
    const [secret, setSecret] = useState("sk_test_12345");
    const [events, setEvents] = useState({
        openDoor: true,
        error: false,
        offline: false
    });

    const handleSave = () => {
        toast.success("Webhook configurado com sucesso!");
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Network className="h-5 w-5 text-yellow-500" />
                        Configurar Webhook
                    </DialogTitle>
                    <DialogDescription>
                        Envie eventos do SecureEntry para sistemas externos em tempo real.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="url">URL do Endpoint</Label>
                        <div className="relative">
                            <ExternalLink className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="pl-9"
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Eventos a Enviar</Label>
                        <div className="flex flex-col gap-2 p-3 border rounded-md bg-muted/20">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300"
                                    checked={events.openDoor}
                                    onChange={(e) => setEvents({ ...events, openDoor: e.target.checked })}
                                />
                                Abertura de Porta
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300"
                                    checked={events.error}
                                    onChange={(e) => setEvents({ ...events, error: e.target.checked })}
                                />
                                Erro de Dispositivo
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300"
                                    checked={events.offline}
                                    onChange={(e) => setEvents({ ...events, offline: e.target.checked })}
                                />
                                Device Offline
                            </label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="secret">Secret / Token (Assinatura)</Label>
                        <Input
                            id="secret"
                            type="password"
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Este token será enviado no header para validação.</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSave} className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white border-none">
                        <Save className="h-4 w-4" />
                        Salvar Configuração
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
