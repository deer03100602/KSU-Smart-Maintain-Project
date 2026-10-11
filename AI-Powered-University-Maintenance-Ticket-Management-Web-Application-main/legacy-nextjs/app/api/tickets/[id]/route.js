// ============================================================
// route.js — API Endpoint for a single ticket CRUD
// Route: /api/tickets/[id]
// ============================================================

import { NextResponse } from 'next/server';
import { DbService } from '@/lib/db';
import { NotificationService } from '@/lib/notifications';

export async function GET(request, { params }) {
    try {
        const { id } = params;
        const ticket = await DbService.getTicketById(id);

        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        return NextResponse.json(ticket);
    } catch (e) {
        console.error(`API Error in GET /api/tickets/${params.id}:`, e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request, { params }) {
    try {
        const { id } = params;
        const body = await request.json();

        // Check if ticket exists
        const existingTicket = await DbService.getTicketById(id);
        if (!existingTicket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        const updatedTicket = await DbService.updateTicket(id, body);
        
        // Dispatch notifications (async)
        await NotificationService.dispatch(updatedTicket, 'update');

        return NextResponse.json(updatedTicket);
    } catch (e) {
        console.error(`API Error in PATCH /api/tickets/${params.id}:`, e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = params;

        // Check if ticket exists
        const existingTicket = await DbService.getTicketById(id);
        if (!existingTicket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        await DbService.deleteTicket(id);
        return NextResponse.json({ message: 'Ticket deleted successfully' });
    } catch (e) {
        console.error(`API Error in DELETE /api/tickets/${params.id}:`, e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
