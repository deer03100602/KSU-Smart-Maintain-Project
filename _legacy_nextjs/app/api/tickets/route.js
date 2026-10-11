// ============================================================
// route.js — API Endpoint for Tickets search/filter & create
// Route: /api/tickets
// ============================================================

import { NextResponse } from 'next/server';
import { DbService } from '@/lib/db';
import { NotificationService } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query');
        const status = searchParams.get('status');
        const priority = searchParams.get('priority');
        const issue_type = searchParams.get('issue_type');
        const assigned_to = searchParams.get('assigned_to');
        const requester_name = searchParams.get('requester_name');
        const requester_email = searchParams.get('requester_email');
        const requester_group = searchParams.get('requester_group');
        const period = searchParams.get('period') || 'all';
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let tickets = await DbService.getTickets();

        // Apply date filtering
        if (period === 'day') {
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            tickets = tickets.filter(t => new Date(t.created_at) >= oneDayAgo);
        } else if (period === 'week') {
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            tickets = tickets.filter(t => new Date(t.created_at) >= oneWeekAgo);
        } else if (period === 'month') {
            const now = new Date();
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            tickets = tickets.filter(t => new Date(t.created_at) >= oneMonthAgo);
        } else if (period === 'custom' && startDate) {
            const start = new Date(startDate);
            const end = endDate ? new Date(endDate) : new Date(startDate);
            tickets = tickets.filter(t => {
                const tDate = new Date(t.created_at);
                return tDate >= start && tDate <= end;
            });
        }

        if (query) {
            const q = query.toLowerCase().trim();
            tickets = tickets.filter(t =>
                t.ticket_no.toLowerCase().includes(q) ||
                t.title.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q)
            );
        }

        if (status) {
            tickets = tickets.filter(t => t.status === status);
        }

        if (priority) {
            tickets = tickets.filter(t => t.priority === priority);
        }

        if (issue_type) {
            tickets = tickets.filter(t => t.issue_type === issue_type);
        }

        if (assigned_to) {
            if (assigned_to === 'unassigned') {
                tickets = tickets.filter(t => !t.assigned_to);
            } else {
                tickets = tickets.filter(t => t.assigned_to === assigned_to);
            }
        }

        if (requester_name) {
            tickets = tickets.filter(t => t.requester_name.toLowerCase().trim() === requester_name.toLowerCase().trim());
        }

        if (requester_email) {
            tickets = tickets.filter(t => t.requester_email && t.requester_email.toLowerCase().trim() === requester_email.toLowerCase().trim());
        }

        if (requester_group) {
            tickets = tickets.filter(t => {
                const match = t.requester_name.match(/\((นักศึกษา|อาจารย์|เจ้าหน้าที่|เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์|ผู้ดูแลระบบ)\)$/);
                return match && match[1] === requester_group;
            });
        }

        return NextResponse.json(tickets, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (e) {
        console.error('API Error in GET /api/tickets:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();

        // Validation
        if (!body.title || !body.description || !body.issue_type || !body.location || !body.requester_name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newTicket = await DbService.createTicket(body);
        
        // Dispatch notifications (async)
        await NotificationService.dispatch(newTicket, 'create');

        return NextResponse.json(newTicket, { status: 201 });
    } catch (e) {
        console.error('API Error in POST /api/tickets:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
