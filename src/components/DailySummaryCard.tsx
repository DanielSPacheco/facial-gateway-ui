"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, User, Unlock, Globe, CreditCard } from "lucide-react"; // Icons
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";

interface SummaryStats {
    totalFacial: number;
    totalRemote: number;
    totalCard: number;
    totalOthers: number;
    totalEvents: number;
}

export function DailySummaryCard({ lastRefreshed }: { lastRefreshed: Date }) {
    const [stats, setStats] = useState<SummaryStats>({
        totalFacial: 0,
        totalRemote: 0,
        totalCard: 0,
        totalOthers: 0,
        totalEvents: 0
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDailyStats();
    }, [lastRefreshed]);

    const fetchDailyStats = async () => {
        setLoading(true);
        try {
            const { siteId } = await getSiteContext();

            // 1. Get Date Range (Today)
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

            // 2. Fetch Remote Openings (Supabase Jobs)
            // Type: open_door, Status: done (or we can count all triggered)
            const { count: remoteCount, error: jobError } = await supabase
                .from("jobs")
                .select("*", { count: 'exact', head: true })
                .eq("site_id", siteId)
                .eq("type", "open_door")
                .gte("created_at", startOfDay)
                .lte("created_at", endOfDay);

            // 3. Fetch Device Audit Events (Facial, Card, etc.)
            // We need to fetch from ALL devices or just the first valid one?
            // Ideally all. Let's get devices first.
            const { data: devices } = await supabase
                .from("facials")
                .select("ip")
                .eq("site_id", siteId);

            let facialCount = 0;
            let cardCount = 0;
            let otherCount = 0;

            if (devices && devices.length > 0) {
                // Fetch in parallel for all devices
                const promises = devices.map(async (dev) => {
                    try {
                        // Assuming backend port 4000
                        const url = `http://127.0.0.1:4000/facial/audit/access/${dev.ip}?from=${startOfDay}&to=${endOfDay}&limit=1000`;
                        const res = await fetch(url);
                        if (!res.ok) return [];
                        const data = await res.json();
                        return data.ok ? data.records : [];
                    } catch (e) {
                        console.error(`Failed to fetch stats for ${dev.ip}`, e);
                        return [];
                    }
                });

                const results = await Promise.all(promises);
                const allRecords = results.flat();

                allRecords.forEach((rec: any) => {
                    if (rec.method === 15) {
                        facialCount++;
                    } else if (rec.cardLast4) {
                        cardCount++;
                    } else {
                        otherCount++;
                    }
                });
            }

            setStats({
                totalFacial: facialCount,
                totalRemote: remoteCount || 0,
                totalCard: cardCount,
                totalOthers: otherCount,
                totalEvents: facialCount + (remoteCount || 0) + cardCount + otherCount
            });

        } catch (error) {
            console.error("Error fetching daily stats", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-4">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Resumo Diário
                </CardTitle>
                <CardDescription>
                    Atividades registradas hoje
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Facial */}
                    <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2 text-blue-400">
                            <User className="h-5 w-5" />
                            <span className="font-medium text-sm">Facial</span>
                        </div>
                        <span className="text-3xl font-bold">{loading ? "-" : stats.totalFacial}</span>
                        <span className="text-xs text-muted-foreground">Acessos</span>
                    </div>

                    {/* Remote */}
                    <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2 text-green-400">
                            <Globe className="h-5 w-5" />
                            <span className="font-medium text-sm">Remoto</span>
                        </div>
                        <span className="text-3xl font-bold">{loading ? "-" : stats.totalRemote}</span>
                        <span className="text-xs text-muted-foreground">Aberturas</span>
                    </div>

                    {/* Card */}
                    <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2 text-orange-400">
                            <CreditCard className="h-5 w-5" />
                            <span className="font-medium text-sm">Cartão</span>
                        </div>
                        <span className="text-3xl font-bold">{loading ? "-" : stats.totalCard}</span>
                        <span className="text-xs text-muted-foreground">Acessos</span>
                    </div>

                    {/* Others */}
                    <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                            <Unlock className="h-5 w-5" />
                            <span className="font-medium text-sm">Outros</span>
                        </div>
                        <span className="text-3xl font-bold">{loading ? "-" : stats.totalOthers}</span>
                        <span className="text-xs text-muted-foreground">Eventos</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
