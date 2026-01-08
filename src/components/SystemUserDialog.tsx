"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { toast } from "sonner";

interface SystemUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userToEdit?: any;
    onSuccess: () => void;
}

export function SystemUserDialog({ open, onOpenChange, userToEdit, onSuccess }: SystemUserDialogProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        role: "operator" // default
    });

    useEffect(() => {
        if (open) {
            if (userToEdit) {
                setFormData({
                    name: userToEdit.name,
                    email: userToEdit.email || "",
                    role: userToEdit.role || "operator"
                });
            } else {
                setFormData({ name: "", email: "", role: "operator" });
            }
        }
    }, [open, userToEdit]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { siteId, clientId } = await getSiteContext();

            // Prepare payload
            const payload = {
                name: formData.name,
                email: formData.email,
                role: formData.role,
                client_id: clientId,
                user_id: userToEdit ? userToEdit.user_id : `sys_${Date.now()}`, // Temporary ID generation for system users if not standard
                // System users might not need 'user_id' for devices, but the schema requires it. 
                // We'll generate a dummy one or use UUID if schema allows. Schema says user_id text not null unique.
            };

            if (userToEdit) {
                const { error } = await supabase
                    .from("users")
                    .update({
                        name: formData.name,
                        email: formData.email,
                        role: formData.role
                    })
                    .eq("id", userToEdit.id);

                if (error) throw error;
                toast.success("Usuário atualizado com sucesso");
            } else {
                const { error } = await supabase
                    .from("users")
                    .insert(payload);

                if (error) throw error;
                toast.success("Usuário criado com sucesso");
            }

            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            console.error(err);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{userToEdit ? "Editar Membro" : "Novo Membro da Equipe"}</DialogTitle>
                    <DialogDescription>
                        Adicione administradores, operadores ou integradores.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSave} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nome Completo</Label>
                        <Input
                            placeholder="Ex: João Admin"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Email (Login)</Label>
                        <Input
                            type="email"
                            placeholder="joao@exemplo.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Função / Permissão</Label>
                        <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        >
                            <option value="operator">Operador (Básico)</option>
                            <option value="admin">Administrador (Total)</option>
                            <option value="integrator">Integrador (Técnico)</option>
                        </select>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <ShieldAlert className="h-3 w-3" />
                            <span>
                                {formData.role === 'admin' && "Acesso total a configurações e usuários."}
                                {formData.role === 'operator' && "Gerenciar moradores e ver logs."}
                                {formData.role === 'integrator' && "Configurar dispositivos e API."}
                            </span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="gap-2">
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
