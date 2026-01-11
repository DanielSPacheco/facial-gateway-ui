"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { fileToCompressedDataUrl } from "@/lib/image-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export default function CreateUserPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        userID: "",
        name: "",
        password: "",
        cardNo: "",
        block: "",
        apartment: "",
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        // Validation for Card Number: Numeric only, max 10 chars
        if (name === "cardNo") {
            const numericValue = value.replace(/\D/g, "").slice(0, 10);
            setFormData({ ...formData, [name]: numericValue });
            return;
        }

        setFormData({ ...formData, [name]: value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { siteId, clientId } = await getSiteContext();

            // Get current user for audit
            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = user?.email || "unknown";

            let base64Data = "";
            if (selectedFile) {
                const { dataUrl, bytes } = await fileToCompressedDataUrl(selectedFile);
                if (bytes > 15 * 1024) {
                    toast.error(`Imagem muito grande (${Math.round(bytes / 1024)}KB). Limite ~14KB.`);
                    setLoading(false);
                    return;
                }
                base64Data = dataUrl;
            }

            // 1. Insert into public.users (Source of Truth for UI)
            const { data: userData, error: dbError } = await supabase.from("users").insert({
                user_id: formData.userID,
                name: formData.name,
                client_id: clientId,
                authority: 2,
                block: formData.block || null,
                apartment: formData.apartment || null,
                card_no: formData.cardNo || null,
                photo_data: base64Data || null
            }).select().single();

            if (dbError) throw new Error("Failed to save user to DB: " + dbError.message);

            // Fetch Devices to Sync
            const { data: devices } = await supabase
                .from("facials")
                .select("id, name")
                .eq("site_id", siteId)
                .eq("status", "online"); // Optional: Sync only to online? Or all? strict: all.

            // Note: If we sync only to online, offline devices miss the user. 
            // Better to sync to ALL and let the agent retry or queue stay pending.
            const { data: allDevices } = await supabase
                .from("facials")
                .select("id, name")
                .eq("site_id", siteId);

            const targetDevices = allDevices || [];

            if (targetDevices.length === 0) {
                toast.warning("Usuário salvo, mas sem dispositivos para sincronizar.");
                // We don't throw, just finish.
            }

            // Loop per device for "Enterprise Granularity" & Constraints
            for (const device of targetDevices) {
                // 2. Create User Job
                const { error: userError } = await supabase.from("jobs").insert({
                    site_id: siteId,
                    client_id: clientId,
                    facial_id: device.id, // Explicitly target device
                    type: "create_user",
                    payload: {
                        userID: formData.userID,
                        userName: formData.name,
                        password: formData.password,
                        authority: 2,
                        block: formData.block,
                        apartment: formData.apartment,
                        triggered_by: userEmail
                    },
                    status: "pending"
                });
                if (userError) console.error(`Failed to sync user to ${device.name}:`, userError);

                // 3. Add Card Job
                if (formData.cardNo) {
                    // DB insert (already done above globally, but we need job per device)
                    // Re-inserting to 'cards' table is global, so we don't repeat it in the loop.
                    // Just the JOB.
                    const { error: cardError } = await supabase.from("jobs").insert({
                        site_id: siteId,
                        client_id: clientId,
                        facial_id: device.id,
                        type: "add_card",
                        payload: {
                            userID: formData.userID,
                            cardNo: formData.cardNo,
                            triggered_by: userEmail
                        },
                        status: "pending"
                    });
                    if (cardError) console.error(`Failed to sync card to ${device.name}:`, cardError);
                }

                // 4. Upload Face Job
                if (base64Data) {
                    const { error: faceError } = await supabase.from("jobs").insert({
                        site_id: siteId,
                        client_id: clientId,
                        facial_id: device.id,
                        type: "upload_face_base64",
                        payload: {
                            userID: formData.userID,
                            photoData: base64Data,
                            triggered_by: userEmail
                        },
                        status: "pending"
                    });
                    if (faceError) console.error(`Failed to sync face to ${device.name}:`, faceError);
                }
            }

            // Handle Global Card Store (Outside Loop - Once)
            if (formData.cardNo) {
                // 3a. Save to DB (Source of Truth)
                const { error: dbCardError } = await supabase.from("cards").insert({
                    site_id: siteId,
                    user_id: userData.id,
                    card_number: formData.cardNo
                });
                if (dbCardError && dbCardError.code !== '23505') {
                    console.error("Failed to save card to DB:", dbCardError);
                }
            }

            toast.success("User created successfully! Jobs queued.");
            router.push("/users");

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Create User</h1>

            <Card>
                <CardHeader>
                    <CardTitle>User Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">User ID</label>
                            <Input
                                name="userID"
                                placeholder="e.g. 888"
                                required
                                value={formData.userID}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                name="name"
                                placeholder="User Full Name"
                                required
                                value={formData.name}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Password</label>
                            <Input
                                name="password"
                                type="password"
                                placeholder="Device Password"
                                required
                                value={formData.password}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Card Number (Optional)</label>
                            <Input
                                name="cardNo"
                                placeholder="Card / Tag ID (Max 10 digits)"
                                value={formData.cardNo}
                                onChange={handleInputChange}
                                maxLength={10}
                                inputMode="numeric"
                            />
                            <p className="text-xs text-muted-foreground">
                                Format: Decimal (0-9). Max 10 characters.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Face Photo (Optional)</label>
                            <Input
                                type="file"
                                accept="image/jpeg,image/png"
                                onChange={handleFileChange}
                            />
                            <p className="text-xs text-muted-foreground">
                                Max 14KB, JPG preferred. Frontal face, good lighting.
                            </p>
                        </div>

                        <div className="pt-4 flex gap-4">
                            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                            <Button type="submit" disabled={loading} className="gap-2">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {loading ? "Queueing..." : "Create User"}
                            </Button>
                        </div>

                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
