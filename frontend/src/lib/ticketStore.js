// ============================================================
// ticketStore.js — Persistent Client-Side Ticket & Workflow Cache
// Ensures tickets and actions survive serverless lambda cold starts & resets
// ============================================================

const TICKETS_KEY = 'ksu_tickets_store_v1';
const EXPENSES_KEY = 'ksu_expenses_store_v1';
const TIMELINES_KEY = 'ksu_timelines_store_v1';
const EVIDENCES_KEY = 'ksu_evidences_store_v1';
const DELETED_KEY = 'ksu_deleted_tickets_v1';
const DEFAULT_MOCK_DELETED_IDS = [
    'tkt-ksu-001', 'tkt-ksu-002', 'tkt-ksu-003',
    'id-mv5j19jv-3b0qtw8', 'id-tkt-sample-002'
].map(s => s.toLowerCase());

export function getDeletedTicketIds() {
    if (typeof window === 'undefined') return DEFAULT_MOCK_DELETED_IDS;
    try {
        const raw = localStorage.getItem(DELETED_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const merged = new Set([...DEFAULT_MOCK_DELETED_IDS, ...(Array.isArray(parsed) ? parsed.map(s => String(s).toLowerCase()) : [])]);
        return Array.from(merged);
    } catch (e) {
        return DEFAULT_MOCK_DELETED_IDS;
    }
}

export function markTicketAsDeleted(idOrNo) {
    if (typeof window === 'undefined' || !idOrNo) return;
    try {
        const target = String(idOrNo).trim().toLowerCase();
        const deleted = getDeletedTicketIds();
        if (!deleted.includes(target)) {
            deleted.push(target);
            localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
        }
    } catch (e) {}
}

export function unmarkTicketAsDeleted(idOrNo) {
    if (typeof window === 'undefined' || !idOrNo) return;
    try {
        const target = String(idOrNo).trim().toLowerCase();
        const deleted = getDeletedTicketIds().filter(d => d !== target);
        localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
    } catch (e) {}
}

export function getStoredTickets() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(TICKETS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const deleted = new Set(getDeletedTicketIds());
        return parsed.filter(t => {
            const id = String(t.id || '').trim().toLowerCase();
            const no = String(t.ticket_no || '').trim().toLowerCase();
            return !deleted.has(id) && !deleted.has(no);
        });
    } catch (e) {
        console.warn('Error reading stored tickets:', e);
        return [];
    }
}

export function saveStoredTicket(ticket) {
    if (!ticket || (!ticket.id && !ticket.ticket_no)) return;
    if (typeof window === 'undefined') return;
    try {
        // If re-adding or creating new ticket, unmark from deleted
        if (ticket.id) unmarkTicketAsDeleted(ticket.id);
        if (ticket.ticket_no) unmarkTicketAsDeleted(ticket.ticket_no);

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

        window.dispatchEvent(new CustomEvent('ksu_ticket_updated', { detail: { ticket } }));
    } catch (e) {
        console.warn('Error saving stored ticket:', e);
    }
}

export function removeStoredTicket(idOrNo) {
    if (typeof window === 'undefined' || !idOrNo) return;
    try {
        const target = String(idOrNo).trim().toLowerCase();
        markTicketAsDeleted(target);

        // Remove from stored tickets
        const currentList = [];
        try {
            const raw = localStorage.getItem(TICKETS_KEY);
            if (raw) currentList.push(...JSON.parse(raw));
        } catch (e) {}

        const filtered = currentList.filter(t => {
            const id = String(t.id || '').trim().toLowerCase();
            const no = String(t.ticket_no || '').trim().toLowerCase();
            return id !== target && no !== target;
        });
        localStorage.setItem(TICKETS_KEY, JSON.stringify(filtered));

        // Cleanup sub-stores
        [EXPENSES_KEY, TIMELINES_KEY, EVIDENCES_KEY].forEach(key => {
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const map = JSON.parse(raw);
                    delete map[idOrNo];
                    delete map[target];
                    localStorage.setItem(key, JSON.stringify(map));
                }
            } catch (e) {}
        });

        // Broadcast deletion event to all components and tabs
        window.dispatchEvent(new CustomEvent('ksu_ticket_deleted', { detail: { id: idOrNo } }));
    } catch (e) {
        console.warn('Error removing stored ticket:', e);
    }
}

export function getStoredTicket(idOrNo) {
    if (!idOrNo) return null;
    const target = String(idOrNo).trim().toLowerCase();
    const deleted = new Set(getDeletedTicketIds());
    if (deleted.has(target)) return null;

    const list = getStoredTickets();
    return list.find(t => 
        (t.id && String(t.id).trim().toLowerCase() === target) ||
        (t.ticket_no && String(t.ticket_no).trim().toLowerCase() === target)
    ) || null;
}

