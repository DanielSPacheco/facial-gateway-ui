"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck } from "lucide-react";

export function ActiveUsersCard() {
    const [count, setCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCount = async () => {
            try {
                const { clientId } = await getSiteContext();

                const { count, error } = await supabase
                    .from("users")
                    .select("*", { count: 'exact', head: true })
                    .eq("client_id", clientId); // Users are linked to client, not site directly

                if (error) throw error;

                setCount(count);
            } catch (e) {
                console.error("Error fetching user count:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchCount();
    }, []);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    Usuários Ativos
                </CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    {loading ? "--" : count !== null ? count : 0}
                </div>
                <p className="text-xs text-muted-foreground">
                    Carregados do Banco de Dados
                </p>
            </CardContent>
        </Card>
    );
}
