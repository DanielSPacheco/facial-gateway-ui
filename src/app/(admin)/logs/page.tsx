"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    RefreshCw,
    Search,
    Lock,
    Unlock,
    User,
    Activity,
    Server,
    Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface LogItem {
    id: string;
    created_at: string;
    type: string;
    status: string;
    result?: any;
    payload?: any;
    created_by?: string;
}

export default function LogsPage() {
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const { siteId } = await getSiteContext();

            const { data, error } = await supabase
                .from("jobs")
                .select("id, created_at, type, status, result, payload, created_by")
                .eq("site_id", siteId)
                .order("created_at", { ascending: false })
                .limit(50);

            if (error) {
                console.error("Error fetching logs:", error);
            } else {
                setLogs(data || []);
            }
        } catch (error) {
            console.error("Failed to load logs:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const formatTime = (isoString: string) => {
        if (!isoString) return "-";
        return new Date(isoString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getStatusBadge = (status: string, result: any) => {
        if (status === 'done') {
            return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20 pointer-events-none">Success</Badge>;
        }
        if (status === 'failed') {
            return <Badge variant="destructive" className="pointer-events-none">Failed</Badge>;
        }
        if (status === 'pending') {
            return <Badge variant="outline" className="text-yellow-500 border-yellow-500/20 pointer-events-none">Pending</Badge>;
        }
        return <Badge variant="secondary">{status}</Badge>;
    };

    const getActionLabel = (type: string) => {
        switch (type) {
            case 'open_door': return "Abertura de Porta";
            case 'create_user': return "Criação de Usuário";
            case 'update_user': return "Atualização de Usuário";
            case 'delete_user': return "Remoção de Usuário";
            case 'sync_users': return "Sincronização";
            default: return type.replace(/_/g, " ");
        }
    };

    const getActionIcon = (type: string) => {
        switch (type) {
            case 'open_door': return <Unlock className="h-4 w-4 text-blue-500" />;
            case 'create_user':
            case 'update_user':
            case 'delete_user': return <User className="h-4 w-4 text-orange-500" />;
            case 'sync_users': return <RefreshCw className="h-4 w-4 text-purple-500" />;
            default: return <Activity className="h-4 w-4 text-gray-500" />;
        }
    };

    const getUserLabel = (item: LogItem) => {
        // 1. Try payload.triggered_by (Email)
        if (item.payload?.triggered_by) {
            return (
                <div className="flex items-center gap-1.5 text-foreground">
                    <User className="h-3 w-3" />
                    <span>{item.payload.triggered_by}</span>
                </div>
            );
        }
        // 2. Try created_by (UUID checking if it's system or user)
        if (item.created_by) {
            return <span className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">{item.created_by}</span>;
        }
        // 3. Fallback to System
        return (
            <div className="flex items-center gap-1.5 text-muted-foreground">
                <Server className="h-3 w-3" />
                <span>System</span>
            </div>
        );
    };

    const filteredLogs = logs.filter(log =>
        log.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.payload?.triggered_by?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Logs & Auditoria</h1>
                    <p className="text-muted-foreground">Histórico detalhado de ações do sistema.</p>
                </div>
                <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading}>
                    <div suppressHydrationWarning>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </div>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Registro de Atividades
                        </CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Filtrar por ação ou usuário..."
                                className="pl-8 h-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr className="text-left">
                                    <th className="p-3 font-medium w-48">Data / Hora</th>
                                    <th className="p-3 font-medium w-40">Usuário</th>
                                    <th className="p-3 font-medium">Ação</th>
                                    <th className="p-3 font-medium w-32">Status</th>
                                    <th className="p-3 font-medium text-right">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && logs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando histórico...</td>
                                    </tr>
                                )}
                                {!loading && filteredLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum registro encontrado.</td>
                                    </tr>
                                )}
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                        <td className="p-3 font-mono text-muted-foreground">
                                            {formatTime(log.created_at)}
                                        </td>
                                        <td className="p-3">
                                            {getUserLabel(log)}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                {getActionIcon(log.type)}
                                                <span className="font-medium">{getActionLabel(log.type)}</span>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            {getStatusBadge(log.status, log.result)}
                                        </td>
                                        <td className="p-3 text-right">
                                            {log.result?.error ? (
                                                <span className="text-xs text-red-400 max-w-[200px] inline-block truncate" title={log.result.error}>
                                                    {(() => {
                                                        const err = String(log.result.error || "");
                                                        if (err.includes("UNKNOWN_ACTION")) return "Ação não suportada";
                                                        if (err.includes("timeout")) return "Tempo esgotado";
                                                        return err;
                                                    })()}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
