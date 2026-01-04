"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

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
        const { data, error } = await supabase.from("users").select("*").order("user_id");

        if (error) {
            console.error("Error fetching users:", error);
        } else {
            setUsers(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleDelete = async (userId: string) => {
        if (!confirm("Are you sure you want to delete this user? This will queue a delete job.")) return;

        try {
            const { siteId, clientId } = await getSiteContext();

            // 1. Delete from public.users (DB)
            const { error: dbError } = await supabase
                .from("users")
                .delete()
                .eq("user_id", userId)
                .eq("client_id", clientId);

            if (dbError) {
                toast.error("Failed to delete from DB: " + dbError.message);
                return;
            }

            // 2. Queue delete job for Device
            const { error: jobError } = await supabase.from("jobs").insert({
                site_id: siteId,
                client_id: clientId,
                type: "delete_user",
                payload: { userID: userId },
                status: "pending"
            });

            if (jobError) {
                toast.error("User deleted from DB, but failed to queue device job: " + jobError.message);
            } else {
                toast.success("User deleted successfully");
                // Refresh list
                setUsers(users.filter(u => u.user_id !== userId));
            }
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
                                                    onClick={() => handleDelete(user.user_id)}
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
        </div>
    );
}
