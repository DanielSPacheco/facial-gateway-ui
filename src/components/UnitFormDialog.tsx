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
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { toast } from "sonner";

interface UnitFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    unitToEdit?: any; // If present, we are editing
    onSuccess: () => void;
}

export function UnitFormDialog({ open, onOpenChange, unitToEdit, onSuccess }: UnitFormDialogProps) {
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        block: "",
        name: "", // Apartment number/name
        responsibleId: ""
    });

    // Load available users for "Responsible" select
    useEffect(() => {
        if (open) {
            fetchUsers();
            if (unitToEdit) {
                setFormData({
                    block: unitToEdit.block,
                    name: unitToEdit.name,
                    responsibleId: unitToEdit.responsible_id || ""
                });
            } else {
                setFormData({ block: "", name: "", responsibleId: "" });
            }
        }
    }, [open, unitToEdit]);

    const fetchUsers = async () => {
        const { siteId } = await getSiteContext();
        const { data } = await supabase
            .from("users")
            .select("id, name, user_id")
            // .eq("client_id", siteId) // Relaxed filter to match UsersPage behavior (relying on RLS or getting all for MVP)
            .order("name");
        if (data) setUsers(data);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { siteId } = await getSiteContext();

            if (unitToEdit) {
                // Update
                const { error } = await supabase
                    .from("units")
                    .update({
                        block: formData.block,
                        name: formData.name,
                        responsible_id: formData.responsibleId || null
                    })
                    .eq("id", unitToEdit.id);

                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from("units")
                    .insert({
                        site_id: siteId,
                        block: formData.block,
                        name: formData.name,
                        responsible_id: formData.responsibleId || null
                    });

                if (error) throw error;
            }

            // SYNC: Update the assigned user's profile with this address
            if (formData.responsibleId) {
                const { error: userError } = await supabase
                    .from("users")
                    .update({
                        block: formData.block,
                        apartment: formData.name
                    })
                    .eq("id", formData.responsibleId);

                if (userError) {
                    console.error("Failed to sync user address:", userError);
                    toast.warning("Unidade salva, mas erro ao atualizar endereço do morador.");
                }
            }

            toast.success(unitToEdit ? "Unidade atualizada!" : "Unidade criada!");

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
                    <DialogTitle>{unitToEdit ? "Editar Unidade" : "Adicionar Nova Unidade"}</DialogTitle>
                    <DialogDescription>
                        Preencha os dados da unidade (Bloco e Apartamento).
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSave} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Bloco</Label>
                            <Input
                                placeholder="Ex: Bloco A"
                                value={formData.block}
                                onChange={(e) => setFormData({ ...formData, block: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Unidade / Apto</Label>
                            <Input
                                placeholder="Ex: 101"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Responsável (Opcional)</Label>
                        <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                            value={formData.responsibleId}
                            onChange={(e) => setFormData({ ...formData, responsibleId: e.target.value })}
                        >
                            <option value="">Selecione um morador...</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name} (ID: {u.user_id})
                                </option>
                            ))}
                        </select>
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