export function resequenceStoredTickets(providedList = null) {
    if (typeof window === 'undefined') return [];
    try {
        let list = providedList ? [...providedList] : getStoredTickets();
        const deleted = new Set(getDeletedTicketIds());
        list = list.filter(t => {
            const id = String(t.id || '').trim().toLowerCase();
            const no = String(t.ticket_no || '').trim().toLowerCase();
            return !deleted.has(id) && !deleted.has(no);
        });

        // Sort chronologically ascending
        list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

        const updated = [];
        list.forEach((t, idx) => {
            const seq = idx + 1;
            const newNo = `TKT-${String(seq).padStart(2, '0')}`;
            const oldNo = t.ticket_no;

            // Migrate child stores if ticket_no changed
            if (oldNo && oldNo !== newNo) {
                [EXPENSES_KEY, TIMELINES_KEY, EVIDENCES_KEY].forEach(key => {
                    try {
                        const raw = localStorage.getItem(key);
                        if (raw) {
                            const map = JSON.parse(raw);
                            if (map[oldNo]) {
                                map[newNo] = map[oldNo];
                                delete map[oldNo];
                                localStorage.setItem(key, JSON.stringify(map));
                            }
                        }
                    } catch (e) {}
                });
            }

            updated.push({ ...t, ticket_no: newNo });
        });

        // Save back sorted descending for display
        const displayList = [...updated].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        localStorage.setItem(TICKETS_KEY, JSON.stringify(displayList));
        window.dispatchEvent(new CustomEvent('ksu_tickets_resequenced', { detail: { tickets: displayList } }));
        return displayList;
    } catch (e) {
        console.warn('Error resequencing stored tickets:', e);
        return [];
    }
}

export function mergeTicketsWithStorage(serverTickets = []) {
    const deleted = new Set(getDeletedTicketIds());
    const map = new Map();

    // 1. First populate all valid local tickets (guaranteed persistence across Ctrl+R & serverless cold boots)
    const localList = getStoredTickets();
    localList.forEach(t => {
        if (!t) return;
        const id = String(t.id || '').trim().toLowerCase();
        const no = String(t.ticket_no || '').trim().toLowerCase();
        if (!deleted.has(id) && !deleted.has(no)) {
            const key = t.id || t.ticket_no;
            if (key) map.set(key, t);
        }
    });

    // 2. Merge server tickets (preserving local tickets and applying newer updates from server)
    (serverTickets || []).forEach(t => {
        if (!t) return;
        const id = String(t.id || '').trim().toLowerCase();
        const no = String(t.ticket_no || '').trim().toLowerCase();
        if (!deleted.has(id) && !deleted.has(no)) {
            const key = t.id || t.ticket_no;
            if (!key) return;
            if (!map.has(key)) {
                map.set(key, t);
            } else {
                const localT = map.get(key);
                if (new Date(t.updated_at || 0) >= new Date(localT.updated_at || 0)) {
                    map.set(key, { ...localT, ...t });
                }
            }
        }
    });

    const merged = Array.from(map.values());
    merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(TICKETS_KEY, JSON.stringify(merged));
        }
    } catch (e) {}

    return merged;
}

export async function syncTicketsWithServer(ticketsToSync) {
    if (!Array.isArray(ticketsToSync) || ticketsToSync.length === 0) return;
    const deleted = new Set(getDeletedTicketIds());
    const valid = ticketsToSync.filter(t => {
        if (!t) return false;
        const id = String(t.id || '').trim().toLowerCase();
        const no = String(t.ticket_no || '').trim().toLowerCase();
        return !deleted.has(id) && !deleted.has(no);
    });
    if (valid.length === 0) return;

    try {
        await fetch('/api/tickets/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickets: valid })
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

export function saveStoredExpenses(ticketId, expenses, summary, ticketNo = null) {
    if (typeof window === 'undefined' || !ticketId) return;
    try {
        const raw = localStorage.getItem(EXPENSES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        const payload = { expenses, summary, updated_at: new Date().toISOString() };
        map[ticketId] = payload;
        if (ticketNo) map[ticketNo] = payload;
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

export function saveStoredTimelines(ticketId, timelines, ticketNo = null) {
    if (typeof window === 'undefined' || !ticketId) return;
    try {
        const raw = localStorage.getItem(TIMELINES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[ticketId] = timelines;
        if (ticketNo) map[ticketNo] = timelines;
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

export function saveStoredEvidences(ticketId, evidences, ticketNo = null) {
    if (typeof window === 'undefined' || !ticketId) return;
    try {
        const raw = localStorage.getItem(EVIDENCES_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[ticketId] = evidences;
        if (ticketNo) map[ticketNo] = evidences;
        localStorage.setItem(EVIDENCES_KEY, JSON.stringify(map));
    } catch (e) {}
}
