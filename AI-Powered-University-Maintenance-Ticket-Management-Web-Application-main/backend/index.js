const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { notifyTicketEvent, sendTestNotification, getSettings } = require('./notifications');

const usersFilePath = path.join(__dirname, 'data', 'users.json');
const dbFilePath = path.join(__dirname, 'data', 'db.json');

function getLocalDb() {
    try {
        if (fs.existsSync(dbFilePath)) {
            return JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading db.json:', e);
    }
    return { issueTypes: [], tickets: [], counter: 0 };
}

function saveLocalDb(data) {
    try {
        fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving db.json:', e);
    }
}

function getLocalUsers() {
    try {
        if (fs.existsSync(usersFilePath)) {
            return JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading users.json:', e);
    }
    return [];
}

function saveLocalUsers(users) {
    try {
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing users.json:', e);
    }
}

// Resilient Prisma client with automatic JSON-store fallback
let realPrisma = null;
try {
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    if (p && typeof p.$connect === 'function') {
        realPrisma = p;
    }
} catch (e) {
    // Falls back seamlessly to resilient JSON-based storage
}

const prisma = {
    issueType: {
        findMany: async () => {
            if (realPrisma) {
                try { return await realPrisma.issueType.findMany({ orderBy: { name: 'asc' } }); } catch (e) {}
            }
            const db = getLocalDb();
            return (db.issueTypes || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        },
        create: async ({ data }) => {
            if (realPrisma) {
                try { return await realPrisma.issueType.create({ data }); } catch (e) {}
            }
            const db = getLocalDb();
            db.issueTypes = db.issueTypes || [];
            db.issueTypes.push(data);
            saveLocalDb(db);
            return data;
        },
        update: async ({ where, data }) => {
            if (realPrisma) {
                try { return await realPrisma.issueType.update({ where, data }); } catch (e) {}
            }
            const db = getLocalDb();
            const idx = (db.issueTypes || []).findIndex(it => it.id === where.id);
            if (idx >= 0) {
                db.issueTypes[idx] = { ...db.issueTypes[idx], ...data };
                saveLocalDb(db);
                return db.issueTypes[idx];
            }
            return data;
        },
        delete: async ({ where }) => {
            if (realPrisma) {
                try { return await realPrisma.issueType.delete({ where }); } catch (e) {}
            }
            const db = getLocalDb();
            db.issueTypes = (db.issueTypes || []).filter(it => it.id !== where.id);
            saveLocalDb(db);
            return { id: where.id };
        },
        count: async () => {
            if (realPrisma) {
                try { return await realPrisma.issueType.count(); } catch (e) {}
            }
            return (getLocalDb().issueTypes || []).length;
        },
        upsert: async ({ where, update, create }) => {
            if (realPrisma) {
                try { return await realPrisma.issueType.upsert({ where, update, create }); } catch (e) {}
            }
            const db = getLocalDb();
            const idx = (db.issueTypes || []).findIndex(it => it.id === where.id);
            if (idx >= 0) {
                db.issueTypes[idx] = { ...db.issueTypes[idx], ...update };
                saveLocalDb(db);
                return db.issueTypes[idx];
            } else {
                db.issueTypes = db.issueTypes || [];
                db.issueTypes.push(create);
                saveLocalDb(db);
                return create;
            }
        }
    },
    ticket: {
        findMany: async ({ select, orderBy } = {}) => {
            if (realPrisma) {
                try { return await realPrisma.ticket.findMany({ select, orderBy }); } catch (e) {}
            }
            const db = getLocalDb();
            const list = [...(db.tickets || [])];
            list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            return list;
        },
        findFirst: async ({ where } = {}) => {
            if (realPrisma) {
                try { return await realPrisma.ticket.findFirst({ where }); } catch (e) {}
            }
            const db = getLocalDb();
            const id = where?.id || (where?.OR && where.OR[0]?.id);
            const ticketNo = where?.ticket_no || (where?.OR && where.OR[1]?.ticket_no);
            return (db.tickets || []).find(t => (id && t.id === id) || (ticketNo && t.ticket_no === ticketNo)) || null;
        },
        create: async ({ data }) => {
            if (realPrisma) {
                try { return await realPrisma.ticket.create({ data }); } catch (e) {}
            }
            const db = getLocalDb();
            db.tickets = db.tickets || [];
            db.tickets.unshift(data);
            saveLocalDb(db);
            return data;
        },
        update: async ({ where, data }) => {
            if (realPrisma) {
                try { return await realPrisma.ticket.update({ where, data }); } catch (e) {}
            }
            const db = getLocalDb();
            const idx = (db.tickets || []).findIndex(t => t.id === where.id);
            if (idx >= 0) {
                db.tickets[idx] = { ...db.tickets[idx], ...data };
                saveLocalDb(db);
                return db.tickets[idx];
            }
            return data;
        },
        delete: async ({ where }) => {
            if (realPrisma) {
                try { return await realPrisma.ticket.delete({ where }); } catch (e) {}
            }
            const db = getLocalDb();
            db.tickets = (db.tickets || []).filter(t => t.id !== where.id);
            saveLocalDb(db);
            return { id: where.id };
        },
        count: async () => {
            if (realPrisma) {
                try { return await realPrisma.ticket.count(); } catch (e) {}
            }
            return (getLocalDb().tickets || []).length;
        },
        upsert: async ({ where, update, create }) => {
            if (realPrisma) {
                try { return await realPrisma.ticket.upsert({ where, update, create }); } catch (e) {}
            }
            const db = getLocalDb();
            const idx = (db.tickets || []).findIndex(t => t.id === where.id);
            if (idx >= 0) {
                db.tickets[idx] = { ...db.tickets[idx], ...update };
                saveLocalDb(db);
                return db.tickets[idx];
            } else {
                db.tickets = db.tickets || [];
                db.tickets.push(create);
                saveLocalDb(db);
                return create;
            }
        }
    },
    user: {
        findMany: async () => {
            if (realPrisma) {
                try { return await realPrisma.user.findMany(); } catch (e) {}
            }
            return getLocalUsers();
        },
        findUnique: async ({ where }) => {
            if (realPrisma) {
                try { return await realPrisma.user.findUnique({ where }); } catch (e) {}
            }
            const users = getLocalUsers();
            return users.find(u => u.email.toLowerCase() === (where.email || '').toLowerCase()) || null;
        },
        create: async ({ data }) => {
            if (realPrisma) {
                try { return await realPrisma.user.create({ data }); } catch (e) {}
            }
            const users = getLocalUsers();
            users.push(data);
            saveLocalUsers(users);
            return data;
        },
        count: async () => {
            if (realPrisma) {
                try { return await realPrisma.user.count(); } catch (e) {}
            }
            return getLocalUsers().length;
        },
        upsert: async ({ where, update, create }) => {
            if (realPrisma) {
                try { return await realPrisma.user.upsert({ where, update, create }); } catch (e) {}
            }
            const users = getLocalUsers();
            const idx = users.findIndex(u => u.email.toLowerCase() === (where.email || '').toLowerCase());
            if (idx >= 0) {
                users[idx] = { ...users[idx], ...update };
                saveLocalUsers(users);
                return users[idx];
            } else {
                users.push(create);
                saveLocalUsers(users);
                return create;
            }
        }
    }
};

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'ksu_smart_maintain_jwt_secret_2026';

app.use(cors());
app.use(express.json());

// Public static directory for uploads
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
        cb(null, uniqueName);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper: Auto-initialize Database with Schema Sync & Seed Data if Empty
async function initDatabase() {
    const { exec } = require('child_process');
    console.log('🔄 Initializing database and syncing schema...');
    
    // Non-blocking schema push
    exec('npx --yes prisma db push --skip-generate', { timeout: 15000 }, (error) => {
        if (error) {
            console.warn('ℹ️ Prisma db push note (safe fallback active):', error.message);
        } else {
            console.log('✅ Prisma database schema verified.');
        }
    });

    try {
        const issueTypeCount = await prisma.issueType.count();
        if (issueTypeCount === 0) {
            console.log('🔄 Seeding initial database from data/db.json...');
            const seedPath = path.join(__dirname, 'data', 'db.json');
            if (fs.existsSync(seedPath)) {
                const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

                for (const it of seedData.issueTypes || []) {
                    await prisma.issueType.upsert({
                        where: { id: it.id },
                        update: {},
                        create: {
                            id: it.id,
                            name: it.name,
                            description: it.description || '',
                            icon: it.icon || 'circle-help'
                        }
                    });
                }

                for (const t of seedData.tickets || []) {
                    await prisma.ticket.upsert({
                        where: { id: t.id },
                        update: {},
                        create: {
                            id: t.id,
                            ticket_no: t.ticket_no,
                            title: t.title,
                            description: t.description || '',
                            issue_type: t.issue_type,
                            location: t.location || '',
                            priority: t.priority || 'Medium',
                            status: t.status || 'Open',
                            requester_name: t.requester_name || '',
                            requester_email: t.requester_email || '',
                            assigned_to: t.assigned_to || null,
                            resolution_note: t.resolution_note || null,
                            created_at: new Date(t.created_at || Date.now()),
                            updated_at: new Date(t.updated_at || Date.now()),
                            closed_at: t.closed_at ? new Date(t.closed_at) : null
                        }
                    });
                }
                console.log('✅ Initial database successfully seeded!');
            }
        } else {
            console.log(`✅ Database ready with ${issueTypeCount} issue types.`);
        }

        // Seed initial users if table is empty
        try {
            const userCount = await prisma.user.count();
            if (userCount === 0) {
                console.log('🔄 Seeding initial users...');
                const localUsers = getLocalUsers();
                for (const u of localUsers) {
                    await prisma.user.upsert({
                        where: { email: u.email },
                        update: {},
                        create: {
                            id: u.id,
                            email: u.email,
                            password: u.password,
                            name: u.name,
                            group: u.group || 'นักศึกษา',
                            role: u.role || 'user',
                            created_at: new Date(u.created_at || Date.now())
                        }
                    });
                }
                console.log('✅ Initial users successfully seeded into PostgreSQL!');
            } else {
                console.log(`✅ Database ready with ${userCount} users.`);
            }
        } catch (uErr) {
            console.warn('Prisma user check/seed note:', uErr.message);
        }
    } catch (err) {
        console.warn('ℹ️ PostgreSQL not immediately ready, running in resilient mode:', err.message);
    }
}

// ─────────────────────────────────────────────────────────────
// Health Check API
// ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

// ─────────────────────────────────────────────────────────────
// Issue Types API
// ─────────────────────────────────────────────────────────────
app.get('/api/issue-types', async (req, res) => {
    try {
        const types = await prisma.issueType.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(types);
    } catch (error) {
        console.error('Error fetching issue types:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/issue-types', async (req, res) => {
    try {
        const { name, description, icon } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const id = 'it-' + Date.now().toString(36);
        const newType = await prisma.issueType.create({
            data: {
                id,
                name,
                description: description || '',
                icon: icon || 'circle-help'
            }
        });
        res.status(201).json(newType);
    } catch (error) {
        console.error('Error creating issue type:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.put('/api/issue-types/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, icon } = req.body;

        const updated = await prisma.issueType.update({
            where: { id },
            data: {
                name,
                description: description || '',
                icon: icon || 'circle-help'
            }
        });
        res.json(updated);
    } catch (error) {
        console.error('Error updating issue type:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/api/issue-types/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.issueType.delete({ where: { id } });
        res.json({ success: true, message: 'Issue type deleted' });
    } catch (error) {
        console.error('Error deleting issue type:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────
// Tickets API
// ─────────────────────────────────────────────────────────────
app.get('/api/tickets', async (req, res) => {
    try {
        const {
            query,
            status,
            priority,
            issue_type,
            assigned_to,
            requester_name,
            requester_email,
            requester_group,
            period,
            startDate,
            endDate
        } = req.query;

        let tickets = await prisma.ticket.findMany({
            orderBy: { created_at: 'desc' }
        });

        // Date Filtering
        const now = new Date();
        if (period === 'day') {
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            tickets = tickets.filter(t => new Date(t.created_at) >= oneDayAgo);
        } else if (period === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            tickets = tickets.filter(t => new Date(t.created_at) >= oneWeekAgo);
        } else if (period === 'month') {
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

        // Text query search
        if (query) {
            const q = query.toLowerCase().trim();
            tickets = tickets.filter(t =>
                (t.ticket_no && t.ticket_no.toLowerCase().includes(q)) ||
                (t.title && t.title.toLowerCase().includes(q)) ||
                (t.description && t.description.toLowerCase().includes(q))
            );
        }

        if (status) tickets = tickets.filter(t => t.status === status);
        if (priority) tickets = tickets.filter(t => t.priority === priority);
        if (issue_type) tickets = tickets.filter(t => t.issue_type === issue_type);

        if (assigned_to) {
            if (assigned_to === 'unassigned') {
                tickets = tickets.filter(t => !t.assigned_to);
            } else {
                tickets = tickets.filter(t => t.assigned_to === assigned_to);
            }
        }

        if (requester_name) {
            tickets = tickets.filter(t => t.requester_name && t.requester_name.toLowerCase().trim() === requester_name.toLowerCase().trim());
        }

        if (requester_email) {
            tickets = tickets.filter(t => t.requester_email && t.requester_email.toLowerCase().trim() === requester_email.toLowerCase().trim());
        }

        if (requester_group) {
            tickets = tickets.filter(t => {
                const match = t.requester_name && t.requester_name.match(/\((นักศึกษา|อาจารย์|เจ้าหน้าที่|เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์|ผู้ดูแลระบบ)\)$/);
                return match && match[1] === requester_group;
            });
        }

        res.json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/tickets', async (req, res) => {
    try {
        const body = req.body;
        if (!body.title || !body.description || !body.issue_type || !body.location || !body.requester_name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Generate Ticket Number (e.g. TKT-001, TKT-002, ...)
        const existingTickets = await prisma.ticket.findMany({ select: { ticket_no: true } });
        let maxNum = 0;
        let paddingLength = 3;
        existingTickets.forEach(t => {
            if (t.ticket_no) {
                const match = t.ticket_no.match(/TKT-(\d+)/i);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNum) {
                        maxNum = num;
                        paddingLength = match[1].length;
                    }
                }
            }
        });
        const nextNum = maxNum + 1;
        const ticketNo = 'TKT-' + String(nextNum).padStart(Math.max(3, paddingLength), '0');

        const now = new Date();
        const id = 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);

        // Format requester name with group if needed
        const reqName = (/\((นักศึกษา|อาจารย์|เจ้าหน้าที่|เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์|ผู้ดูแลระบบ)\)$/.test(body.requester_name) || !body.requester_group)
            ? body.requester_name
            : `${body.requester_name} (${body.requester_group})`;

        const newTicket = await prisma.ticket.create({
            data: {
                id,
                ticket_no: ticketNo,
                title: body.title,
                description: body.description,
                issue_type: body.issue_type,
                location: body.location || '',
                priority: body.priority || 'Medium',
                status: 'Open',
                requester_name: reqName,
                requester_email: body.requester_email || '',
                assigned_to: body.assigned_to || null,
                resolution_note: null,
                created_at: now,
                updated_at: now,
                closed_at: null
            }
        });

        // Send email & webhook notification asynchronously
        notifyTicketEvent(newTicket, 'CREATED').catch(err => {
            console.error('Ticket creation notification error:', err.message);
        });

        res.status(201).json(newTicket);
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/tickets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const ticket = await prisma.ticket.findFirst({
            where: {
                OR: [
                    { id },
                    { ticket_no: id }
                ]
            }
        });

        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json(ticket);
    } catch (error) {
        console.error('Error fetching ticket by ID:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const handleUpdateTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const now = new Date();

        const updateData = {
            ...updates,
            updated_at: now
        };
        delete updateData.id;
        delete updateData.ticket_no;
        delete updateData.created_at;

        if (['Closed', 'Cancelled', 'Resolved'].includes(updates.status)) {
            updateData.closed_at = now;
        } else if (updates.status && !['Closed', 'Cancelled', 'Resolved'].includes(updates.status)) {
            updateData.closed_at = null;
        }

        const updated = await prisma.ticket.update({
            where: { id },
            data: updateData
        });

        // Send email & webhook notification asynchronously on update
        notifyTicketEvent(updated, 'UPDATED').catch(err => {
            console.error('Ticket update notification error:', err.message);
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

app.patch('/api/tickets/:id', handleUpdateTicket);
app.put('/api/tickets/:id', handleUpdateTicket);

app.delete('/api/tickets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.ticket.delete({ where: { id } });
        res.json({ success: true, message: 'Ticket deleted successfully' });
    } catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────
// Statistics API (Dashboard & Home Stats)
// ─────────────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
    try {
        const [allTickets, issueTypes] = await Promise.all([
            prisma.ticket.findMany({ orderBy: { created_at: 'desc' } }),
            prisma.issueType.findMany({ orderBy: { name: 'asc' } })
        ]);

        const { period = 'all', startDate, endDate } = req.query;
        let filteredTickets = allTickets;
        const now = new Date();

        if (period === 'day') {
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            filteredTickets = allTickets.filter(t => new Date(t.created_at) >= oneDayAgo);
        } else if (period === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            filteredTickets = allTickets.filter(t => new Date(t.created_at) >= oneWeekAgo);
        } else if (period === 'month') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            filteredTickets = allTickets.filter(t => new Date(t.created_at) >= oneMonthAgo);
        } else if (period === 'custom' && startDate) {
            const start = new Date(startDate);
            const end = endDate ? new Date(endDate) : new Date(startDate);
            filteredTickets = allTickets.filter(t => {
                const d = new Date(t.created_at);
                return d >= start && d <= end;
            });
        }

        const allTimeStats = {
            total: allTickets.length,
            byStatus: {
                'Open': 0,
                'In Progress': 0,
                'Waiting for Information': 0,
                'Resolved': 0,
                'Closed': 0,
                'Cancelled': 0
            },
            byPriority: {
                'Low': 0,
                'Medium': 0,
                'High': 0,
                'Urgent': 0
            }
        };

        allTickets.forEach(t => {
            if (allTimeStats.byStatus[t.status] !== undefined) allTimeStats.byStatus[t.status]++;
            if (allTimeStats.byPriority[t.priority] !== undefined) allTimeStats.byPriority[t.priority]++;
        });

        const periodStats = {
            byStatus: {
                'Open': 0,
                'In Progress': 0,
                'Waiting for Information': 0,
                'Resolved': 0,
                'Closed': 0,
                'Cancelled': 0
            },
            byPriority: {
                'Low': 0,
                'Medium': 0,
                'High': 0,
                'Urgent': 0
            },
            byIssueType: {}
        };

        issueTypes.forEach(it => {
            periodStats.byIssueType[it.name] = 0;
        });

        filteredTickets.forEach(t => {
            if (periodStats.byStatus[t.status] !== undefined) periodStats.byStatus[t.status]++;
            if (periodStats.byPriority[t.priority] !== undefined) periodStats.byPriority[t.priority]++;
            if (t.issue_type) {
                periodStats.byIssueType[t.issue_type] = (periodStats.byIssueType[t.issue_type] || 0) + 1;
            }
        });

        // User-configured or dynamically assigned technicians (No hardcoded names!)
        let configuredTechs = [];
        try {
            if (fs.existsSync(settingsPath)) {
                const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                configuredTechs = Array.isArray(s.technicians) ? s.technicians : [];
            }
        } catch (e) {}

        const assignedInTickets = [...new Set(filteredTickets.map(t => t.assigned_to).filter(Boolean))];
        const allTechnicians = [...new Set([...configuredTechs, ...assignedInTickets])];

        const workloads = {};
        allTechnicians.forEach(tech => {
            workloads[tech] = {
                total: 0,
                open: 0,
                inProgress: 0,
                waiting: 0,
                resolved: 0,
                closed: 0,
                cancelled: 0,
                active: 0
            };
        });

        // Only count unassigned if there are unassigned tickets and at least 1 technician or ticket exists
        const hasUnassigned = filteredTickets.some(t => !t.assigned_to);
        if (hasUnassigned && filteredTickets.length > 0 && allTechnicians.length > 0) {
            workloads['ยังไม่ได้มอบหมาย'] = {
                total: 0,
                open: 0,
                inProgress: 0,
                waiting: 0,
                resolved: 0,
                closed: 0,
                cancelled: 0,
                active: 0
            };
        }

        filteredTickets.forEach(t => {
            const tech = t.assigned_to || (workloads['ยังไม่ได้มอบหมาย'] ? 'ยังไม่ได้มอบหมาย' : null);
            if (tech) {
                if (!workloads[tech]) {
                    workloads[tech] = {
                        total: 0,
                        open: 0,
                        inProgress: 0,
                        waiting: 0,
                        resolved: 0,
                        closed: 0,
                        cancelled: 0,
                        active: 0
                    };
                }
                workloads[tech].total++;
                if (t.status === 'Open') workloads[tech].open++;
                else if (t.status === 'In Progress') workloads[tech].inProgress++;
                else if (t.status === 'Waiting for Information') workloads[tech].waiting++;
                else if (t.status === 'Resolved') workloads[tech].resolved++;
                else if (t.status === 'Closed') workloads[tech].closed++;
                else if (t.status === 'Cancelled') workloads[tech].cancelled++;

                if (['Open', 'In Progress', 'Waiting for Information'].includes(t.status)) {
                    workloads[tech].active++;
                }
            }
        });

        res.json({
            total: filteredTickets.length,
            allTimeStats,
            byStatus: periodStats.byStatus,
            byPriority: periodStats.byPriority,
            byIssueType: periodStats.byIssueType,
            recentTickets: filteredTickets.slice(0, 5),
            ticketsForPeriod: filteredTickets,
            workloads
        });
    } catch (error) {
        console.error('Error calculating stats:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────
// Settings API & Staff / Technicians API (User-Configurable)
// ─────────────────────────────────────────────────────────────
const settingsPath = path.join(__dirname, 'data', 'settings.json');

app.get('/api/settings', (req, res) => {
    try {
        const settings = getSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/settings', (req, res) => {
    try {
        const body = req.body;
        const prev = getSettings();
        const cleanSettings = {
            notify_emails: body.notify_emails !== undefined ? String(body.notify_emails).trim() : (prev.notify_emails || ''),
            smtp_enabled: body.smtp_enabled !== undefined ? Boolean(body.smtp_enabled) : (prev.smtp_enabled !== false),
            smtp_host: body.smtp_host !== undefined ? String(body.smtp_host).trim() : (prev.smtp_host || 'smtp.gmail.com'),
            smtp_port: body.smtp_port !== undefined ? Number(body.smtp_port) : (prev.smtp_port || 465),
            smtp_secure: body.smtp_secure !== undefined ? Boolean(body.smtp_secure) : (prev.smtp_secure !== false),
            smtp_user: body.smtp_user !== undefined ? String(body.smtp_user).trim() : (prev.smtp_user || ''),
            smtp_pass: body.smtp_pass !== undefined ? String(body.smtp_pass).trim() : (prev.smtp_pass || ''),
            sender_name: body.sender_name !== undefined ? String(body.sender_name).trim() : (prev.sender_name || 'KSU Smart Maintain (แจ้งซ่อม)'),
            sender_email: body.sender_email !== undefined ? String(body.sender_email).trim() : (prev.sender_email || 'ksu.smart.maintain@gmail.com'),
            discord_webhook_url: body.discord_webhook_url !== undefined ? String(body.discord_webhook_url).trim() : (prev.discord_webhook_url || ''),
            emailjs_service_id: body.emailjs_service_id !== undefined ? String(body.emailjs_service_id).trim() : (prev.emailjs_service_id || ''),
            emailjs_template_id: body.emailjs_template_id !== undefined ? String(body.emailjs_template_id).trim() : (prev.emailjs_template_id || ''),
            emailjs_public_key: body.emailjs_public_key !== undefined ? String(body.emailjs_public_key).trim() : (prev.emailjs_public_key || ''),
            emailjs_private_key: body.emailjs_private_key !== undefined ? String(body.emailjs_private_key).trim() : (prev.emailjs_private_key || ''),
            technicians: Array.isArray(body.technicians) ? body.technicians : (prev.technicians || [])
        };
        fs.writeFileSync(settingsPath, JSON.stringify(cleanSettings, null, 2), 'utf8');
        res.json({ success: true, settings: cleanSettings });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/staff', (req, res) => {
    try {
        let settings = { technicians: [] };
        if (fs.existsSync(settingsPath)) {
            try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (e) {}
        }
        const configuredTechs = Array.isArray(settings.technicians) ? settings.technicians : [];
        res.json(configuredTechs);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/staff', (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const cleanName = String(name).trim();
        let settings = { technicians: [] };
        if (fs.existsSync(settingsPath)) {
            try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (e) {}
        }
        const techs = Array.isArray(settings.technicians) ? settings.technicians : [];
        if (!techs.includes(cleanName)) {
            techs.push(cleanName);
            settings.technicians = techs;
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        }
        res.status(201).json({ success: true, staff: techs });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/api/staff/:name', (req, res) => {
    try {
        const { name } = req.params;
        const targetName = decodeURIComponent(name).trim();
        let settings = { technicians: [] };
        if (fs.existsSync(settingsPath)) {
            try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (e) {}
        }
        let techs = Array.isArray(settings.technicians) ? settings.technicians : [];
        techs = techs.filter(t => t !== targetName);
        settings.technicians = techs;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        res.json({ success: true, staff: techs });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.patch('/api/settings', async (req, res) => {
    try {
        const targetEmail = req.body.test_email || req.body.target_email;
        const result = await sendTestNotification(targetEmail);
        res.json({ success: true, message: 'ส่งข้อความแจ้งเตือนทดสอบเรียบร้อยแล้ว', details: result });
    } catch (error) {
        console.error('Test notification failed:', error.message);
        res.status(400).json({ success: false, error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// File Upload API
// ─────────────────────────────────────────────────────────────
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const publicUrl = `/uploads/${req.file.filename}`;
        res.json({
            url: publicUrl,
            name: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// ─────────────────────────────────────────────────────────────
// Real Auth API (Signup, Login, Me)
// ─────────────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, fullName, userGroup } = req.body;
        if (!email || !password || !fullName) {
            return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน (อีเมล, รหัสผ่าน, ชื่อ-นามสกุล)' });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const cleanName = String(fullName).trim();
        const cleanGroup = userGroup ? String(userGroup).trim() : 'นักศึกษา';

        // Auto assign role based on group or admin email
        const role = (
            cleanEmail.includes('admin') ||
            cleanGroup === 'ผู้ดูแลระบบ' ||
            cleanGroup === 'เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์'
        ) ? 'admin' : 'user';

        // Check if user already exists in DB or local store
        let existingUser = null;
        try {
            existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
        } catch (dbErr) {
            const localUsers = getLocalUsers();
            existingUser = localUsers.find(u => u.email.toLowerCase() === cleanEmail);
        }

        if (existingUser) {
            return res.status(400).json({ error: 'อีเมลนี้ถูกลงทะเบียนไว้ในระบบแล้ว กรุณาเข้าสู่ระบบ' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const userId = 'usr-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);

        const newUserObj = {
            id: userId,
            email: cleanEmail,
            password: hashedPassword,
            plainPasswordFallback: password,
            name: cleanName,
            group: cleanGroup,
            role: role,
            created_at: new Date().toISOString()
        };

        // Attempt save to PostgreSQL via Prisma
        try {
            await prisma.user.create({
                data: {
                    id: userId,
                    email: cleanEmail,
                    password: hashedPassword,
                    name: cleanName,
                    group: cleanGroup,
                    role: role
                }
            });
            console.log(`👤 User created in DB: ${cleanEmail} (${cleanName})`);
        } catch (dbErr) {
            console.warn('Prisma user creation note, falling back to local file store:', dbErr.message);
        }

        // Always sync to local users.json for resilience
        const currentUsers = getLocalUsers();
        currentUsers.push(newUserObj);
        saveLocalUsers(currentUsers);

        // Generate JWT token
        const token = jwt.sign(
            { id: userId, email: cleanEmail, name: cleanName, role: role, group: cleanGroup },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'สมัครสมาชิกสำเร็จ',
            token,
            user: {
                id: userId,
                email: cleanEmail,
                name: cleanName,
                group: cleanGroup,
                role: role
            }
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่อีกครั้ง' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        // Find user from Prisma or local fallback
        let foundUser = null;
        try {
            foundUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
        } catch (dbErr) {
            console.warn('Prisma login query note:', dbErr.message);
        }

        if (!foundUser) {
            const localUsers = getLocalUsers();
            foundUser = localUsers.find(u => u.email.toLowerCase() === cleanEmail);
        }

        if (!foundUser) {
            return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        // Check password (bcrypt or fallback)
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, foundUser.password);
        } catch (e) {
            isMatch = false;
        }

        if (!isMatch && foundUser.plainPasswordFallback) {
            isMatch = password === foundUser.plainPasswordFallback;
        }
        if (!isMatch && password === foundUser.password) {
            isMatch = true;
        }

        if (!isMatch) {
            return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: foundUser.id, email: foundUser.email, name: foundUser.name, role: foundUser.role, group: foundUser.group },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`🔓 User logged in: ${foundUser.email} (${foundUser.name})`);

        res.json({
            success: true,
            message: 'เข้าสู่ระบบสำเร็จ',
            token,
            user: {
                id: foundUser.id,
                email: foundUser.email,
                name: foundUser.name,
                group: foundUser.group,
                role: foundUser.role
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง' });
    }
});

app.get('/api/auth/me', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ user: decoded });
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
});

// Start Server and Initialize Database
app.listen(PORT, () => {
    console.log(`🚀 University Maintenance Backend running on port ${PORT}`);
    initDatabase().catch(err => console.warn('Database initialization note:', err.message));
});
