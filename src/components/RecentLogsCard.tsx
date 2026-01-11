"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle2, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LogItem {
    id: string;
    created_at: string;
    type: string;
    status: string;
    payload?: any;
    created_by?: string;
}

export function RecentLogsCard({ lastRefreshed }: { lastRefreshed?: Date }) {
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = useCallback(async () => {
        try {
            const { siteId } = await getSiteContext();

            const { data, error } = await supabase
                .from("jobs")
                .select("id, created_at, type, status, payload, created_by")
                .eq("site_id", siteId)
                .order("created_at", { ascending: false })
                .limit(5);

            if (data) {
                setLogs(data);
            }
        } catch (error) {
            console.error("Failed to load recent logs:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();

        // Subscribe to new jobs
        const channel = supabase
            .channel('recent_logs_dashboard')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, () => {
                fetchLogs();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, () => {
                fetchLogs();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchLogs, lastRefreshed]);

    const formatTime = (isoString: string) => {
        if (!isoString) return "-";
        return new Date(isoString).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'done': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
            case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
            case 'failed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
            case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
            case 'processing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
            default: return <Clock className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getActionLabel = (type: string) => {
        switch (type) {
            case 'open_door': return "Abertura de Porta";
            // ... (keep others)
            case 'create_user': return "Criar Usuário";
            case 'user_create': return "Criar Usuário";
            case 'update_user': return "Editar Usuário";
            case 'delete_user': return "Remover Usuário";
            case 'card_add': return "Adicionar Cartão";
            case 'card_delete': return "Remover Cartão";
            case 'face_upload_base64': return "Upload Facial";
            default: return type.replace(/_/g, " ");
        }
    };

    const getUserLabel = (log: LogItem) => {
        if (log.payload?.triggered_by) return log.payload.triggered_by;
        if (log.created_by) return log.created_by.split('-')[0]; // Short UUID if no email
        return "Sistema";
    };

    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Últimas Execuções
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {loading && logs.length === 0 ? (
                        <div className="text-xs text-muted-foreground animate-pulse">Carregando...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-xs text-muted-foreground">Nenhuma atividade recente.</div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {logs.map((log) => (
                                <div key={log.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(log.status)}
                                            <span className="font-medium text-slate-200">
                                                {getActionLabel(log.type)}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground pl-6">
                                            por: <span className="text-slate-400">{getUserLabel(log)}</span>
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {formatTime(log.created_at)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
