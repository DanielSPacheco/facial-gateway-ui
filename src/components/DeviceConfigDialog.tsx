"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Eye, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getSiteContext } from "@/lib/site-context";

interface DeviceConfigDialogProps {
    device?: {
        id: string;
        name: string;
        ip?: string;
        port?: number;
        protocol?: string;
        username?: string;
        password?: string;
        channel?: number;
        location_description?: string;
        keep_alive_enabled?: boolean;
        probing_interval?: number;
    } | null;
    trigger?: React.ReactNode;
    onUpdate: () => void;
}

export function DeviceConfigDialog({ device, trigger, onUpdate }: DeviceConfigDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [ip, setIp] = useState("");
    const [port, setPort] = useState("80");
    const [protocol, setProtocol] = useState("isapi");
    const [username, setUsername] = useState("admin");
    const [password, setPassword] = useState("");
    const [channel, setChannel] = useState("1");
    const [location, setLocation] = useState("");
    const [keepAliveEnabled, setKeepAliveEnabled] = useState(true);
    const [probingInterval, setProbingInterval] = useState("5");

    // Initialize form when device changes or dialog opens
    useEffect(() => {
        if (open) {
            if (device) {
                setName(device.name || "");
                setIp(device.ip || "");
                setPort(device.port?.toString() || "80");
                setProtocol(device.protocol || "isapi");
                setUsername(device.username || "admin");
                setPassword(device.password || "");
                setChannel(device.channel?.toString() || "1");
                setLocation(device.location_description || "");
                setKeepAliveEnabled(device.keep_alive_enabled ?? true);
                setProbingInterval(device.probing_interval?.toString() || "5");
            } else {
                // Default values for new device
                setName("");
                setIp("");
                setPort("80");
                setProtocol("isapi");
                setUsername("admin");
                setPassword("");
                setChannel("1");
                setLocation("");
                setKeepAliveEnabled(true);
                setProbingInterval("5");
            }
        }
    }, [open, device]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { siteId, clientId } = await getSiteContext();
            let deviceId = device?.id;

            // 1. Save Metadata (Directly to 'facials' via RLS - Safe)
            const metadataPayload = {
                site_id: siteId,
                client_id: clientId,
                name,
                ip,
                port: parseInt(port) || 80,
                protocol,
                channel: parseInt(channel) || 1,
                location_description: location,
                keep_alive_enabled: keepAliveEnabled,
                probing_interval: parseInt(probingInterval) || 5
            };

            if (deviceId) {
                // Update Metadata
                const { data, error } = await supabase
                    .from("facials")
                    .update(metadataPayload)
                    .eq("id", deviceId)
                    .select(); // Return data to confirm update happened

                if (error) throw error;
                if (!data || data.length === 0) {
                    throw new Error("Erro de Permissão: Não foi possível atualizar o dispositivo. Verifique as políticas RLS.");
                }
            } else {
                // Create Metadata
                const { data, error } = await supabase
                    .from("facials")
                    .insert(metadataPayload)
                    .select("id")
                    .single();

                if (error) throw error;
                deviceId = data.id;
            }

            // 2. Save Secrets (Via Secure API - Sensitive)
            // Only if provided
            if (username || password) {
                const secretPayload = {
                    id: deviceId,
                    username,
                    password
                };

                const response = await fetch('/api/device/secrets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(secretPayload)
                });

                const data = await response.json();
                if (!response.ok || !data.success) {
                    // Start soft failure: Metadata saved, but secrets failed.
                    // If secrets failed due to missing key, warn user but don't crash whole flow.
                    if (data.error && data.error.includes("SUPABASE_SERVICE_ROLE_KEY")) {
                        toast.warning("Dados básicos salvos, mas Credenciais não foram salvas (Falta Chave de Servidor).");
                    } else {
                        throw new Error(data.error || "Erro ao salvar credenciais.");
                    }
                }
            }

            setOpen(false);
            onUpdate();
            toast.success(device ? "Dispositivo atualizado!" : "Dispositivo criado!");
        } catch (error: any) {
            console.error("Error saving device:", error);
            toast.error("Erro ao salvar: " + (error.message || "Erro desconhecido"));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!device?.id || !confirm("Tem certeza que deseja excluir este dispositivo?")) return;
        setLoading(true);
        try {
            const { error } = await supabase.from("facials").delete().eq("id", device.id);
            if (error) throw error;
            setOpen(false);
            onUpdate();
            toast.success("Dispositivo removido.");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Settings className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{device ? "Editar Dispositivo" : "Novo Dispositivo"}</DialogTitle>
                    <DialogDescription>
                        Configure os detalhes de conexão e autenticação do controlador facial.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="general">Geral</TabsTrigger>
                        <TabsTrigger value="network">Rede & Auth</TabsTrigger>
                        <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
                    </TabsList>

                    {/* GENERAL TAB */}
                    <TabsContent value="general" className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <Label>Nome do Equipamento</Label>
                                <Input
                                    placeholder="Ex: Portão Social"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>Descrição / Localização</Label>
                                <Input
                                    placeholder="Ex: Entrada principal do Bloco A"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                />
                            </div>
                        </div>
                    </TabsContent>

                    {/* NETWORK TAB */}
                    <TabsContent value="network" className="space-y-4 py-4">
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-8 space-y-2">
                                <Label>Endereço IP / Host</Label>
                                <Input placeholder="192.168.1.10" value={ip} onChange={(e) => setIp(e.target.value)} />
                            </div>
                            <div className="col-span-4 space-y-2">
                                <Label>Porta</Label>
                                <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} />
                            </div>

                            <div className="col-span-6 space-y-2">
                                <Label>Protocolo</Label>
                                <Select value={protocol} onValueChange={setProtocol}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="isapi">Intelbras / Hikvision (ISAPI)</SelectItem>
                                        <SelectItem value="rpc">Dahua (RPC)</SelectItem>
                                        <SelectItem value="http">Genérico (HTTP)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="col-span-6 space-y-2">
                                <Label>Canal / Porta Index</Label>
                                <Input type="number" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="1" />
                            </div>

                            <div className="col-span-12 border-t pt-4 mt-2">
                                <Label className="text-base font-semibold">Credenciais do Dispositivo</Label>
                                <p className="text-xs text-muted-foreground mb-4">Necessário para comandos remotos (abrir porta, sync usuários).</p>
                            </div>

                            <div className="col-span-6 space-y-2">
                                <Label>Usuário</Label>
                                <Input placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} />
                            </div>
                            <div className="col-span-6 space-y-2">
                                <Label>Senha</Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* MONITORING TAB */}
                    <TabsContent value="monitoring" className="space-y-4 py-4">
                        <div className="flex items-center justify-between space-x-2 border p-4 rounded-md">
                            <div className="flex flex-col space-y-1">
                                <Label className="text-base">Health Check Ativo</Label>
                                <span className="text-xs text-muted-foreground">
                                    Verifica periodicamente se o dispositivo está online via Ping/API.
                                </span>
                            </div>
                            <Switch checked={keepAliveEnabled} onCheckedChange={setKeepAliveEnabled} />
                        </div>

                        {keepAliveEnabled && (
                            <div className="space-y-2">
                                <Label>Intervalo de Verificação (minutos)</Label>
                                <Input
                                    type="number"
                                    value={probingInterval}
                                    onChange={(e) => setProbingInterval(e.target.value)}
                                    min="1"
                                />
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2 sm:gap-0">
                    {device?.id && (
                        <Button variant="destructive" size="icon" onClick={handleDelete} disabled={loading}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                    <div className="flex-1" />
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={loading} className="gap-2">
                        <Save className="h-4 w-4" />
                        {loading ? "Salvando..." : "Salvar Configurações"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
