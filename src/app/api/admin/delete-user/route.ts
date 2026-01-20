import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const { id, userId, email } = await request.json();

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

    if (userId && isUuid(userId)) {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authError) {
        const msg = String(authError.message || "").toLowerCase();
        if (!msg.includes("user not found") && !msg.includes("expected pattern")) {
          return NextResponse.json({ error: authError.message }, { status: 500 });
        }
      }
    }

    const hasEmail = typeof email === "string" && email.trim() !== "";

    let deleteQuery = supabaseAdmin.from('users').delete();

    if (hasEmail) {
      deleteQuery = deleteQuery.eq('email', email.trim());
    } else if (userId && isUuid(userId)) {
      deleteQuery = deleteQuery.eq('user_id', userId);
    } else if (id && isUuid(id)) {
      deleteQuery = deleteQuery.eq('id', id);
    } else {
      return NextResponse.json({ error: 'Missing valid identifiers to delete user.' }, { status: 400 });
    }

    const { error: dbError } = await deleteQuery;

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
