"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export default function EditUserPage() {
    const router = useRouter();
    const params = useParams(); // { id: "888" }
    const userIdDevice = params.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        block: "",
        apartment: "",
        cardNo: ""
    });

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const { siteId } = await getSiteContext();
                const { data, error } = await supabase
                    .from("users")
                    .select("*")
                    .eq("user_id", userIdDevice)
                    // .eq("client_id", siteId) // Relaxed filter to match List page behavior
                    .limit(1)
                    .maybeSingle();

                if (error) throw error;
                if (!data) throw new Error("User not found");

                setFormData({
                    name: data.name,
                    block: data.block || "",
                    apartment: data.apartment || "",
                    cardNo: data.card_no || ""
                });
            } catch (e: any) {
                console.error(e);
                alert("User not found or error loading: " + e.message);
                router.push("/users");
            } finally {
                setLoading(false);
            }
        };

        if (userIdDevice) fetchUser();
    }, [userIdDevice, router]);

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

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const { siteId, clientId } = await getSiteContext();

            // 1. Update DB Local Record
            const { error: dbError } = await supabase
                .from("users")
                .update({
                    name: formData.name,
                    block: formData.block || null,
                    apartment: formData.apartment || null,
                    card_no: formData.cardNo || null
                })
                .eq("user_id", userIdDevice)
                .eq("client_id", clientId);

            if (dbError) throw new Error("DB Update failed: " + dbError.message);

            // 2. Queue Update Job for Device
            await supabase.from("jobs").insert({
                site_id: siteId,
                client_id: clientId,
                type: "update_user", // Ensure backend supports this type, or reuse 'create_user' with overwrite logic if needed
                payload: {
                    userID: userIdDevice,
                    userName: formData.name
                },
                status: "pending"
            });

            // 3. Queue Add Card Job (if provided)
            if (formData.cardNo) {
                // Short delay to ensure user exists/is accessible before adding card
                await new Promise(r => setTimeout(r, 500));

                await supabase.from("jobs").insert({
                    site_id: siteId,
                    client_id: clientId,
                    type: "add_card",
                    payload: {
                        userID: userIdDevice,
                        cardNo: formData.cardNo
                    },
                    status: "pending"
                });
            }

            toast.success("User updated successfully!");
            router.push("/users");

        } catch (err: any) {
            console.error(err);
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Edit User (ID: {userIdDevice})</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Update Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Block</label>
                                <Input
                                    name="block"
                                    value={formData.block}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Apartment</label>
                                <Input
                                    name="apartment"
                                    value={formData.apartment}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Card Number (Stored Locally)</label>
                            <Input
                                name="cardNo"
                                value={formData.cardNo}
                                onChange={handleInputChange}
                                maxLength={10}
                                inputMode="numeric"
                                placeholder="0000000000"
                            />
                            <p className="text-xs text-muted-foreground">Format: Decimal. Max 10 digits. Changes here update the database; use 'Delete/Add' flow to sync with device if needed.</p>
                        </div>

                        <div className="pt-4 flex gap-4">
                            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                            <Button type="submit" disabled={saving} className="gap-2">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {saving ? "Updating..." : "Save Changes"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
