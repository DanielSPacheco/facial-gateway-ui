"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Search, Shield, Info, CheckCircle2, User as UserIcon, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface User {
    id: string;
    name: string;
    user_id: string; // The numeric ID on device
    block?: string;
    apartment?: string;
    role?: string;
}

interface Facial {
    id: string;
    name: string;
    location_description?: string;
}

export default function RulesPage() {
    // Data State
    const [users, setUsers] = useState<User[]>([]);
    const [facials, setFacials] = useState<Facial[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Selection State
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
    const [loadingPermissions, setLoadingPermissions] = useState(false);

    // Filter State
    const [searchTerm, setSearchTerm] = useState("");

    // Initial Fetch
    const fetchData = async () => {
        setLoadingData(true);
        try {
            const { siteId } = await getSiteContext();

            // 1. Fetch Users
            const { data: usersData, error: usersError } = await supabase
                .from("users")
                .select("*")
                .eq("client_id", (await getSiteContext()).clientId) // Assuming users follow client_id
                .order("name");

            if (usersError) throw usersError;
            setUsers(usersData || []);

            // 2. Fetch Facials
            const { data: facialsData, error: facialsError } = await supabase
                .from("facials")
                .select("id, name, location_description")
                .eq("site_id", siteId)
                .order("name");

            if (facialsError) throw facialsError;
            setFacials(facialsData || []);

        } catch (error: any) {
            console.error("Error fetching data:", error);
            toast.error("Erro ao carregar dados: " + error.message);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Fetch Permissions when User Selected
    useEffect(() => {
        async function fetchPermissions() {
            if (!selectedUser) {
                setUserPermissions(new Set());
                return;
            }

            setLoadingPermissions(true);
            try {
                const { data, error } = await supabase
                    .from("access_rules")
                    .select("facial_id")
                    .eq("user_id", selectedUser.id);

                if (error) throw error;

                const allowedIds = new Set(data?.map(r => r.facial_id));
                setUserPermissions(allowedIds);

            } catch (error: any) {
                console.error("Error fetching permissions:", error);
                toast.error("Erro ao carregar permissões.");
            } finally {
                setLoadingPermissions(false);
            }
        }

        fetchPermissions();
    }, [selectedUser]);

    // Handle Toggle Permission
    const togglePermission = async (facialId: string, checked: boolean) => {
        if (!selectedUser) return;

        // Optimistic Update
        const next = new Set(userPermissions);
        if (checked) next.add(facialId);
        else next.delete(facialId);
        setUserPermissions(next);

        try {
            const { siteId } = await getSiteContext();

            if (checked) {
                // Grant Access
                const { error } = await supabase
                    .from("access_rules")
                    .insert({
                        site_id: siteId,
                        user_id: selectedUser.id,
                        facial_id: facialId
                    });
                if (error) throw error;
                toast.success(`Acesso concedido: ${selectedUser.name} -> Device`, { duration: 1500 }); // Generic name to avoid complex lookup in toast
            } else {
                // Revoke Access
                const { error } = await supabase
                    .from("access_rules")
                    .delete()
                    .match({
                        user_id: selectedUser.id,
                        facial_id: facialId
                    });
                if (error) throw error;
                toast.info(`Acesso revogado: ${selectedUser.name}`, { duration: 1500 });
            }

        } catch (error: any) {
            // Revert
            setUserPermissions(prev => {
                const reverted = new Set(prev);
                if (checked) reverted.delete(facialId);
                else reverted.add(facialId);
                return reverted;
            });
            toast.error("Erro ao salvar: " + error.message);
        }
    };

    // Filter Users
    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.apartment && u.apartment.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col space-y-4">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Regras de Acesso</h1>
                    <p className="text-muted-foreground">Defina quais portas cada pessoa pode abrir.</p>
                </div>
                <Button variant="outline" size="icon" onClick={fetchData}>
                    <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">

                {/* LEFT: User List */}
                <Card className="md:col-span-5 lg:col-span-4 flex flex-col overflow-hidden border-none shadow-md bg-card/60">
                    <CardHeader className="p-4 border-b shrink-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar morador..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-0">
                        {filteredUsers.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                Nenhuma pessoa encontrada.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {filteredUsers.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => setSelectedUser(user)}
                                        className={`
                                            w-full text-left p-4 flex items-center gap-3 transition-colors hover:bg-muted/50
                                            ${selectedUser?.id === user.id ? 'bg-primary/5 border-l-4 border-primary' : 'border-l-4 border-transparent'}
                                        `}
                                    >
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${selectedUser?.id === user.id ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-muted'}`}>
                                            <UserIcon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{user.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                ID: {user.user_id} {user.apartment && `• Apto ${user.apartment}`}
                                            </p>
                                        </div>
                                        {selectedUser?.id === user.id && (
                                            <CheckCircle2 className="h-4 w-4 text-primary" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* RIGHT: Permissions */}
                <Card className="md:col-span-7 lg:col-span-8 flex flex-col border-none shadow-md bg-card/60">
                    {!selectedUser ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                            <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                                <Shield className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground">Selecione uma Pessoa</h3>
                            <p>Clique em um usuário na lista ao lado para gerenciar suas permissões de acesso.</p>
                        </div>
                    ) : (
                        <>
                            <CardHeader className="p-6 border-b shrink-0 flex flex-row items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-xl">{selectedUser.name}</CardTitle>
                                        {selectedUser.role && <Badge variant="outline">{selectedUser.role}</Badge>}
                                    </div>
                                    <CardDescription className="mt-1">
                                        Gerenciando permissões para {selectedUser.user_id} • {selectedUser.block || "Geral"} {selectedUser.apartment}
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-6">
                                {loadingPermissions ? (
                                    <div className="flex flex-col items-center justify-center h-40 gap-3">
                                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                        <p className="text-sm text-muted-foreground">Carregando permissões...</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {facials.map(facial => {
                                            const isChecked = userPermissions.has(facial.id);
                                            return (
                                                <div
                                                    key={facial.id}
                                                    className={`
                                                        flex items-start space-x-3 p-4 rounded-lg border transition-all
                                                        ${isChecked
                                                            ? 'bg-primary/5 border-primary/50 shadow-sm'
                                                            : 'bg-background hover:bg-muted/50 border-muted'
                                                        }
                                                    `}
                                                >
                                                    <Checkbox
                                                        id={facial.id}
                                                        checked={isChecked}
                                                        onCheckedChange={(c) => togglePermission(facial.id, c as boolean)}
                                                        className="mt-1"
                                                    />
                                                    <div className="space-y-1 leading-none">
                                                        <label
                                                            htmlFor={facial.id}
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                        >
                                                            {facial.name}
                                                        </label>
                                                        <p className="text-xs text-muted-foreground">
                                                            {facial.location_description || "Sem localização definida"}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {facials.length === 0 && (
                                            <div className="col-span-full p-4 border border-dashed rounded-lg text-center text-muted-foreground text-sm">
                                                Nenhum dispositivo encontrado no sistema.
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-md p-4 flex gap-3 text-sm text-blue-400">
                                    <Info className="h-5 w-5 shrink-0" />
                                    <p>
                                        As alterações são salvas automaticamente. O sincronismo com os equipamentos fisícos pode levar alguns minutos.
                                    </p>
                                </div>
                            </CardContent>
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}
