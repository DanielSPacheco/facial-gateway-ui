"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { getSiteContext } from "@/lib/site-context";
import { Loader2, Lock } from "lucide-react";

export function OpenDoorButton({ channel = 1 }: { channel?: number }) {
    const [loading, setLoading] = useState(false);

    const handleOpenDoor = async () => {
        setLoading(true);

        try {
            const { siteId, clientId } = await getSiteContext();

            const { error } = await supabase
                .from("jobs")
                .insert({
                    site_id: siteId,
                    client_id: clientId,
                    type: "open_door",
                    payload: { channel },
                    status: "pending",
                });

            if (error) {
                console.error("Error creating job:", error);
                alert("Failed to open door: " + error.message);
            } else {
                console.log("Open door job created");
            }
        } catch (err: any) {
            console.error("Unexpected error:", err);
            alert(err.message);
        } finally {
            setTimeout(() => setLoading(false), 500);
        }
    };

    return (
        <Button
            onClick={handleOpenDoor}
            disabled={loading}
            className="w-full sm:w-auto gap-2"
            size="lg"
        >
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Lock className="h-4 w-4" />
            )}
            {loading ? "Opening..." : "Open Door"}
        </Button>
    );
}
