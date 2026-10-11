// ============================================================
// route.js — Server-Side API Endpoint for Admin-powered Signup
// Route: /api/auth/signup
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const { email, password, fullName, userGroup } = await request.json();

        if (!email || !password || !fullName) {
            return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
        }

        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Supabase Service Role Key is missing on the server config' }, { status: 500 });
        }

        // Initialize Supabase Client with service role key to bypass email confirmation
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: email.trim(),
            password: password.trim(),
            email_confirm: true,
            user_metadata: {
                full_name: fullName.trim(),
                user_group: userGroup || 'นักศึกษา'
            }
        });

        if (error) {
            console.error('Supabase admin signup error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, user: data.user }, { status: 200 });
    } catch (e) {
        console.error('API Error in POST /api/auth/signup:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
