
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { email, name, role, clientId } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Initialize Admin Client
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // 1. Invite User by Email
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
        const redirectTo = `${baseUrl.replace(/\/+$/, "")}/invite`;

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            redirectTo
        });

        if (authError) {
            console.error('Error inviting user:', authError);
            const msg = authError.message || "Invite failed";
            if (String(msg).includes("expected pattern")) {
                return NextResponse.json({ error: "Redirect URL não permitido. Adicione o URL em Authentication → URL Configuration." }, { status: 500 });
            }
            return NextResponse.json({ error: msg }, { status: 500 });
        }

        const newUserId = authData.user.id;

        // 2. Insert metadata into public.users
        // Note: The triggers might handle this if you have them, 
        // but typically for custom roles we insert manually or update.

        // Check if user already exists in public users table (e.g. from a trigger)
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('user_id', newUserId)
            .maybeSingle();

        if (existingUser) {
            // Update existing
            await supabaseAdmin
                .from('users')
                .update({
                    name: name,
                    role: role,
                    client_id: clientId, // Ensure they are in right client context
                    email: email
                    // You might want to update or set other fields
                })
                .eq('id', existingUser.id);
        } else {
            // Insert new
            const { error: dbError } = await supabaseAdmin
                .from('users')
                .insert({
                    user_id: newUserId, // The auth UUID
                    name: name,
                    role: role,
                    client_id: clientId,
                    email: email
                    // Add any other required fields for your schema
                    // email: email // If your public users table has email
                });

            if (dbError) {
                console.error('Error creating public user record:', dbError);
                return NextResponse.json({ error: 'User invited but failed to create profile: ' + dbError.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, userId: newUserId });

    } catch (err: any) {
        console.error('Internal Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
