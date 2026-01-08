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
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Loader2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function OpenDoorButton({ channel = 1 }: { channel?: number }) {
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [siteName, setSiteName] = useState<string | null>(null);

    useEffect(() => {
        async function loadSiteName() {
            try {
                const { siteId } = await getSiteContext();
                const { data } = await supabase
                    .from("sites")
                    .select("name")
                    .eq("id", siteId)
                    .single();

                if (data) setSiteName(data.name);
            } catch (e) {
                console.error("Failed to load site name", e);
            }
        }
        loadSiteName();
    }, []);

    const handleOpenDoor = async () => {
        setLoading(true);

        try {
            const { siteId, clientId } = await getSiteContext();

            // 1. Get Current User for Audit
            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = user?.email || "Unknown";
            const userId = user?.id;

            // 2. Insert Job
            const { data: jobData, error } = await supabase
                .from("jobs")
                .insert({
                    site_id: siteId,
                    client_id: clientId,
                    created_by: userId, // Audit: Who created it (UUID)
                    type: "open_door",
                    payload: {
                        channel,
                        triggered_by: userEmail // Audit: Display Name/Email
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

            toast.info("Comando enviado... Aguardando confirmação do dispositivo.", {
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
                    toast.success("Porta Aberta com Sucesso! 🔓", {
                        duration: 4000
                    });
                    setLoading(false);
                } else if (currentJob?.status === "failed") {
                    clearInterval(pollInterval);
                    const errorMsg = currentJob.result?.error || "Erro desconhecido";
                    toast.error(`Falha no dispositivo: ${errorMsg}`);
                    setLoading(false);
                } else if (attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                    // Timeout but not necessarily failed (maybe just slow network)
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
                <Button className="w-full sm:w-auto gap-2" size="lg">
                    <Lock className="h-4 w-4" />
                    Open Door
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirmar Abertura</DialogTitle>
                    <DialogDescription className="pt-2">
                        Você está prestes a abrir a:
                        <br />
                        <span className="font-semibold text-foreground block mt-1 text-lg">
                            Porta Principal {channel > 1 ? `(Canal ${channel})` : ""}
                        </span>
                        <span className="text-muted-foreground block text-sm mt-1">
                            {siteName ? `📍 ${siteName}` : "Local não identificado"}
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 flex items-start gap-3 my-2 text-yellow-600 dark:text-yellow-400 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>Esta ação liberará o acesso físico ao local imediatamente. Certifique-se de que é seguro.</p>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleOpenDoor}
                        disabled={loading}
                        variant="default" // Changed from destructive to default (or keep logic) - usually open door is "Action", maybe green? Default is usually black/white.
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
