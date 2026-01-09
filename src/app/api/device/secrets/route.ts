import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, username, password } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: "Device ID is required" }, { status: 400 });
        }

        // Check for Service Key
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            // If key is missing but we are trying to write secrets, this MUST fail.
            // This aligns with user expectation: "Update secrets... requires permission/key".
            return NextResponse.json({
                success: false,
                error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing. Cannot save secrets."
            }, { status: 500 });
        }

        // Init Service Role Client
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceKey
        );

        // Upsert Secrets
        const secretPayload: any = {
            facial_id: id,
            updated_at: new Date().toISOString()
        };
        if (username !== undefined) secretPayload.username = username;
        if (password !== undefined) secretPayload.password = password;

        // Check if secret row exists
        const { data: existingSecret } = await supabaseAdmin
            .from('facial_secrets')
            .select('facial_id')
            .eq('facial_id', id)
            .single();

        let error;
        if (existingSecret) {
            const res = await supabaseAdmin
                .from('facial_secrets')
                .update(secretPayload)
                .eq('facial_id', id);
            error = res.error;
        } else {
            const res = await supabaseAdmin
                .from('facial_secrets')
                .insert(secretPayload);
            error = res.error;
        }

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Error saving secrets:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
