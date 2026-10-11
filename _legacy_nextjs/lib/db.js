// ============================================================
// db.js — Server-Side Supabase Database Client & Service
// Mini Helpdesk / Issue Tracking System
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

function generateId() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

// ── Exported Services ────────────────────────────────────────
export const DbService = {
    // Ticket CRUD
    async generateTicketNo() {
        const { data, error } = await supabase
            .from('tickets')
            .select('ticket_no');
        
        if (error) {
            console.error('Error fetching ticket numbers for auto-increment:', error);
            return 'TKT-0001';
        }

        let maxNum = 0;
        let paddingLength = 3; // Default to 3 digits (e.g. TKT-001)
        if (data && data.length > 0) {
            data.forEach(t => {
                if (t.ticket_no) {
                    const match = t.ticket_no.match(/TKT-(\d+)/i);
                    if (match) {
                        const numStr = match[1];
                        const num = parseInt(numStr, 10);
                        if (num > maxNum) {
                            maxNum = num;
                            paddingLength = numStr.length;
                        }
                    }
                }
            });
        }
        
        const nextNum = maxNum + 1;
        const finalPadding = Math.max(3, paddingLength);
        return 'TKT-' + String(nextNum).padStart(finalPadding, '0');
    },

    async getTickets() {
        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching tickets from Supabase:', error);
            return [];
        }
        return data || [];
    },

    async getTicketById(id) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) {
            console.error('Error fetching ticket by ID from Supabase:', error);
            return null;
        }
        return data;
    },

    async createTicket(ticketData) {
        const now = new Date().toISOString();
        const ticketNo = await this.generateTicketNo();
        const newTicket = {
            id: generateId(),
            ticket_no: ticketNo,
            title: ticketData.title,
            description: ticketData.description,
            issue_type: ticketData.issue_type,
            location: ticketData.location || '',
            priority: ticketData.priority || 'Medium',
            status: 'Open',
            requester_name: (/\((นักศึกษา|อาจารย์|เจ้าหน้าที่|เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์|ผู้ดูแลระบบ)\)$/.test(ticketData.requester_name) || !ticketData.requester_group)
                ? ticketData.requester_name
                : `${ticketData.requester_name} (${ticketData.requester_group})`,
            requester_email: ticketData.requester_email || '',
            assigned_to: ticketData.assigned_to || '',
            resolution_note: '',
            created_at: now,
            updated_at: now,
            closed_at: null
        };

        const { data, error } = await supabase
            .from('tickets')
            .insert(newTicket)
            .select()
            .single();

        if (error) {
            console.error('Error creating ticket in Supabase:', error);
            throw error;
        }
        return data;
    },

    async updateTicket(id, updates) {
        const now = new Date().toISOString();
        
        const cleanUpdates = { ...updates };
        delete cleanUpdates.id;
        delete cleanUpdates.ticket_no;
        delete cleanUpdates.created_at;

        const updateData = { ...cleanUpdates, updated_at: now };

        // Set closed_at if resolved/closed/cancelled
        if (['Closed', 'Cancelled', 'Resolved'].includes(updates.status)) {
            updateData.closed_at = now;
        } else if (updates.status && !['Closed', 'Cancelled', 'Resolved'].includes(updates.status)) {
            updateData.closed_at = null;
        }

        const { data, error } = await supabase
            .from('tickets')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating ticket in Supabase:', error);
            throw error;
        }
        return data;
    },

    async deleteTicket(id) {
        const { error } = await supabase
            .from('tickets')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting ticket from Supabase:', error);
            throw error;
        }
        return true;
    },

    // Issue Type CRUD
    async getIssueTypes() {
        const { data, error } = await supabase
            .from('issue_types')
            .select('*')
            .order('name', { ascending: true });
        if (error) {
            console.error('Error fetching issue types from Supabase:', error);
            return [];
        }
        return data || [];
    },

    async getIssueTypeById(id) {
        const { data, error } = await supabase
            .from('issue_types')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) {
            console.error('Error fetching issue type by ID from Supabase:', error);
            return null;
        }
        return data;
    },

    async createIssueType(typeData) {
        const newType = {
            id: typeData.id || 'it-' + Date.now().toString(36),
            name: typeData.name,
            description: typeData.description || '',
            icon: typeData.icon || 'circle-help'
        };

        const { data, error } = await supabase
            .from('issue_types')
            .insert(newType)
            .select()
            .single();

        if (error) {
            console.error('Error creating issue type in Supabase:', error);
            throw error;
        }
        return data;
    },

    async updateIssueType(id, updates) {
        const cleanUpdates = { ...updates };
        delete cleanUpdates.id;

        const { data, error } = await supabase
            .from('issue_types')
            .update(cleanUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating issue type in Supabase:', error);
            throw error;
        }
        return data;
    },

    async deleteIssueType(id) {
        const { error } = await supabase
            .from('issue_types')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting issue type from Supabase:', error);
            throw error;
        }
        return true;
    }
};
