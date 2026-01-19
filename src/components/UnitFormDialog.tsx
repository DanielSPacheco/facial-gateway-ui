"use client";

import { useEffect, useState } from "react";
import { Trash2, Loader2, Save } from "lucide-react";
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
    const [users, setUsers] = useState<any[]>([]); // All available users to add
    const [residents, setResidents] = useState<any[]>([]); // Current residents of this unit (fetched dynamically)

    const [formData, setFormData] = useState({
        block: "",
        name: "", // Apartment number/name
        responsibleId: ""
    });

    // Load available users for "Responsible" select and Add Resident search
    useEffect(() => {
        if (open) {
            fetchUsers();
            if (unitToEdit) {
                setFormData({
                    block: unitToEdit.block,
                    name: unitToEdit.name,
                    responsibleId: unitToEdit.responsible_id || ""
                });
                // Fetch residents immediately if editing
                fetchResidents(unitToEdit.block, unitToEdit.name);
            } else {
                setFormData({ block: "", name: "", responsibleId: "" });
                setResidents([]);
            }
        }
    }, [open, unitToEdit]);

    const fetchUsers = async () => {
        const { siteId } = await getSiteContext();
        const { data } = await supabase
            .from("users")
            .select("id, name, user_id, block, apartment")
            .order("name");
        if (data) setUsers(data);
    };

    const fetchResidents = async (block: string, name: string) => {
        if (!block || !name) return;
        const { siteId } = await getSiteContext();
        const { data } = await supabase
            .from("users")
            .select("id, name, user_id")
            .eq("block", block)
            .eq("apartment", name)
            .order("name");

        if (data) setResidents(data);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { siteId } = await getSiteContext();
            let finalUnitId = unitToEdit?.id;

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
                const { data, error } = await supabase
                    .from("units")
                    .insert({
                        site_id: siteId,
                        block: formData.block,
                        name: formData.name,
                        responsible_id: formData.responsibleId || null
                    })
                    .select("id")
                    .single();

                if (error) throw error;
                finalUnitId = data.id;
            }

            // SYNC 1: Update the NEW assigned user's profile with this address (Primary Contact)
            if (formData.responsibleId) {
                const { error: userError } = await supabase
                    .from("users")
                    .update({
                        block: formData.block,
                        apartment: formData.name
                    })
                    .eq("id", formData.responsibleId);

                if (userError) toast.warning("Erro ao atualizar endereço do responsável.");
            }

            // SYNC 2: If we CHANGED the responsible person, clear the OLD person's address
            // NOTE: With multi-resident support, clearing the old responsible might be WRONG if they are still a resident.
            // Only clear IF they are NOT in the residents list anymore?
            // Actually, for simplicity and safety in this transition: 
            // If I change responsible from A to B, A is effectively demoted. A should ideally stay as resident if physically there.
            // But the Plan said: "Update users table for new responsible". 
            // Let's rely on the "Add Resident" flow for others.
            // If I simply change the dropdown, I ensure the NEW ONE is at the address. 
            // I won't auto-remove the old one in this logic block, because they might be a spouse.

            toast.success(unitToEdit ? "Unidade atualizada!" : "Unidade criada!");

            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            console.error(err);
            if (err.code === '23505' || err.message?.includes('violates unique constraint')) {
                toast.error("Unidade já cadastrada! Verifique o Bloco e Número.");
            } else {
                toast.error(err.message || "Erro ao salvar unidade");
            }
        } finally {
            setLoading(false);
        }
    };

    // --- Single-click actions for residents (Only available in Edit Mode ideally, or after save) ---
    const addResident = async (userId: string) => {
        if (!formData.block || !formData.name) {
            toast.error("Defina Bloco e Unidade antes de adicionar moradores.");
            return;
        }

        // Update User
        const { error } = await supabase.from("users").update({
            block: formData.block,
            apartment: formData.name
        }).eq("id", userId);

        if (error) {
            toast.error("Erro ao adicionar morador");
        } else {
            toast.success("Morador adicionado!");
            fetchResidents(formData.block, formData.name);
            // Also refresh available users list just in case
            fetchUsers();
        }
    };

    const removeResident = async (userId: string) => {
        const { error } = await supabase.from("users").update({
            block: null,
            apartment: null
        }).eq("id", userId);

        if (error) {
            toast.error("Erro ao remover morador");
        } else {
            toast.success("Morador removido da unidade.");
            fetchResidents(formData.block, formData.name);
            if (formData.responsibleId === userId) {
                // If we removed the responsible, clear that field locally
                setFormData(prev => ({ ...prev, responsibleId: "" }));
                // And consider saving? No, let user save form to confirm removal of responsibility.
            }
        }
    };

    const setAsResponsible = (userId: string) => {
        setFormData({ ...formData, responsibleId: userId });
        toast.info("Marcado como Responsável (Salvar para confirmar).");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{unitToEdit ? "Gerenciar Unidade" : "Adicionar Nova Unidade"}</DialogTitle>
                    <DialogDescription>
                        Configure o bloco, apartamento e os moradores vinculados.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSave} className="space-y-6 py-4">
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
                        <Label>Responsável Principal (Do Boleto/Contato)</Label>
                        <div className="flex gap-2">
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                                value={formData.responsibleId}
                                onChange={(e) => setFormData({ ...formData, responsibleId: e.target.value })}
                            >
                                <option value="">Sem Responsável definido</option>
                                {residents.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} (ID: {u.user_id})
                                    </option>
                                ))}
                                {/* Fallback if responsible is NOT in residents list yet? Should strict sync. */}
                            </select>
                        </div>
                        <p className="text-[0.8rem] text-muted-foreground">
                            Selecione quem responde legalmente pela unidade.
                        </p>
                    </div>

                    {/* Residents List */}
                    {unitToEdit && (
                        <div className="space-y-3 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-semibold">Moradores ({residents.length})</Label>
                                {/* Quick Add Dropdown */}
                                <select
                                    className="w-[200px] h-8 text-sm rounded-md border bg-transparent px-2"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            addResident(e.target.value);
                                            e.target.value = ""; // reset
                                        }
                                    }}
                                >
                                    <option value="">+ Adicionar Pessoa...</option>
                                    {users.filter(u =>
                                        // Filter out already residents
                                        !residents.find(r => r.id === u.id)
                                    ).map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.user_id})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                                {residents.length === 0 && (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        Nenhum morador nesta unidade.
                                    </div>
                                )}
                                {residents.map(r => (
                                    <div key={r.id} className="p-2 flex items-center justify-between hover:bg-muted/50">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                {r.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{r.name}</p>
                                                <p className="text-xs text-muted-foreground">ID: {r.user_id}</p>
                                            </div>
                                            {r.id === formData.responsibleId && (
                                                <span className="text-[10px] bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded border border-yellow-500/30">
                                                    Responsável
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {r.id !== formData.responsibleId && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-yellow-500"
                                                    title="Tornar Responsável"
                                                    onClick={() => setAsResponsible(r.id)}
                                                >
                                                    <Loader2 className="h-3 w-3 opacity-0" /> {/* Hack for spacing if needed, or star icon */}
                                                    ★
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-red-500 hover:bg-red-500/10"
                                                title="Remover da Unidade"
                                                onClick={() => removeResident(r.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!unitToEdit && (
                        <div className="p-4 bg-yellow-500/10 text-yellow-500 rounded border border-yellow-500/20 text-sm">
                            Salve a unidade primeiro para adicionar múltiplos moradores.
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="gap-2">
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
