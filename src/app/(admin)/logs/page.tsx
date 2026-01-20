"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { buildGatewayUrl } from "@/lib/gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Shield,
    RefreshCw,
    Search,
    Unlock,
    User,
    Activity,
    Server,
    Camera,
    Eye,
    Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// --- System Logs Types ---
interface LogItem {
    id: string;
    created_at: string;
    type: string;
    status: string;
    result?: any;
    payload?: any;
    created_by?: string;
}

// --- Audit Logs Types ---
interface AuditRecord {
    eventKey: string;
    deviceId: string;
    occurredAt: string;
    action: string;
    status: string;
    userLabel: string;
    userId: string | null;
    method: number;
    type: string;
    cardLast4: string | null;
    snapshotUrl: string | null;
}

interface AuditResponse {
    ok: boolean;
    deviceId: string;
    total: number;
    records: AuditRecord[];
    error?: string;
}

// --- Device Type ---
interface FacialDevice {
    id: string;
    name: string;
    ip: string;
}

export default function LogsPage() {
    const [activeTab, setActiveTab] = useState("system"); // system | audit

    // System Logs State
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Audit Logs State
    const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
    const [loadingAudit, setLoadingAudit] = useState(false);
    const [devices, setDevices] = useState<FacialDevice[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

    // Common State
    const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);

    // Initial Data Load
    useEffect(() => {
        fetchDevices();
        fetchSystemLogs();
    }, []);

    const fetchDevices = async () => {
        const { siteId } = await getSiteContext();
        const { data } = await supabase
            .from("facials")
            .select("id, name, ip")
            .eq("site_id", siteId);

        if (data && data.length > 0) {
            setDevices(data);
            // Default to first device
            if (!selectedDeviceId) {
                setSelectedDeviceId(data[0].id);
            }
        }
    };

    const fetchSystemLogs = async () => {
        setLoadingLogs(true);
        try {
            const { siteId } = await getSiteContext();
            const { data, error } = await supabase
                .from("jobs")
                .select("id, created_at, type, status, result, payload, created_by")
                .eq("site_id", siteId)
                .order("created_at", { ascending: false })
                .limit(50);

            if (!error) {
                setLogs(data || []);
            }
        } catch (error) {
            console.error("Failed to load system logs:", error);
        } finally {
            setLoadingLogs(false);
        }
    };

    const fetchAuditLogs = async () => {
        if (!selectedDeviceId) return;

        setLoadingAudit(true);
        try {
            // Default: Today's range (00:00 to 23:59)
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

            // Using local gateway endpoint (assuming port 4000 based on recent fixes)
            const url = `${buildGatewayUrl(`/facial/audit/access/${selectedDeviceId}`)}?from=${startOfDay}&to=${endOfDay}&limit=50&offset=0`;

            const res = await fetch(url);
            const data: AuditResponse = await res.json();

            if (data.ok) {
                setAuditRecords(data.records || []);
            } else {
                console.error("Audit fetch failed:", data.error);
                setAuditRecords([]);
            }
        } catch (error) {
            console.error("Failed to fetch audit logs:", error);
        } finally {
            setLoadingAudit(false);
        }
    };

    // Auto-fetch audit when tab or device changes
    useEffect(() => {
        if (activeTab === "audit" && selectedDeviceId) {
            fetchAuditLogs();
        }
    }, [activeTab, selectedDeviceId]);


    // --- Formatters ---
    const formatTime = (isoString: string) => {
        if (!isoString) return "-";
        return new Date(isoString).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    const formatShortTime = (isoString: string) => {
        if (!isoString) return "-";
        return new Date(isoString).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // --- System Logs Helpers ---
    const getSystemStatusBadge = (status: string) => {
        if (status === 'done') return <Badge className="bg-green-500/10 text-green-500 pointer-events-none">Success</Badge>;
        if (status === 'failed') return <Badge variant="destructive" className="pointer-events-none">Failed</Badge>;
        if (status === 'pending') return <Badge variant="outline" className="text-yellow-500 pointer-events-none">Pending</Badge>;
        return <Badge variant="secondary">{status}</Badge>;
    };

    const getSystemActionIcon = (type: string) => {
        switch (type) {
            case 'open_door': return <Unlock className="h-4 w-4 text-blue-500" />;
            case 'create_user':
            case 'update_user':
            case 'delete_user': return <User className="h-4 w-4 text-orange-500" />;
            default: return <Activity className="h-4 w-4 text-gray-500" />;
        }
    };

    const filteredSystemLogs = logs.filter(log =>
        log.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.payload?.triggered_by?.toLowerCase().includes(searchTerm.toLowerCase())
    );


    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Logs & Auditoria</h1>
                    <p className="text-muted-foreground">Histórico de ações do sistema e acessos físicos.</p>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => activeTab === 'system' ? fetchSystemLogs() : fetchAuditLogs()}
                    disabled={loadingLogs || loadingAudit}
                >
                    <RefreshCw className={`h-4 w-4 ${(loadingLogs || loadingAudit) ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <Tabs defaultValue="system" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                    <TabsTrigger value="system">Logs do Sistema</TabsTrigger>
                    <TabsTrigger value="audit">Eventos de Acesso</TabsTrigger>
                </TabsList>

                {/* --- SYSTEM LOGS TAB --- */}
                <TabsContent value="system" className="mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-primary" />
                                    Atividades do Sistema
                                </CardTitle>
                                <div className="relative w-64">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Filtrar..."
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
                                            <th className="p-3 font-medium">Usuário</th>
                                            <th className="p-3 font-medium">Ação</th>
                                            <th className="p-3 font-medium">Status</th>
                                            <th className="p-3 font-medium text-right">Detalhes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSystemLogs.length === 0 && (
                                            <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem registros.</td></tr>
                                        )}
                                        {filteredSystemLogs.map((log) => (
                                            <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50">
                                                <td className="p-3 font-mono text-muted-foreground">{formatShortTime(log.created_at)}</td>
                                                <td className="p-3">
                                                    {log.payload?.triggered_by || log.created_by || "System"}
                                                </td>
                                                <td className="p-3 flex items-center gap-2">
                                                    {getSystemActionIcon(log.type)}
                                                    {log.type}
                                                </td>
                                                <td className="p-3">{getSystemStatusBadge(log.status)}</td>
                                                <td className="p-3 text-right">
                                                    {log.result?.error ? (
                                                        <span className="text-xs text-red-400 truncate max-w-[150px] inline-block" title={JSON.stringify(log.result.error)}>
                                                            {String(log.result.error.message || log.result.error)}
                                                        </span>
                                                    ) : "-"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- AUDIT LOGS TAB --- */}
                <TabsContent value="audit" className="mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-blue-500" />
                                    Eventos de Acesso (Dispositivos)
                                </CardTitle>

                                <div className="flex items-center gap-2 min-w-[300px]">
                                    <Label>Dispositivo:</Label>
                                    <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Selecione um dispositivo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {devices.map(d => (
                                                <SelectItem key={d.id} value={d.id}>
                                                    {d.name} ({d.ip})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 border-b">
                                        <tr className="text-left">
                                            <th className="p-3 font-medium w-48">Horário</th>
                                            <th className="p-3 font-medium w-24">ID</th>
                                            <th className="p-3 font-medium">Nome</th>
                                            <th className="p-3 font-medium">Método</th>
                                            <th className="p-3 font-medium">Estado</th>
                                            <th className="p-3 font-medium text-center">Prévia</th>
                                            <th className="p-3 font-medium text-center">Baixar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingAudit && (
                                            <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando eventos...</td></tr>
                                        )}
                                        {!loadingAudit && auditRecords.length === 0 && (
                                            <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum evento encontrado hoje.</td></tr>
                                        )}
                                        {auditRecords.map((rec) => {
                                            // The backend returns a relative path starting with /facial/events/...
                                            // OR a full absolute URL (from Supabase/Agent) if mixed data sources.
                                            // The backend returns a relative path starting with /mnt/... (from device)
                                            // We must proxy it via our gateway: /facial/events/:ip/photo?url=...
                                            let fullSnapshotUrl = null;
                                            if (rec.snapshotUrl) {
                                                // If it's already a full URL (legacy?), keep it.
                                                if (rec.snapshotUrl.startsWith("http")) {
                                                    fullSnapshotUrl = rec.snapshotUrl;
                                                } else {
                                                    // Construct the proxy URL
                                                    // We need the device id used by the gateway.
                                                    // Since we filter by `selectedDeviceId` in fetchAuditLogs, we use it here.

                                                    // The user used: http://127.0.0.1:4000/facial/events/192.168.3.227/photo?url=...

                                                    const targetDeviceId = selectedDeviceId;

                                                    // Ensure we have a valid path to encode
                                                    const encodedPath = encodeURIComponent(rec.snapshotUrl);
                                                    fullSnapshotUrl = `${buildGatewayUrl(`/facial/events/${targetDeviceId}/photo`)}?url=${encodedPath}`;
                                                }
                                            }

                                            return (
                                                <tr key={rec.eventKey} className="border-b last:border-0 hover:bg-muted/50">
                                                    <td className="p-3 font-mono text-muted-foreground">
                                                        {formatTime(rec.occurredAt)}
                                                    </td>
                                                    <td className="p-3 font-mono text-muted-foreground">
                                                        {rec.userId || "-"}
                                                    </td>
                                                    <td className="p-3 font-medium">
                                                        {rec.userLabel}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="flex items-center gap-1">
                                                            {rec.method === 15 ? <User className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                                            {rec.action}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">
                                                        {rec.status === "Success" ? (
                                                            <Badge className="bg-green-500/10 text-green-500 pointer-events-none hover:bg-green-500/20">OK</Badge>
                                                        ) : (
                                                            <Badge variant="destructive">Falha</Badge>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {fullSnapshotUrl && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setSelectedSnapshot(fullSnapshotUrl)}
                                                                className="h-8 w-8 text-blue-400 hover:text-blue-300"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {fullSnapshotUrl && (
                                                            <a
                                                                href={fullSnapshotUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                                                            >
                                                                <Download className="h-4 w-4" />
                                                            </a>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Snapshot Modal */}
            <Dialog open={!!selectedSnapshot} onOpenChange={(open) => !open && setSelectedSnapshot(null)}>
                <DialogContent className="max-w-3xl bg-black border-zinc-800">
                    <DialogHeader>
                        <DialogTitle>Registro Fotográfico</DialogTitle>
                    </DialogHeader>
                    {selectedSnapshot && (
                        <div className="rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={selectedSnapshot}
                                alt="Snapshot"
                                className="max-w-full max-h-[600px] object-contain"
                                onError={(e) => {
                                    // Fallback if direct device connection fails (CORS/Network)
                                    // Maybe try via proxy? But proxy is just for live.
                                    // Stored images usually direct.
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
