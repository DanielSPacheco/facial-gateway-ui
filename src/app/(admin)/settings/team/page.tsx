"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Shield, ShieldCheck, Wrench } from "lucide-react";
import { getSiteContext } from "@/lib/site-context";
import { toast } from "sonner";
import { SystemUserDialog } from "@/components/SystemUserDialog";

export default function TeamPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    const fetchTeam = async () => {
        setLoading(true);
        const { siteId } = await getSiteContext();

        // Fetch System Users (Role != resident or is null? No, strictly system roles)
        // If role is null, we assume resident for now, or we should have migrated.
        // We will fetch where role in ('admin', 'operator', 'integrator')

        const { data, error } = await supabase
            .from("users")
            .select("*")
            //.eq("client_id", siteId) // Optional depending on if System Users are global or per site. Assuming per site/client.
            .in('role', ['admin', 'operator', 'integrator'])
            .order("name");

        if (error) {
            console.error("Error fetching team:", error);
            toast.error("Erro ao carregar equipe.");
        } else {
            setUsers(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTeam();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja remover este membro da equipe?")) return;

        const { error } = await supabase.from("users").delete().eq("id", id);
        if (error) {
            toast.error("Erro ao deletar: " + error.message);
        } else {
            toast.success("Membro removido.");
            fetchTeam();
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-red-200 gap-1"><ShieldCheck className="w-3 h-3" />Admin</Badge>;
            case 'integrator':
                return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200 gap-1"><Wrench className="w-3 h-3" />Integrador</Badge>;
            case 'operator':
                return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 gap-1"><Shield className="w-3 h-3" />Operador</Badge>;
            default:
                return <Badge variant="outline">{role}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Usuários do Sistema</h1>
                    <p className="text-muted-foreground">Gerencie acesso administrativo e operacional.</p>
                </div>
                <Button onClick={() => { setSelectedUser(null); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Membro
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Membros da Equipe</CardTitle>
                    <CardDescription>
                        Lista de usuários com permissão de acesso ao sistema.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Função</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            Carregando...
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!loading && users.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            Nenhum membro encontrado. Adicione o primeiro.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>{user.email || "-"}</TableCell>
                                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => { setSelectedUser(user); setDialogOpen(true); }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-600"
                                                    onClick={() => handleDelete(user.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <SystemUserDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                userToEdit={selectedUser}
                onSuccess={fetchTeam}
            />
        </div>
    );
}
