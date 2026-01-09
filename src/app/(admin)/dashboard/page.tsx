import { OpenDoorButton } from "@/components/OpenDoorButton";
import { AgentStatusCard } from "@/components/AgentStatusCard";
import { DashboardHistory } from "@/components/DashboardHistory";
import { ActiveUsersCard } from "@/components/ActiveUsersCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
    return (
        <div className="p-8 space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Painel de Controle</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <AgentStatusCard />

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Ações Rápidas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-2">
                            <OpenDoorButton />
                            <p className="text-xs text-muted-foreground mt-2">
                                Clique para acionar a abertura remota da porta.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Placeholder for stats */}
                {/* Active Users */}
                <ActiveUsersCard />

                {/* Quick History Section */}
                <DashboardHistory />
            </div>
        </div>
    );
}
