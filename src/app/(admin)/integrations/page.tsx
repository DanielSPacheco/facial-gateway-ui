"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WebhookConfigDialog } from "@/components/WebhookConfigDialog";
import { MessageCircle, Settings, Send, Network, Globe } from "lucide-react";
import { toast } from "sonner";

export default function IntegrationsPage() {

    const handleTest = () => {
        toast.info("Teste de envio simulado: Olá do WhatsApp!");
    };

    const handleConfig = () => {
        toast.info("Configuração em breve...");
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
                <p className="text-muted-foreground">Conecte o sistema a serviços externos.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* WHATSAPP CARD */}
                <Card className="border-l-4 border-l-green-500 shadow-md">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-full">
                                    <MessageCircle className="h-6 w-6 text-green-600 dark:text-green-500" />
                                </div>
                                <CardTitle className="text-xl">WhatsApp</CardTitle>
                            </div>
                            <Badge className="bg-green-500 hover:bg-green-600">Conectado</Badge>
                        </div>
                        <CardDescription className="pt-2">
                            Envio de alertas e notificações em tempo real.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p>• Notificações de acesso</p>
                            <p>• Alertas de segurança</p>
                            <p>• Convites para visitantes</p>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between gap-2">
                        <Button variant="outline" className="w-full gap-2" onClick={handleConfig}>
                            <Settings className="h-4 w-4" />
                            Configurar
                        </Button>
                        <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={handleTest}>
                            <Send className="h-4 w-4" />
                            Testar envio
                        </Button>
                    </CardFooter>
                </Card>

                {/* WEBHOOK CARD */}
                <Card className="border-l-4 border-l-yellow-500 shadow-md">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
                                    <Network className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
                                </div>
                                <CardTitle className="text-xl">Webhook</CardTitle>
                            </div>
                            <Badge variant="outline" className="text-yellow-600 border-yellow-500 bg-yellow-50/50">Configurável</Badge>
                        </div>
                        <CardDescription className="pt-2">
                            Envie eventos do GateFlow para sistemas externos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p>• Notificações via HTTP POST</p>
                            <p>• Integração com Zapier/n8n</p>
                            <p>• Log de eventos brutos</p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <WebhookConfigDialog
                            trigger={
                                <Button className="w-full gap-2 bg-yellow-600 hover:bg-yellow-700 text-white">
                                    <Globe className="h-4 w-4" />
                                    Configurar
                                </Button>
                            }
                        />
                    </CardFooter>
                </Card>


                {/* API CARD */}
                <Card className="border-l-4 border-l-blue-500 shadow-md">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                                    <Globe className="h-6 w-6 text-blue-600 dark:text-blue-500" />
                                </div>
                                <CardTitle className="text-xl">API GateFlow</CardTitle>
                            </div>
                            <Badge className="bg-blue-500 hover:bg-blue-600">Ativa</Badge>
                        </div>
                        <CardDescription className="pt-2">
                            API REST para integração com ERPs e apps.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p>• Gestão de Usuários e Unidades</p>
                            <p>• Controle de Acesso Remoto</p>
                            <p>• Logs e Auditoria</p>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between gap-2">
                        <Button variant="outline" className="w-full gap-2" onClick={() => toast.info("Documentação em: https://docs.gateflow.com")}>
                            <Settings className="h-4 w-4" />
                            Ver Docs
                        </Button>
                        <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => toast.success("API Key gerada: sk_live_...")}>
                            <Network className="h-4 w-4" />
                            Gerar Key
                        </Button>
                    </CardFooter>
                </Card>

                {/* Placeholder for future integrations */}
                <Card className="opacity-60 border-dashed">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                                    <Settings className="h-6 w-6 text-gray-500" />
                                </div>
                                <CardTitle className="text-xl">Telegram</CardTitle>
                            </div>
                            <Badge variant="outline">Em Breve</Badge>
                        </div>
                        <CardDescription className="pt-2">
                            Bot para comandos e registros.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button variant="ghost" disabled className="w-full">Indisponível</Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
