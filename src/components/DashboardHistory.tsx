"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, CheckCircle2, AlertTriangle, Lock, Unlock, User, Activity } from "lucide-react";
import { toast } from "sonner";

interface HistoryItem {
    id: string;
    type: string;
    status: string;
    created_at: string;
    result?: any;
    error_message?: string;
    payload?: any;
}

export function DashboardHistory() {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = useCallback(async () => {
        try {
            const { siteId } = await getSiteContext();

            const { data, error } = await supabase
                .from("jobs")
                .select("id, type, status, created_at, result, payload") // Removed 'error', added 'result'
                .eq("site_id", siteId)
                .order("created_at", { ascending: false })
                .limit(5);

            if (error) {
                console.error("DashboardHistory Error:", error);
                // toast.error("Db Error: " + error.message);
                throw error;
            }

            if (data) {
                setHistory(data);
            }
        } catch (e) {
            console.error("Failed to fetch history:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 10000); // 10s auto-refresh
        return () => clearInterval(interval);
    }, [fetchHistory]);

    const getIcon = (type: string, status: string) => {
        if (status === 'failed') return <AlertTriangle className="h-4 w-4 text-red-500" />;

        switch (type) {
            case 'open_door': return <Unlock className="h-4 w-4 text-blue-500" />;
            case 'update_user': return <User className="h-4 w-4 text-orange-500" />;
            case 'sync_users': return <Activity className="h-4 w-4 text-purple-500" />;
            default: return <CheckCircle2 className="h-4 w-4 text-gray-500" />;
        }
    };

    const formatType = (type: string) => {
        switch (type) {
            case 'open_door': return "Abertura de Porta";
            case 'update_user': return "Atualização de Usuário";
            case 'create_user': return "Criação de Usuário";
            case 'delete_user': return "Remoção de Usuário";
            case 'sync_users': return "Sincronização de Usuários";
            default: return type.replace(/_/g, " ");
        }
    };

    const formatTime = (isoString: string) => {
        if (!isoString) return "--:--";
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <Card className="col-span-1 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico Recente
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {loading && history.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Carregando...</p>
                    ) : history.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma atividade recente.</p>
                    ) : (
                        history.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                    {getIcon(item.type, item.status)}
                                    <div className="flex flex-col">
                                        <span className="font-medium">{formatType(item.type)}</span>
                                        {/* Audit: Who Triggered It */}
                                        {item.payload?.triggered_by && (
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                👤 {item.payload.triggered_by}
                                            </span>
                                        )}
                                        {/* Display Result Error or Status */}
                                        {(item.status === 'failed' || item.result?.error) && (
                                            <span className="text-[10px] text-red-400 max-w-[200px] truncate">
                                                {(() => {
                                                    const err = String(item.result?.error || item.error_message || "Falha na execução");
                                                    if (err.includes("UNKNOWN_ACTION")) return "Ação não suportada pelo dispositivo";
                                                    if (err.includes("timeout")) return "Tempo esgotado";
                                                    return err;
                                                })()}
                                            </span>
                                        )}
                                        {item.status === 'done' && (
                                            <span className="text-[10px] text-green-400">Sucesso</span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-xs text-muted-foreground font-mono">
                                    {formatTime(item.created_at)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
