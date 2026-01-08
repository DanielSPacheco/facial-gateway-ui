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
import { fileToCompressedDataUrl } from "@/lib/image-utils";

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

    // Bio Data
    // Bio Data
    const [photoData, setPhotoData] = useState<string>("");
    const [photoPreview, setPhotoPreview] = useState<string>("");
    const [bioSaving, setBioSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

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
            if (data.card_no) setCardNo(data.card_no);

            if (data.block) setSelectedBlock(data.block);

            // Existing Photo
            if (data.photo_data) {
                setPhotoPreview(data.photo_data);
                // We don't necessarily set photoData (the payload for upload) unless they want to re-upload the SAME photo?
                // Actually, if they want to sync again, we might need it.
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
            const { clientId } = await getSiteContext();
            const { data } = await supabase
                .from("user_cards")
                .select("id, card_no")
                .eq("user_id", userIdDevice)
                .eq("client_id", clientId)
                .order("created_at", { ascending: false });

            if (data) setCards(data);
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

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { siteId, clientId } = await getSiteContext();

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

            // 2. Queue 'user_update' Job
            const { data: jobData, error: jobError } = await supabase.from("jobs").insert({
                site_id: siteId,
                client_id: clientId,
                type: "user_update",
                payload: {
                    userID: String(userIdDevice),
                    userName: formData.name,
                    authority: formData.authority
                },
                priority: 1,
                max_attempts: 3,
                status: "pending"
            }).select().single();

            if (jobError) throw new Error(jobError.message);

            toast.success(`Perfil atualizado! Job ID: ${jobData.id}`);
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

            // 1. Insert into public.user_cards
            const { error: dbError } = await supabase.from("user_cards").insert({
                client_id: clientId,
                user_id: userIdDevice,
                card_no: cardNo,
                site_id: siteId // optional if helpful
            });

            if (dbError) {
                if (dbError.code === '23505') {
                    toast.error("Este cartão já está cadastrado para este usuário.");
                } else {
                    throw new Error(dbError.message);
                }
                setCardSaving(false);
                return;
            }

            // 2. Queue 'card_add' Job
            const { data: jobData, error: jobError } = await supabase.from("jobs").insert({
                site_id: siteId,
                client_id: clientId,
                type: "card_add",
                payload: {
                    userID: String(userIdDevice),
                    cardNo: String(cardNo).replace(/\D/g, "")
                },
                priority: 1,
                max_attempts: 3,
                status: "pending"
            }).select().single();

            if (jobError) throw new Error(jobError.message);

            toast.success(`Cartão adicionado! Job ID: ${jobData.id}`);
            setCardNo("");
            fetchCards(); // Refresh list

        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setCardSaving(false);
        }
    };

    const handleDeleteCard = async (cardToDelete: { id: string, card_no: string }) => {
        if (!confirm(`Remover o cartão ${cardToDelete.card_no}?`)) return;

        try {
            const { siteId, clientId } = await getSiteContext();

            // 1. Remove from DB
            await supabase.from("user_cards").delete().eq("id", cardToDelete.id);

            // 2. Queue 'card_delete' Job
            const { data: jobData } = await supabase.from("jobs").insert({
                site_id: siteId,
                client_id: clientId,
                type: "card_delete",
                payload: {
                    userID: String(userIdDevice),
                    cardNo: cardToDelete.card_no
                },
                priority: 1,
                max_attempts: 3,
                status: "pending"
            }).select().single();

            toast.success(`Cartão removido! Job ID: ${jobData?.id}`);
            fetchCards();

        } catch (err: any) {
            toast.error("Erro ao remover cartão: " + err.message);
        }
    };



    // --- DRAG AND DROP HANDLERS ---
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const processFile = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Apenas arquivos de imagem são permitidos");
            return;
        }

        try {
            // Compress and resize client-side
            // The utility now handles ultra-aggressive compression for <14KB limit
            const { dataUrl, bytes } = await fileToCompressedDataUrl(file);

            // Hard limit validation (14KB is approx 13600 chars of base64)
            // 75KB was previous goal, but firmware is 14KB.
            // Let's warn if > 15KB
            if (bytes > 15 * 1024) {
                toast.error(`Imagem muito grande (${Math.round(bytes / 1024)}KB). O limite é ~14KB.`);
                // Still set it, user might want to try? Or block?
                // Let's block to avoid agent error loop
                return;
            }

            setPhotoData(dataUrl);
            setPhotoPreview(dataUrl);
        } catch (e: any) {
            console.error(e);
            toast.error("Erro ao processar imagem: " + e.message);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
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

            // 1. Queue Job
            const { data: jobData, error: jobError } = await supabase.from("jobs").insert({
                site_id: siteId,
                client_id: clientId,
                type: "face_upload_base64",
                payload: {
                    userID: String(userIdDevice),
                    photoData: photoData
                },
                priority: 1,
                max_attempts: 3,
                status: "pending"
            }).select("id").single();

            if (jobError) throw new Error(jobError.message);

            const jobId = jobData.id;
            toast.info("Enviando para o dispositivo...", { duration: 2000 });

            // 2. Poll for Result
            for (let i = 0; i < 60; i++) {
                const { data: job } = await supabase
                    .from("jobs")
                    .select("status, error_message, result")
                    .eq("id", jobId)
                    .single();

                if (!job) break;

                if (job.status === 'done') {
                    toast.success("Foto salva no dispositivo com sucesso! 📸");
                    setPhotoData("");
                    setPhotoPreview("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    return;
                }

                if (job.status === 'failed') {
                    throw new Error(job.error_message || "O dispositivo rejeitou a foto.");
                }

                await new Promise(r => setTimeout(r, 800));
            }

            throw new Error("Tempo esgotado! O dispositivo não respondeu.");

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
                                                onClick={() => handleDeleteCard(card)}
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
                            <div
                                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${isDragging ? 'border-primary bg-primary/10' : 'bg-muted/20 hover:bg-muted/40'}`}
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >

                                {photoPreview ? (
                                    <div className="relative w-48 h-48 rounded-md overflow-hidden border">
                                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                            <p className="text-white text-xs font-medium">Trocar Foto</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Camera className="h-10 w-10 mb-2 opacity-50" />
                                        <p className="font-medium">Clique para selecionar foto</p>
                                        <p className="text-xs">JPG/JPEG (Max 2MB)</p>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".jpg,.jpeg"
                                    onChange={handleFileSelect}
                                />
                            </div>

                            {photoPreview && (
                                <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-500/10 p-3 rounded-md">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>Verifique se a foto está focada e centralizada.</span>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleUploadFace} disabled={bioSaving || !photoPreview} className="gap-2 w-full sm:w-auto">
                                {bioSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                Sincronizar Face
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
    );
}
