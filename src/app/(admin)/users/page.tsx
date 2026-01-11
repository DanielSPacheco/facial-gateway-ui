"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface User {
    id: string; // internal DB id
    user_id: string; // device user id (e.g. "888")
    name: string;
    authority: number;
    block?: string;
    apartment?: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        setLoading(true);
        // Assuming 'users' table exists as per standard schema
        const { data, error } = await supabase
            .from("users")
            .select("*")
            // Filter only residents (role is null or 'resident')
            // Note: Supabase .or() syntax might be needed if defaults were applied late, but let's try assuming 'resident' is default now.
            // If role column doesn't exist yet in data, this might fail or ignore.
            // .eq('role', 'resident') or .is('role', null)
            // For safety, let's filter purely by NOT being system roles if we can, or just 'resident' if we trust migration.
            // Let's rely on the plan: filter by resident.
            // .or('role.eq.resident,role.is.null') // RESIDENT FILTER DISABLED FOR DEBUGGING
            .order("user_id");

        if (error) {
            console.error("Error fetching users:", error);
            toast.error("Erro ao buscar usuários: " + error.message);
        } else {
            setUsers(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const getDevices = async (siteId: string) => {
        const { data } = await supabase.from("facials").select("id, name").eq("site_id", siteId);
        return data || [];
    };

    const handleDeleteClick = (user: User) => {
        setUserToDelete(user);
    }

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        const user = userToDelete;
        setUserToDelete(null); // Close dialog

        try {
            const { siteId, clientId } = await getSiteContext();

            // Get current user for audit
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            const userEmail = currentUser?.email || "unknown";

            // 1. Delete from public.users (DB)
            const { error: dbError } = await supabase
                .from("users")
                .delete()
                .eq("user_id", user.user_id)
                .eq("client_id", clientId);

            if (dbError) {
                toast.error("Failed to delete from DB: " + dbError.message);
                return;
            }

            // 2. Queue delete job for ALL devices
            const devices = await getDevices(siteId);

            // Even if no devices, we deleted from DB, so we clear the UI.
            if (devices.length > 0) {
                for (const device of devices) {
                    const { error: jobError } = await supabase.from("jobs").insert({
                        site_id: siteId,
                        client_id: clientId,
                        facial_id: device.id,
                        type: "delete_user",
                        payload: {
                            userID: user.user_id,
                            triggered_by: userEmail
                        },
                        status: "pending"
                    });
                    if (jobError) console.error(`Failed to queue delete for ${device.name}`, jobError);
                }
                toast.success(`Usuário excluído e comando enviado para ${devices.length} dispositivos.`);
            } else {
                toast.success("Usuário excluído do banco (sem dispositivos para sincronizar).");
            }

            // Refresh list
            setUsers(users.filter(u => u.user_id !== user.user_id));

        } catch (err: any) {
            console.error(err);
            toast.error(err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pessoas</h1>
                    <p className="text-muted-foreground">Gerencie moradores, tags e reconhecimento facial.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={fetchUsers}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Link href="/users/create">
                        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                            <Plus className="h-4 w-4" />
                            Adicionar
                        </Button>
                    </Link>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Todos os Usuários</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr className="text-left">
                                    <th className="p-3 font-medium">Nome</th>
                                    <th className="p-3 font-medium">ID</th>
                                    <th className="p-3 font-medium">Unidade</th>
                                    <th className="p-3 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-muted-foreground">Carregando...</td>
                                    </tr>
                                )}
                                {!loading && users.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-muted-foreground">Nenhum usuário encontrado.</td>
                                    </tr>
                                )}
                                {users.map((user) => (
                                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                        <td className="p-3 font-medium">{user.name}</td>
                                        <td className="p-3 text-muted-foreground">{user.user_id}</td>
                                        <td className="p-3">
                                            {user.block || user.apartment ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                                    {user.block} - {user.apartment}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Link href={`/users/edit/${user.user_id}`}>
                                                    <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-600 hover:bg-blue-900/10">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-900/10"
                                                    onClick={() => handleDeleteClick(user)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
                <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-500">
                            <Trash2 className="h-5 w-5" />
                            Confirmar Exclusão
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 pt-2">
                            Tem certeza que deseja remover este usuário?
                            <br />
                            <span className="font-bold text-lg text-white block mt-2">
                                {userToDelete?.name}
                            </span>
                            <span className="text-sm text-zinc-500 block">
                                ID: {userToDelete?.user_id}
                            </span>
                            <span className="text-xs text-zinc-500 block mt-2 pt-2 border-t border-zinc-800">
                                Ele será removido do banco de dados e de todos os dispositivos.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 mt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setUserToDelete(null)}
                            className="text-zinc-400 hover:text-white hover:bg-zinc-900"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={confirmDeleteUser}
                            variant="destructive"
                            className="bg-red-900/50 hover:bg-red-900 text-red-100 border border-red-800"
                        >
                            Confirmar e Excluir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
