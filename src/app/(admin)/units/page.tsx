"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Plus, Search, Pencil, Trash2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnitFormDialog } from "@/components/UnitFormDialog";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Unit {
    id: string;
    block: string;
    name: string;
    responsible_id?: string;
    responsible?: { name: string };
}

export default function UnitsPage() {
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<Unit | undefined>(undefined);

    const fetchUnits = useCallback(async () => {
        setLoading(true);
        try {
            const { siteId } = await getSiteContext();

            const { data, error } = await supabase
                .from("units")
                .select(`
                    id, 
                    block, 
                    name, 
                    responsible_id,
                    responsible:users!responsible_id(name)
                `)
                .eq("site_id", siteId)
                .order("block", { ascending: true })
                .order("name", { ascending: true });

            if (error) throw error;
            // The type assertion is needed because Supabase join returns an array or object depending on relation
            // We know responsible is a single object here effectively
            const formattedData = (data as any[]).map(d => ({
                ...d,
                responsible: d.responsible // Keep it as object or flattened
            }));

            setUnits(formattedData);
        } catch (e: any) {
            console.error(e);
            toast.error("Failed to load units");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUnits();
    }, [fetchUnits]);

    const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);

    const handleDeleteClick = (unit: Unit) => {
        setUnitToDelete(unit);
    };

    const confirmDelete = async () => {
        if (!unitToDelete) return;
        const id = unitToDelete.id;
        setUnitToDelete(null);

        try {
            const { error } = await supabase.from("units").delete().eq("id", id);
            if (error) throw error;
            toast.success("Unidade removida");
            fetchUnits();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const handleEdit = (unit: Unit) => {
        setEditingUnit(unit);
        setDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingUnit(undefined);
        setDialogOpen(true);
    };

    const filteredUnits = units.filter(u =>
        u.block.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Unidades</h1>
                    <p className="text-muted-foreground">Gerencie blocos e apartamentos do condomínio.</p>
                </div>
                <Button onClick={handleCreate} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-4 w-4" />
                    Adicionar Unidade
                </Button>
            </div>

            <Card className="bg-card">
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Building className="h-5 w-5 text-primary" />
                            Lista de Unidades
                        </CardTitle>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar bloco ou apto..."
                                className="pl-8 h-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr className="text-left">
                                    <th className="p-3 font-medium">Bloco</th>
                                    <th className="p-3 font-medium">Unidade</th>
                                    <th className="p-3 font-medium">Responsável</th>
                                    <th className="p-3 font-medium">Situação</th>
                                    <th className="p-3 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando...</td>
                                    </tr>
                                )}
                                {!loading && filteredUnits.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                                            Nenhuma unidade encontrada.
                                        </td>
                                    </tr>
                                )}
                                {filteredUnits.map((unit) => (
                                    <tr key={unit.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                        <td className="p-3 font-medium text-muted-foreground">{unit.block}</td>
                                        <td className="p-3 font-bold text-lg">{unit.name}</td>
                                        <td className="p-3">
                                            {unit.responsible?.name ? (
                                                <span className="text-foreground font-medium">{unit.responsible.name}</span>
                                            ) : (
                                                <span className="text-muted-foreground text-xs italic">Não atribuído</span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                                                Ativo
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(unit)}>
                                                    <Pencil className="h-4 w-4 text-blue-500" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(unit)}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
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

            <UnitFormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                unitToEdit={editingUnit}
                onSuccess={fetchUnits}
            />

            <Dialog open={!!unitToDelete} onOpenChange={(open) => !open && setUnitToDelete(null)}>
                <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-500">
                            <Trash2 className="h-5 w-5" />
                            Confirmar Exclusão
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 pt-2">
                            Tem certeza que deseja remover esta unidade?
                            <br />
                            <span className="font-bold text-lg text-white block mt-2">
                                {unitToDelete?.block} - {unitToDelete?.name}
                            </span>
                            <span className="text-xs text-zinc-500 block mt-1">
                                Isso não remove o usuário associado, apenas o registro do apartamento.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 mt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setUnitToDelete(null)}
                            className="text-zinc-400 hover:text-white hover:bg-zinc-900"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={confirmDelete}
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
