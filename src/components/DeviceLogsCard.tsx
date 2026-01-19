"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Image as ImageIcon, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface EventRecord {
    RecNo: number;
    CreateTime: number; // epoch
    CardNo?: string;
    CardName?: string;
    CardType?: number;
    DoorNo?: number;
    Method?: number; // 1=Card, 2=Face, 3=Pwd, etc.
    Status?: number;
    Type?: string; // "Entry", "Exit" ? - Check actual data
    FileURL?: string; // Often contains the snapshot path on device
}

interface DeviceLogsCardProps {
    deviceId: string;
    deviceIp: string; // Needed to build snapshot URL if FileURL is relative
}

export function DeviceLogsCard({ deviceId, deviceIp }: DeviceLogsCardProps) {
    const [logs, setLogs] = useState<EventRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch last 24h by default or just recent 50
            // The service defaults to limit=50 if we don't pass params
            // We'll just hit the endpoint
            const res = await fetch(`http://localhost:4000/facial/events/${deviceId}?limit=20`);
            const data = await res.json();

            if (!data.ok) {
                throw new Error(data.error || "Failed to fetch logs");
            }

            setLogs(data.records || []);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [deviceId]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const formatTime = (epoch: number) => {
        return new Date(epoch * 1000).toLocaleString("pt-BR");
    };

    const getMethodLabel = (method: number) => {
        switch (method) {
            case 1: return "Cartão";
            case 2: return "Facial";
            case 3: return "Senha";
            case 4: return "Impressão Digital";
            default: return `Outro (${method})`;
        }
    };

    // Helper to construct image URL
    // If FileURL exists, it's usually a path on the device (e.g. /mnt/sd/...)
    // We can't access it directly unless we proxy or if the device exposes it via http.
    // Intelbras/Dahua usually allows access via http://<ip>/<path> if authenticated?
    // Or we might need a proxy in our backend?
    // For now, let's try to display it if present.
    const getImageUrl = (path: string) => {
        // This is tricky without a proxy if auth is needed.
        // But let's assume we might need to proxy it through our backend later.
        // For now, let's just log it or show it as text if it's not a standard URL.
        return path;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Logs de Acesso (No Dispositivo)</span>
                    <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs">Atualizar</span>}
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {error && <div className="text-red-500 text-sm mb-4">Erro: {error}</div>}

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Detalhes</TableHead>
                            <TableHead className="text-right">Foto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                    Nenhum registro encontrado.
                                </TableCell>
                            </TableRow>
                        )}
                        {logs.map((log) => (
                            <TableRow key={log.RecNo}>
                                <TableCell className="font-mono text-xs">{formatTime(log.CreateTime)}</TableCell>
                                <TableCell>{log.CardName || "Desconhecido"}</TableCell>
                                <TableCell>{getMethodLabel(log.Method || 0)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    Card: {log.CardNo} <br />
                                    Status: {log.Status}
                                </TableCell>
                                <TableCell className="text-right">
                                    {log.FileURL ? (
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <ImageIcon className="h-4 w-4 text-blue-500" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <div className="flex flex-col items-center gap-2">
                                                    <p className="text-sm text-muted-foreground break-all">{log.FileURL}</p>
                                                    <p className="text-xs text-yellow-600">
                                                        Nota: A visualização direta da imagem pode exigir autenticação ou proxy adicional dependendo do modelo.
                                                    </p>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
