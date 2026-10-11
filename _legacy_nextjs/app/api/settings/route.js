// ============================================================
// route.js — API Endpoint for Settings
// Route: /api/settings
// ============================================================

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const settingsPath = path.join(process.cwd(), 'data/settings.json');

// Ensure data folder exists
const ensureDataFolder = () => {
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        ensureDataFolder();
        let settings = {
            discord_webhook_url: '',
            emailjs_service_id: '',
            emailjs_template_id: '',
            emailjs_public_key: '',
            emailjs_private_key: ''
        };
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            settings = JSON.parse(data);
        }
        
        return NextResponse.json(settings, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (e) {
        console.error('API Error in GET /api/settings:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        ensureDataFolder();
        const body = await request.json();

        const cleanSettings = {
            discord_webhook_url: body.discord_webhook_url || '',
            emailjs_service_id: body.emailjs_service_id || '',
            emailjs_template_id: body.emailjs_template_id || '',
            emailjs_public_key: body.emailjs_public_key || '',
            emailjs_private_key: body.emailjs_private_key || ''
        };

        fs.writeFileSync(settingsPath, JSON.stringify(cleanSettings, null, 2), 'utf8');
        return NextResponse.json({ success: true, settings: cleanSettings });
    } catch (e) {
        console.error('API Error in POST /api/settings:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
export async function PATCH(request) {
    // Treat PATCH similarly to POST for testing notifications
    try {
        const body = await request.json();
        const { NotificationService } = await import('@/lib/notifications');
        
        // Mock a ticket for testing
        const mockTicket = {
            ticket_no: 'TKT-TEST',
            title: 'ทดสอบส่งการแจ้งเตือนจากระบบ (Test Notification)',
            description: 'นี่คือการส่งการแจ้งเตือนทดสอบ เพื่อทดสอบการทำงานของ Webhook และ EmailJS',
            issue_type: 'System Test',
            location: 'ระบบหลังบ้าน Mini Helpdesk',
            priority: 'Medium',
            status: 'Open',
            requester_name: body.test_name || 'ผู้ดูแลระบบ',
            requester_email: body.test_email || 'test@example.com',
            assigned_to: 'แอดมินทดสอบ'
        };

        await NotificationService.dispatch(mockTicket, 'create');
        return NextResponse.json({ success: true, message: 'ส่งการแจ้งเตือนทดสอบเรียบร้อยแล้ว' });
    } catch (e) {
        console.error('API Error in PATCH /api/settings:', e);
        return NextResponse.json({ error: 'Failed to dispatch test notification' }, { status: 500 });
    }
}
