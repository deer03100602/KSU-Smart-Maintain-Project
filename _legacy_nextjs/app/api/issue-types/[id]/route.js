// ============================================================
// route.js — API Endpoint for a single issue type CRUD
// Route: /api/issue-types/[id]
// ============================================================

import { NextResponse } from 'next/server';
import { DbService } from '@/lib/db';

export async function PATCH(request, { params }) {
    try {
        const { id } = params;
        const body = await request.json();

        const existingType = await DbService.getIssueTypeById(id);
        if (!existingType) {
            return NextResponse.json({ error: 'Issue type not found' }, { status: 404 });
        }

        const updatedType = await DbService.updateIssueType(id, body);
        return NextResponse.json(updatedType);
    } catch (e) {
        console.error(`API Error in PATCH /api/issue-types/${params.id}:`, e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = params;

        const existingType = await DbService.getIssueTypeById(id);
        if (!existingType) {
            return NextResponse.json({ error: 'Issue type not found' }, { status: 404 });
        }

        await DbService.deleteIssueType(id);
        return NextResponse.json({ message: 'Issue type deleted successfully' });
    } catch (e) {
        console.error(`API Error in DELETE /api/issue-types/${params.id}:`, e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


