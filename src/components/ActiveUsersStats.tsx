"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export function ActiveUsersStats({ lastRefreshed }: { lastRefreshed?: Date }) {
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        async function fetchCount() {
            try {
                // Get Site ID
                const { siteId } = await getSiteContext();

                // Count users linked to this site (via client_id mostly, but we filter by site context usually? 
                // Actually users table has client_id. The system seems to filter mostly by client_id in getSiteContext logic for users?)
                // Let's check how users are filtered. in `src/app/(admin)/users/page.tsx` it typically filters by `client_id` or just lists all for the tenant.
                // Based on `users/page.tsx` (which I read previously), it uses `users` table. 
                // Let's count all users for now, or filter by client_id if available.
                // The `getSiteContext` returns `clientId`.

                const { clientId } = await getSiteContext();

                const { count, error } = await supabase
                    .from("users")
                    .select("*", { count: 'exact', head: true })
                    .eq("client_id", clientId);

                if (error) throw error;
                setCount(count);

            } catch (e) {
                console.error("Failed to count users", e);
            }
        }
        fetchCount();
    }, [lastRefreshed]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    Usuários Ativos
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    {count !== null ? count : "--"}
                </div>
                <p className="text-xs text-muted-foreground">
                    Base sincronizada
                </p>
            </CardContent>
        </Card>
    );
}
