// ============================================================
// ticketStore.js — Persistent Client-Side Ticket & Workflow Cache
// Ensures tickets and actions survive serverless lambda cold starts & resets
// ============================================================

const TICKETS_KEY = 'ksu_tickets_store_v1';
const EXPENSES_KEY = 'ksu_expenses_store_v1';
const TIMELINES_KEY = 'ksu_timelines_store_v1';
const EVIDENCES_KEY = 'ksu_evidences_store_v1';

export function getStoredTickets() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(TICKETS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn('Error reading stored tickets:', e);
        return [];
    }
}

export function saveStoredTicket(ticket) {
    if (!ticket || (!ticket.id && !ticket.ticket_no)) return;
    if (typeof window === 'undefined') return;
    try {
        const list = getStoredTickets();
        const existingIdx = list.findIndex(t => 
            (ticket.id && t.id === ticket.id) || 
            (ticket.ticket_no && t.ticket_no === ticket.ticket_no)
        );
        if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], ...ticket };
        } else {
            list.unshift(ticket);
        }
        localStorage.setItem(TICKETS_KEY, JSON.stringify(list));
    } catch (e) {
        console.warn('Error saving stored ticket:', e);
    }
}

export function removeStoredTicket(idOrNo) {
    if (typeof window === 'undefined' || !idOrNo) return;
    try {
        const list = getStoredTickets().filter(t => t.id !== idOrNo && t.ticket_no !== idOrNo);
        localStorage.setItem(TICKETS_KEY, JSON.stringify(list));
    } catch (e) {}
}

export function getStoredTicket(idOrNo) {
    if (!idOrNo) return null;
    const target = String(idOrNo).trim().toLowerCase();
    const list = getStoredTickets();
    return list.find(t => 
        (t.id && String(t.id).trim().toLowerCase() === target) ||
        (t.ticket_no && String(t.ticket_no).trim().toLowerCase() === target)
    ) || null;
}

export function mergeTicketsWithStorage(serverTickets = []) {
    const localList = getStoredTickets();
    const map = new Map();

    // Prioritize server tickets
    (serverTickets || []).forEach(t => {
        if (t && (t.id || t.ticket_no)) {
            const key = t.id || t.ticket_no;
            map.set(key, t);
        }
    });

    // Add local tickets that may not yet be on server (e.g. serverless cold start)
    localList.forEach(t => {
        if (t && (t.id || t.ticket_no)) {
            const key = t.id || t.ticket_no;
            if (!map.has(key)) {
                map.set(key, t);
            } else {
                // Merge newer fields from local if server has older data
                const s = map.get(key);
                if (new Date(t.updated_at || 0) > new Date(s.updated_at || 0)) {
                    map.set(key, { ...s, ...t });
                }
            }
        }
    });

    const merged = Array.from(map.values());
    merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // Keep localStorage updated with merged collection
    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(TICKETS_KEY, JSON.stringify(merged));
        }
    } catch (e) {}

    return merged;
}

export async function syncTicketsWithServer(ticketsToSync) {
    if (!Array.isArray(ticketsToSync) || ticketsToSync.length === 0) return;
    try {
        await fetch('/api/tickets/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickets: ticketsToSync })
        });
    } catch (e) {
        console.warn('Background ticket sync skipped:', e.message);
    }
}

// ─────────────────────────────────────────────────────────────
// Expenses Store
// ─────────────────────────────────────────────────────────────
export function getStoredExpenses(ticketId) {
    if (typeof window === 'undefined' || !ticketId) return null;
    try {
        const raw = localStorage.getItem(EXPENSES_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed[ticketId] || null;
    } catch (e) {
        return null;
    }
}

export function saveStoredExpenses(ticketId, expenses, summary) {
    if (typeof window === 'undefined' || !ticketId) return;
    try {
        const raw = localStorage.getItem(EXPENSES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[ticketId] = { expenses, summary, updated_at: new Date().toISOString() };
        localStorage.setItem(EXPENSES_KEY, JSON.stringify(map));
    } catch (e) {}
}

// ─────────────────────────────────────────────────────────────
// Timelines Store
// ─────────────────────────────────────────────────────────────
export function getStoredTimelines(ticketId) {
    if (typeof window === 'undefined' || !ticketId) return null;
    try {
        const raw = localStorage.getItem(TIMELINES_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed[ticketId] || null;
    } catch (e) {
        return null;
    }
}

export function saveStoredTimelines(ticketId, timelines) {
    if (typeof window === 'undefined' || !ticketId) return;
    try {
        const raw = localStorage.getItem(TIMELINES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[ticketId] = timelines;
        localStorage.setItem(TIMELINES_KEY, JSON.stringify(map));
    } catch (e) {}
}

// ─────────────────────────────────────────────────────────────
// Evidences Store
// ─────────────────────────────────────────────────────────────
export function getStoredEvidences(ticketId) {
    if (typeof window === 'undefined' || !ticketId) return null;
    try {
        const raw = localStorage.getItem(EVIDENCES_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed[ticketId] || null;
    } catch (e) {
        return null;
    }
}

export function saveStoredEvidences(ticketId, evidences) {
    if (typeof window === 'undefined' || !ticketId) return;
    try {
        const raw = localStorage.getItem(EVIDENCES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[ticketId] = evidences;
        localStorage.setItem(EVIDENCES_KEY, JSON.stringify(map));
    } catch (e) {}
}
