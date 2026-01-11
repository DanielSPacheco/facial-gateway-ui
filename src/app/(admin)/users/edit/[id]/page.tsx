"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, Save, CreditCard, Upload, Camera, AlertTriangle, CheckCircle2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { FaceUpload } from "@/components/FaceUpload";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function EditUserPage() {
    const router = useRouter();
    const params = useParams();
    const userIdDevice = params.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Tab States
    const [activeTab, setActiveTab] = useState("personal");

    // Form Data
    const [formData, setFormData] = useState({
        name: "",
        block: "",
        apartment: "",
        authority: 2 // Default user
    });

    // Card Data
    const [cardNo, setCardNo] = useState("");
    const [cards, setCards] = useState<{ id: string, card_no: string }[]>([]);
    const [cardSaving, setCardSaving] = useState(false);
    const [cardToDelete, setCardToDelete] = useState<{ id: string, card_no: string } | null>(null);

    // Bio Data
    const [photoData, setPhotoData] = useState<string>("");
    const [bioSaving, setBioSaving] = useState(false);

    // Unit Selection State
    const [availableBlocks, setAvailableBlocks] = useState<string[]>([]);
    const [availableUnits, setAvailableUnits] = useState<{ name: string, id: string }[]>([]);
    const [selectedBlock, setSelectedBlock] = useState("");
    const [unitsCache, setUnitsCache] = useState<any[]>([]);

    useEffect(() => {
        const init = async () => {
            await Promise.all([fetchUser(), fetchUnits(), fetchCards()]);
            setLoading(false);
        };
        init();
    }, [userIdDevice]);

    const fetchUser = async () => {
        try {
            const { data, error } = await supabase
                .from("users")
                .select("*, photo_data") // Explicitly ask for photo_data if not included in *
                .eq("user_id", userIdDevice)
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new Error("Usuário não encontrado");

            setFormData({
                name: data.name,
                block: data.block || "",
                apartment: data.apartment || "",
                authority: data.authority || 2
            });

            // Note: Card number might be in DB, but we usually want to overwrite or add new.
            // If we store it, we can show it.
            // if (data.card_no) setCardNo(data.card_no); // Legacy: Don't prefill "New Card" input

            if (data.block) setSelectedBlock(data.block);

            // Existing Photo
            if (data.photo_data) {
                setPhotoData(data.photo_data);
            }
        } catch (e: any) {
            console.error(e);
            toast.error("Erro ao carregar usuário");
            router.push("/users");
        }
    };

    const fetchCards = async () => {
        try {
            const { siteId } = await getSiteContext();
            // We need the internal User UUID, not the devices ID.
            // We can get it from the user fetch or a separate lookup.
            // Assuming we fetch user first, let's store it or just query by user_id(text) if possible?
            // Actually, cards table links to UUID.

            // Allow looking up by joining users? Or just rely on the fact we are on edit page.
            // Let's rely on finding the UUID first.

            // Better strategy: fetchCards called after fetchUser?
            // Or just join.
            const { data } = await supabase
                .from("cards")
                .select("id, card_number, user_id, users!inner(user_id)")
                .eq("site_id", siteId)
                .eq("users.user_id", userIdDevice) // Join filtering
                .order("created_at", { ascending: false });

            if (data) setCards(data.map(d => ({ id: d.id, card_no: d.card_number })));
        } catch (e) {
            console.error("Error fetching cards:", e);
        }
    };

    const fetchUnits = async () => {
        try {
            const { siteId } = await getSiteContext();
            const { data } = await supabase
                .from("units")
                .select("id, block, name")
                .eq("site_id", siteId)
                .order("block")
                .order("name");

            if (data) {
                setUnitsCache(data);
                const blocks = Array.from(new Set(data.map(u => u.block)));
                setAvailableBlocks(blocks as string[]);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Filter units when block changes
    useEffect(() => {
        if (selectedBlock) {
            const filtered = unitsCache
                .filter(u => u.block === selectedBlock)
                .map(u => ({ name: u.name, id: u.id }));
            setAvailableUnits(filtered);
        } else {
            setAvailableUnits([]);
        }
    }, [selectedBlock, unitsCache]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === "block") {
            setSelectedBlock(value);
            setFormData({ ...formData, block: value, apartment: "" });
            return;
        }
        setFormData({ ...formData, [name]: value });
    };

    // --- ACTIONS ---

    const getDevices = async (siteId: string) => {
        const { data } = await supabase.from("facials").select("id, name").eq("site_id", siteId);
        return data || [];
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { siteId, clientId } = await getSiteContext();

            // Get current user for audit
            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = user?.email || "unknown";

            // 1. Update DB
            const { error: dbError } = await supabase
                .from("users")
                .update({
                    name: formData.name,
                    block: formData.block || null,
                    apartment: formData.apartment || null,
                })
                .eq("user_id", userIdDevice)
                .eq("client_id", clientId);

            if (dbError) throw new Error(dbError.message);

            // 2. Queue 'user_update' Job per device
            const devices = await getDevices(siteId);
            if (devices.length === 0) toast.warning("Perfil salvo, mas sem dispositivos para sincronizar.");

            for (const device of devices) {
                const { error: jobError } = await supabase.from("jobs").insert({
                    site_id: siteId,
                    client_id: clientId,
                    facial_id: device.id,
                    type: "user_update",
                    payload: {
                        userID: String(userIdDevice),
                        userName: formData.name,
                        authority: formData.authority,
                        triggered_by: userEmail
                    },
                    priority: 1,
                    max_attempts: 3,
                    status: "pending"
                });
                if (jobError) console.error(`Error syncing user to ${device.name}`, jobError);
            }

            toast.success(`Perfil atualizado e sincronizado para ${devices.length} dispositivos!`);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveCard = async () => {
        if (!cardNo || cardNo.length !== 10) {
            toast.error("Número do cartão inválido (Deve ter exatamente 10 dígitos)");
            return;
        }
        setCardSaving(true);
        try {
            const { siteId, clientId } = await getSiteContext();

            // Get current user for audit
            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = user?.email || "unknown";

            // 1. Insert into public.cards
            const { data: userData } = await supabase.from("users").select("id").eq("user_id", userIdDevice).single();
            if (!userData) throw new Error("User UUID not found");

            const { error: dbError } = await supabase.from("cards").insert({
                site_id: siteId,
                user_id: userData.id,
                card_number: cardNo,
            });

            if (dbError) {
                if (dbError.code === '23505') {
                    // Card exists. If it's this user's, we continue to sync.
                    // If it belongs to another user, DB constraint might have fired.
                    // Assuming 'unique(site_id, card_number)'...
                    // Check if it belongs to THIS user or another.
                    const { data: existing } = await supabase.from("cards").select("user_id").eq("card_number", cardNo).eq("site_id", siteId).single();
                    if (existing && existing.user_id !== userData.id) {
                        toast.error("Este cartão já está cadastrado para OUTRO usuário.");
                        setCardSaving(false);
                        return;
                    }
                    toast.info("Cartão já existente. Ressincronizando com dispositivos...");
                } else {
                    throw new Error(dbError.message);
                }
            }

            // 2. Queue 'card_add' Job per device
            const devices = await getDevices(siteId);
            for (const device of devices) {
                const { error: jobError } = await supabase.from("jobs").insert({
                    site_id: siteId,
                    client_id: clientId,
                    facial_id: device.id,
                    type: "card_add",
                    payload: {
                        userID: String(userIdDevice),
                        cardNo: String(cardNo).replace(/\D/g, ""),
                        triggered_by: userEmail
                    },
                    priority: 1,
                    max_attempts: 3,
                    status: "pending"
                });
                if (jobError) console.error(`Error syncing card to ${device.name}`, jobError);
            }

            toast.success(`Cartão sincronizado!`);
            setCardNo("");
            fetchCards(); // Refresh list

        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setCardSaving(false);
        }
    };

    const handleDeleteCardClick = (card: { id: string, card_no: string }) => {
        setCardToDelete(card);
    };

    const confirmDeleteCard = async () => {
        if (!cardToDelete) return;
        const card = cardToDelete;
        setCardToDelete(null); // Close modal

        try {
            const { siteId, clientId } = await getSiteContext();

            // Get current user for audit
            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = user?.email || "unknown";

            // 1. Remove from DB
            await supabase.from("cards").delete().eq("id", card.id);

            // 2. Queue 'card_delete' Job per device
            const devices = await getDevices(siteId);
            for (const device of devices) {
                const { error: jobError } = await supabase.from("jobs").insert({
                    site_id: siteId,
                    client_id: clientId,
                    facial_id: device.id,
                    type: "card_delete",
                    payload: {
                        userID: String(userIdDevice),
                        cardNo: card.card_no,
                        triggered_by: userEmail
                    },
                    priority: 1,
                    max_attempts: 3,
                    status: "pending"
                });
                if (jobError) console.error(`Error removing card from ${device.name}`, jobError);
            }

            toast.success(`Cartão removido e comando enviado para dispositivos.`);
            fetchCards();

        } catch (err: any) {
            toast.error("Erro ao remover cartão: " + err.message);
        }
    };

    const handleUploadFace = async () => {
        if (!photoData) {
            toast.error("Selecione uma foto primeiro.");
            return;
        }

        setBioSaving(true);
        try {
            const { siteId, clientId } = await getSiteContext();

            // Get current user for audit
            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = user?.email || "unknown";

            // 1. Queue Job per device
            const devices = await getDevices(siteId);
            if (devices.length === 0) {
                toast.warning("Sem dispositivos online para enviar a foto.");
                setBioSaving(false);
                return;
            }

            for (const device of devices) {
                const { error: jobError } = await supabase.from("jobs").insert({
                    site_id: siteId,
                    client_id: clientId,
                    facial_id: device.id,
                    type: "face_upload_base64",
                    payload: {
                        userID: String(userIdDevice),
                        photoData: photoData,
                        triggered_by: userEmail
                    },
                    priority: 1,
                    max_attempts: 3,
                    status: "pending"
                });
                if (jobError) console.error(`Failed to send face to ${device.name}`, jobError);
            }

            toast.success(`Foto enviada para fila de sincronização (${devices.length} dispositivos).`);
            // We removed strict polling because iterating multiple devices makes it complex. 
            // The user can check status in "Logs" or we rely on "Enterprise Reliability".

        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBioSaving(false);
        }
    };

    if (loading) return <div className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{formData.name || "Editando Usuário"}</h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        ID do Dispositivo: <span className="font-mono bg-muted px-1 rounded">{userIdDevice}</span>
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/users")}>Voltar</Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-[600px] mb-4 bg-gray-900/50 p-1">
                    <TabsTrigger value="personal">Dados pessoais</TabsTrigger>
                    <TabsTrigger value="unit">Unidade</TabsTrigger>
                    <TabsTrigger value="card">Cartão / Tag</TabsTrigger>
                    <TabsTrigger value="biometry">Biometria</TabsTrigger>
                </TabsList>

                {/* --- PERSONAL & UNIT Tab (Combined Form for UX flow, but separated in UI) --- */}
                {/* Actually, user might save independently? Let's keep one main save for Profile */}

                <TabsContent value="personal">
                    <form onSubmit={handleUpdateProfile}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Informações Básicas</CardTitle>
                                <CardDescription>Atualize o nome e permissões. Isso atualizará o dispositivo.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nome Completo</Label>
                                    <Input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                        className="max-w-md"
                                    />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Salvar Alterações
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </TabsContent>

                <TabsContent value="unit">
                    <form onSubmit={handleUpdateProfile}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Vincular Unidade</CardTitle>
                                <CardDescription>Associe este morador a um bloco e apartamento.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 max-w-lg">
                                    <div className="space-y-2">
                                        <Label>Bloco</Label>
                                        <select
                                            name="block"
                                            value={formData.block}
                                            onChange={handleInputChange}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        >
                                            <option value="">Selecione...</option>
                                            {availableBlocks.map(block => (
                                                <option key={block} value={block}>{block}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Unidade</Label>
                                        <select
                                            name="apartment"
                                            value={formData.apartment}
                                            onChange={handleInputChange}
                                            disabled={!formData.block}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        >
                                            <option value="">Selecione...</option>
                                            {availableUnits.map(unit => (
                                                <option key={unit.id} value={unit.name}>{unit.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="p-4 bg-muted/50 rounded-md border border-dashed text-sm">
                                    Situação atual: <span className="font-medium">{formData.block && formData.apartment ? `${formData.block} - ${formData.apartment}` : "Sem Vínculo"}</span>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Salvar Vínculo
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </TabsContent>

                <TabsContent value="card">
                    <Card>
                        <CardHeader>
                            <CardTitle>Cartões de Acesso</CardTitle>
                            <CardDescription>Gerencie as tags e cartões RFID vinculados.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* List of Cards */}
                            {cards.length > 0 ? (
                                <div className="space-y-2">
                                    {cards.map(card => (
                                        <div key={card.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                            <div className="flex items-center gap-3">
                                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-mono text-sm tracking-wider">{card.card_no}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                                onClick={() => handleDeleteCardClick(card)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">Nenhum cartão vinculado.</p>
                            )}

                            <div className="pt-4 border-t">
                                <Label className="mb-2 block">Adicionar Novo Cartão</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={cardNo}
                                        onChange={(e) => setCardNo(e.target.value.replace(/\D/g, "").slice(0, 10))} // Digits only, max 10
                                        placeholder="0000000000"
                                        maxLength={10}
                                        className="font-mono tracking-widest"
                                    />
                                    <Button onClick={handleSaveCard} disabled={cardSaving || !cardNo} className="gap-2">
                                        {cardSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                        Adicionar
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Somente números. Deve ter 10 dígitos.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="biometry">
                    <Card>
                        <CardHeader>
                            <CardTitle>Biometria Facial</CardTitle>
                            <CardDescription>Envie uma foto para o reconhecimento facial. Use fundo claro e boa iluminação.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            <FaceUpload
                                currentPhoto={photoData}
                                onPhotoSelected={setPhotoData}
                            />

                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleUploadFace} disabled={bioSaving || !photoData} className="gap-2 w-full sm:w-auto">
                                {bioSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                Sincronizar Face
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

            </Tabs>

            <Dialog open={!!cardToDelete} onOpenChange={(open) => !open && setCardToDelete(null)}>
                <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-500">
                            <AlertTriangle className="h-5 w-5" />
                            Confirmar Remoção
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 pt-2">
                            Tem certeza que deseja remover o cartão?
                            <br />
                            <span className="font-mono text-lg text-white block mt-2 tracking-wider">
                                {cardToDelete?.card_no}
                            </span>
                            <span className="text-xs text-zinc-500 block mt-1">
                                Esta ação removerá o cartão de todos os dispositivos.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 mt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setCardToDelete(null)}
                            className="text-zinc-400 hover:text-white hover:bg-zinc-900"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={confirmDeleteCard}
                            variant="destructive"
                            className="bg-red-900/50 hover:bg-red-900 text-red-100 border border-red-800"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Confirmar e Remover
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
