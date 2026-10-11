// ============================================================
// db.js — Safe Database & Client Auth Service
// ============================================================

// Safe Client Auth & Storage to prevent any runtime crashes
export const supabase = {
    auth: {
        async getSession() {
            return { data: { session: null }, error: null };
        },
        onAuthStateChange(_cb) {
            return {
                data: {
                    subscription: {
                        unsubscribe: () => {}
                    }
                }
            };
        },
        async signInWithPassword({ email, password }) {
            return { data: { user: { email }, session: null }, error: null };
        },
        async signOut() {
            return { error: null };
        }
    },
    storage: {
        from() {
            return {
                getPublicUrl(path) {
                    return { data: { publicUrl: path } };
                },
                async upload() {
                    return { data: null, error: new Error('Storage not configured') };
                }
            };
        },
        async listBuckets() {
            return { data: [], error: null };
        }
    },
    from(tableName) {
        return {
            select() { return this; },
            insert() { return this; },
            update() { return this; },
            delete() { return this; },
            eq() { return this; },
            order() { return this; },
            maybeSingle() { return Promise.resolve({ data: null, error: null }); },
            single() { return Promise.resolve({ data: null, error: null }); },
            then(resolve) { resolve({ data: [], error: null }); }
        };
    }
};

export const DbService = {
    async getTickets() {
        const res = await fetch('/api/tickets');
        if (!res.ok) return [];
        return res.json();
    },
    async getTicketById(id) {
        const res = await fetch(`/api/tickets/${id}`);
        if (!res.ok) return null;
        return res.json();
    },
    async createTicket(ticketData) {
        const res = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ticketData)
        });
        if (!res.ok) throw new Error('Failed to create ticket');
        return res.json();
    },
    async updateTicket(id, updates) {
        const res = await fetch(`/api/tickets/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update ticket');
        return res.json();
    },
    async deleteTicket(id) {
        const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete ticket');
        return true;
    },
    async getIssueTypes() {
        const res = await fetch('/api/issue-types');
        if (!res.ok) return [];
        return res.json();
    },
    async getIssueTypeById(id) {
        const res = await fetch(`/api/issue-types/${id}`);
        if (!res.ok) return null;
        return res.json();
    },
    async createIssueType(typeData) {
        const res = await fetch('/api/issue-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(typeData)
        });
        if (!res.ok) throw new Error('Failed to create issue type');
        return res.json();
    },
    async updateIssueType(id, updates) {
        const res = await fetch(`/api/issue-types/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update issue type');
        return res.json();
    },
    async deleteIssueType(id) {
        const res = await fetch(`/api/issue-types/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete issue type');
        return true;
    }
};
