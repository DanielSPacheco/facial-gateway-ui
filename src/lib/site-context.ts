import { supabase } from "@/lib/supabase/client";

export async function getSiteContext() {
    const siteId = process.env.NEXT_PUBLIC_SITE_ID;
    if (!siteId) {
        throw new Error("Missing NEXT_PUBLIC_SITE_ID env var");
    }

    // Fetch client_id from the sites table
    const { data, error } = await supabase
        .from("sites")
        .select("client_id")
        .eq("id", siteId)
        .single();

    if (error || !data) {
        console.error("Error fetching site context:", error);
        throw new Error("Could not find client_id for this site");
    }

    return { siteId, clientId: data.client_id };
}
