"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building } from "lucide-react";

interface UnitGroup {
    block: string;
    apartment: string;
    count: number;
    residents: { name: string; id: string }[];
}

export default function UnitsPage() {
    const [units, setUnits] = useState<UnitGroup[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUnits = async () => {
        setLoading(true);
        try {
            const { siteId } = await getSiteContext();

            // Fetch users with block and apartment
            const { data } = await supabase
                .from("users")
                .select("user_id, name, block, apartment")
                .eq("client_id", siteId) // Using siteId as client_id for now as per context
                .not("block", "is", null)
                .not("apartment", "is", null)
                .order("block", { ascending: true })
                .order("apartment", { ascending: true });

            if (data) {
                // Group by Block/Apt
                const groups: { [key: string]: UnitGroup } = {};

                data.forEach(user => {
                    const key = `${user.block}-${user.apartment}`;
                    if (!groups[key]) {
                        groups[key] = {
                            block: user.block,
                            apartment: user.apartment,
                            count: 0,
                            residents: []
                        };
                    }
                    groups[key].count++;
                    groups[key].residents.push({ name: user.name, id: user.user_id });
                });

                setUnits(Object.values(groups));
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUnits();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Unidades</h1>
                <p className="text-muted-foreground">Visão geral dos moradores por bloco e apartamento.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {loading && <p className="text-muted-foreground">Carregando unidades...</p>}

                {!loading && units.length === 0 && (
                    <div className="col-span-full text-center py-10 text-muted-foreground border border-dashed rounded-lg">
                        Nenhuma unidade cadastrada. Adicione usuários com Bloco e Apartamento.
                    </div>
                )}

                {units.map((unit) => (
                    <Card key={`${unit.block}-${unit.apartment}`} className="bg-card hover:bg-muted/10 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Building className="h-5 w-5 text-primary" />
                                {unit.block}
                            </CardTitle>
                            <Badge variant="secondary" className="text-base px-3">
                                Apt {unit.apartment}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                <Users className="h-4 w-4" />
                                <span>{unit.count} Morador(es)</span>
                            </div>
                            <div className="space-y-1">
                                {unit.residents.map(res => (
                                    <div key={res.id} className="text-sm px-2 py-1 rounded-md bg-muted/50">
                                        {res.name}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
