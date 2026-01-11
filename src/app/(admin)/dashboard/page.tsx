"use client";

import { useState } from "react";
import { DeviceStatusGrid } from "@/components/DeviceStatusGrid";
import { ActiveUsersStats } from "@/components/ActiveUsersStats";
import { RecentLogsCard } from "@/components/RecentLogsCard";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function Dashboard() {
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setLastRefreshed(new Date());
        // Artificial delay to show spinner, as effective data fetching happens in children
        await new Promise(resolve => setTimeout(resolve, 800));
        setIsRefreshing(false);
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <div className="text-sm text-muted-foreground">
                        Enterprise Mode
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>

            {/* Status List - Vertical Layout */}
            <DeviceStatusGrid lastRefreshed={lastRefreshed} />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Stats Example */}
                <ActiveUsersStats lastRefreshed={lastRefreshed} />

                {/* Recent Logs (Spans 2 columns) */}
                <RecentLogsCard lastRefreshed={lastRefreshed} />
            </div>
        </div>
    );
}
