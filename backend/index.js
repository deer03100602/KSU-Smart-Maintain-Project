const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { notifyTicketEvent, sendTestNotification, getSettings } = require('./notifications');
const { 
    notifyDiscordUrgent, 
    notifyDiscordPayment, 
    notifyDiscordNewOrder, 
    notifyDiscordSystemError,
    notifyDiscordActivity 
} = require('./discordService');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const baseDataDir = isServerless ? '/tmp' : path.join(__dirname, 'data');

if (!fs.existsSync(baseDataDir)) {
    try { fs.mkdirSync(baseDataDir, { recursive: true }); } catch (e) {}
}

const usersFilePath = path.join(baseDataDir, 'users.json');
const dbFilePath = path.join(baseDataDir, 'db.json');
const bundledDbPath = path.join(__dirname, 'data', 'db.json');
const bundledUsersPath = path.join(__dirname, 'data', 'users.json');

function getLocalDb() {
    try {
        let db = null;
        if (fs.existsSync(dbFilePath)) {
            try { db = JSON.parse(fs.readFileSync(dbFilePath, 'utf8')); } catch (e) {}
        }
        if (!db && fs.existsSync(bundledDbPath)) {
            try {
                db = JSON.parse(fs.readFileSync(bundledDbPath, 'utf8'));
                fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2), 'utf8');
            } catch (e) {}
        }
        if (db) {
            const deletedSet = new Set((db.deletedTicketIds || []).map(d => String(d).trim().toLowerCase()));

            // Guarantee bundled sample tickets, timelines, expenses and evidences are merged if missing
            if (fs.existsSync(bundledDbPath)) {
                try {
                    const bundled = JSON.parse(fs.readFileSync(bundledDbPath, 'utf8'));
                    if (!db.tickets || db.tickets.length === 0) {
                        db.tickets = (bundled.tickets || []).filter(t => {
                            const id = String(t.id || '').trim().toLowerCase();
                            const no = String(t.ticket_no || '').trim().toLowerCase();
                            return !deletedSet.has(id) && !deletedSet.has(no);
                        });
                    }
                    const existingExpIds = new Set((db.expenses || []).map(e => e.id));
                    (bundled.expenses || []).forEach(e => {
                        const tId = String(e.ticket_id || '').trim().toLowerCase();
                        const tNo = String(e.ticket_no || '').trim().toLowerCase();
                        if (!existingExpIds.has(e.id) && !deletedSet.has(tId) && !deletedSet.has(tNo)) {
                            db.expenses = db.expenses || [];
                            db.expenses.push(e);
                        }
                    });
                    const existingTmlIds = new Set((db.timelines || []).map(t => t.id));
                    (bundled.timelines || []).forEach(t => {
                        const tId = String(t.ticket_id || '').trim().toLowerCase();
                        const tNo = String(t.ticket_no || '').trim().toLowerCase();
                        if (!existingTmlIds.has(t.id) && !deletedSet.has(tId) && !deletedSet.has(tNo)) {
                            db.timelines = db.timelines || [];
                            db.timelines.push(t);
                        }
                    });
                    const existingEviIds = new Set((db.evidences || []).map(ev => ev.id));
                    (bundled.evidences || []).forEach(ev => {
                        const tId = String(ev.ticket_id || '').trim().toLowerCase();
                        const tNo = String(ev.ticket_no || '').trim().toLowerCase();
                        if (!existingEviIds.has(ev.id) && !deletedSet.has(tId) && !deletedSet.has(tNo)) {
                            db.evidences = db.evidences || [];
                            db.evidences.push(ev);
                        }
                    });
                } catch (e) {}
            }

            // Always ensure no deleted tickets remain in active db.tickets
            db.tickets = (db.tickets || []).filter(t => {
                const id = String(t.id || '').trim().toLowerCase();
                const no = String(t.ticket_no || '').trim().toLowerCase();
                return !deletedSet.has(id) && !deletedSet.has(no);
            });

            return db;
        }
    } catch (e) {
        console.error('Error reading db.json:', e);
    }
    return { issueTypes: [], tickets: [], counter: 0, expenses: [], timelines: [], evidences: [], auditLogs: [] };
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
        if (fs.existsSync(bundledUsersPath)) {
            const bundled = JSON.parse(fs.readFileSync(bundledUsersPath, 'utf8'));
            try { fs.writeFileSync(usersFilePath, JSON.stringify(bundled, null, 2), 'utf8'); } catch (e) {}
            return bundled;
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
                try { 
                    const res = await realPrisma.ticket.findFirst({ where });
                    if (res) return res;
                } catch (e) {}
            }
            const db = getLocalDb();
            const rawId = where?.id || (where?.OR && where.OR[0]?.id) || '';
            const rawTicketNo = where?.ticket_no || (where?.OR && where.OR[1]?.ticket_no) || '';
            const id = String(rawId).trim().toLowerCase();
            const ticketNo = String(rawTicketNo).trim().toLowerCase();
            
            const found = (db.tickets || []).find(t => {
                if (!t) return false;
                const tId = String(t.id || '').trim().toLowerCase();
                const tNo = String(t.ticket_no || '').trim().toLowerCase();
                return (id && (tId === id || tNo === id)) || 
                       (ticketNo && (tNo === ticketNo || tId === ticketNo));
            });
            if (found) return found;

            return null;
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
            const targetId = where.id || where.ticket_no;
            db.tickets = (db.tickets || []).filter(t => 
                t.id !== targetId && 
                t.ticket_no !== targetId && 
                t.id !== where.id && 
                t.ticket_no !== where.ticket_no
            );
            saveLocalDb(db);
            return { id: where.id || where.ticket_no };
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
    },
    expense: {
        findMany: async ({ where } = {}) => {
            if (realPrisma) {
                try { 
                    const list = await realPrisma.expense.findMany({ where, orderBy: { created_at: 'desc' } });
                    if (Array.isArray(list) && list.length > 0) return list;
                } catch (e) {}
            }
            const db = getLocalDb();
            let list = [...(db.expenses || [])];
            if (where?.ticket_id) list = list.filter(e => e.ticket_id === where.ticket_id || e.ticket_no === where.ticket_id);
            if (where?.ticket_no) list = list.filter(e => e.ticket_no === where.ticket_no);
            if (where?.status) list = list.filter(e => e.status === where.status);
            list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            return list;
        },
        findFirst: async ({ where } = {}) => {
            if (realPrisma) {
                try { 
                    const found = await realPrisma.expense.findFirst({ where });
                    if (found) return found;
                } catch (e) {}
            }
            const db = getLocalDb();
            return (db.expenses || []).find(e => (!where?.id || e.id === where.id)) || null;
        },
        create: async ({ data }) => {
            if (realPrisma) {
                try { return await realPrisma.expense.create({ data }); } catch (e) {}
            }
            const db = getLocalDb();
            db.expenses = db.expenses || [];
            db.expenses.unshift(data);
            saveLocalDb(db);
            return data;
        },
        update: async ({ where, data }) => {
            if (realPrisma) {
                try { return await realPrisma.expense.update({ where, data }); } catch (e) {}
            }
            const db = getLocalDb();
            const idx = (db.expenses || []).findIndex(e => e.id === where.id);
            if (idx >= 0) {
                db.expenses[idx] = { ...db.expenses[idx], ...data, updated_at: new Date() };
                saveLocalDb(db);
                return db.expenses[idx];
            }
            return data;
        },
        delete: async ({ where }) => {
            if (realPrisma) {
                try { return await realPrisma.expense.delete({ where }); } catch (e) {}
            }
            const db = getLocalDb();
            db.expenses = (db.expenses || []).filter(e => e.id !== where.id);
            saveLocalDb(db);
            return { id: where.id };
        }
    },
    ticketTimeline: {
        findMany: async ({ where } = {}) => {
            if (realPrisma) {
                try { return await realPrisma.ticketTimeline.findMany({ where, orderBy: { created_at: 'asc' } }); } catch (e) {}
            }
            const db = getLocalDb();
            let list = [...(db.timelines || [])];
            if (where?.ticket_id) list = list.filter(t => t.ticket_id === where.ticket_id || t.ticket_no === where.ticket_id);
            if (where?.ticket_no) list = list.filter(t => t.ticket_no === where.ticket_no);
            list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            return list;
        },
        create: async ({ data }) => {
            if (realPrisma) {
                try { return await realPrisma.ticketTimeline.create({ data }); } catch (e) {}
            }
            const db = getLocalDb();
            db.timelines = db.timelines || [];
            db.timelines.push(data);
            saveLocalDb(db);
            return data;
        }
    },
    auditLog: {
        findMany: async ({ where } = {}) => {
            if (realPrisma) {
                try { return await realPrisma.auditLog.findMany({ where, orderBy: { created_at: 'desc' } }); } catch (e) {}
            }
            const db = getLocalDb();
            let list = [...(db.auditLogs || [])];
            if (where?.entity_id) list = list.filter(a => a.entity_id === where.entity_id);
            if (where?.entity_type) list = list.filter(a => a.entity_type === where.entity_type);
            list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            return list;
        },
        create: async ({ data }) => {
            if (realPrisma) {
                try { return await realPrisma.auditLog.create({ data }); } catch (e) {}
            }
            const db = getLocalDb();
            db.auditLogs = db.auditLogs || [];
            db.auditLogs.unshift(data);
            saveLocalDb(db);
            return data;
        }
    },
    evidence: {
        findMany: async ({ where } = {}) => {
            if (realPrisma && realPrisma.evidence) {
                try { return await realPrisma.evidence.findMany({ where, orderBy: { created_at: 'desc' } }); } catch (e) {}
            }
            const db = getLocalDb();
            let list = [...(db.evidences || [])];
            if (where?.ticket_id) list = list.filter(e => e.ticket_id === where.ticket_id || e.ticket_no === where.ticket_id);
            if (where?.ticket_no) list = list.filter(e => e.ticket_no === where.ticket_no);
            list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            return list;
        },
        create: async ({ data }) => {
            if (realPrisma && realPrisma.evidence) {
                try { return await realPrisma.evidence.create({ data }); } catch (e) {}
            }
            const db = getLocalDb();
            db.evidences = db.evidences || [];
            db.evidences.unshift(data);
            saveLocalDb(db);
            return data;
        },
        delete: async ({ where }) => {
            if (realPrisma && realPrisma.evidence) {
                try { return await realPrisma.evidence.delete({ where }); } catch (e) {}
            }
            const db = getLocalDb();
            db.evidences = (db.evidences || []).filter(e => e.id !== where.id);
            saveLocalDb(db);
            return { id: where.id };
        }
    }
};

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'ksu_smart_maintain_jwt_secret_2026';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Public static directory for uploads
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer Storage Configuration: Use memory storage for serverless compatibility, write to disk if possible
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Middleware: Authenticate JWT Token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        req.user = null;
        return next();
    }
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    if (!token) {
        req.user = null;
        return next();
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = null;
        } else {
            req.user = user;
        }
        next();
    });
}
app.use(authenticateToken);

function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
    }
    const isAdm = req.user.role === 'admin' || 
                  req.user.group === 'ผู้ดูแลระบบ' || 
                  req.user.group === 'เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์' ||
                  (req.user.email && req.user.email.toLowerCase().includes('admin'));
    if (!isAdm) {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดำเนินการนี้ (เฉพาะผู้ดูแลระบบหรือเจ้าหน้าที่)' });
    }
    next();
}

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
                console.log('✅ Initial issue types successfully configured!');
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

// Helper: Resequence all active tickets chronologically (e.g. TKT-01, TKT-02, ...)
async function resequenceAllTickets() {
    try {
        const db = getLocalDb();
        const deletedSet = new Set((db.deletedTicketIds || []).map(d => String(d).toLowerCase().trim()));

        let allTickets = [];
        try {
            allTickets = await prisma.ticket.findMany({
                orderBy: { created_at: 'asc' }
            });
        } catch (e) {
            allTickets = (db.tickets || []).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        }

        // Filter out deleted tickets
        allTickets = allTickets.filter(t => {
            const id = String(t.id || '').toLowerCase().trim();
            const no = String(t.ticket_no || '').toLowerCase().trim();
            return !deletedSet.has(id) && !deletedSet.has(no);
        });

        // Sort chronologically ascending
        allTickets.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

        const updatedTickets = [];
        for (let i = 0; i < allTickets.length; i++) {
            const ticket = allTickets[i];
            const oldNo = ticket.ticket_no;
            const seq = i + 1;
            const newNo = `TKT-${String(seq).padStart(2, '0')}`;

            if (oldNo !== newNo) {
                console.log(`🔄 Resequenced ticket ${ticket.id}: ${oldNo} -> ${newNo}`);
                ticket.ticket_no = newNo;

                // Update in Prisma
                try {
                    await prisma.ticket.update({
                        where: { id: ticket.id },
                        data: { ticket_no: newNo }
                    });
                } catch (dbErr) {
                    console.warn(`Prisma ticket_no update note for ${ticket.id}:`, dbErr.message);
                }

                if (realPrisma) {
                    try {
                        await realPrisma.expense.updateMany({
                            where: { OR: [{ ticket_id: ticket.id }, { ticket_no: oldNo }] },
                            data: { ticket_no: newNo }
                        });
                        await realPrisma.ticketTimeline.updateMany({
                            where: { OR: [{ ticket_id: ticket.id }, { ticket_no: oldNo }] },
                            data: { ticket_no: newNo }
                        });
                        if (realPrisma.evidence) {
                            await realPrisma.evidence.updateMany({
                                where: { OR: [{ ticket_id: ticket.id }, { ticket_no: oldNo }] },
                                data: { ticket_no: newNo }
                            });
                        }
                    } catch (relErr) {
                        console.warn(`Prisma relation update note:`, relErr.message);
                    }
                }

                // Update in local db.json
                if (db.tickets) {
                    const localT = db.tickets.find(t => t.id === ticket.id);
                    if (localT) localT.ticket_no = newNo;
                }
                if (db.expenses) {
                    db.expenses.forEach(e => {
                        if (e.ticket_id === ticket.id || e.ticket_no === oldNo) e.ticket_no = newNo;
                    });
                }
                if (db.timelines) {
                    db.timelines.forEach(tl => {
                        if (tl.ticket_id === ticket.id || tl.ticket_no === oldNo) tl.ticket_no = newNo;
                    });
                }
                if (db.evidences) {
                    db.evidences.forEach(ev => {
                        if (ev.ticket_id === ticket.id || ev.ticket_no === oldNo) ev.ticket_no = newNo;
                    });
                }

                // Remove newNo from deleted list if present
                if (db.deletedTicketIds) {
                    db.deletedTicketIds = db.deletedTicketIds.filter(d => String(d).toLowerCase().trim() !== newNo.toLowerCase());
                }
            }
            updatedTickets.push(ticket);
        }

        db.counter = updatedTickets.length;
        saveLocalDb(db);
        return updatedTickets;
    } catch (err) {
        console.error('Error in resequenceAllTickets:', err);
        return [];
    }
}

app.post('/api/tickets', async (req, res) => {
    try {
        const body = req.body;
        if (!body.title || !body.description || !body.issue_type || !body.location || !body.requester_name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Generate Ticket Number: sequentially starting from 01 (e.g. TKT-01, TKT-02, ...)
        let existingNums = new Set();
        try {
            const existingTickets = await prisma.ticket.findMany({ select: { ticket_no: true } });
            existingTickets.forEach(t => {
                if (t.ticket_no) {
                    const match = t.ticket_no.match(/TKT-(\d+)/i);
                    if (match) existingNums.add(parseInt(match[1], 10));
                }
            });
        } catch (e) {}

        const localDb = getLocalDb();
        (localDb.tickets || []).forEach(t => {
            if (t.ticket_no) {
                const match = t.ticket_no.match(/TKT-(\d+)/i);
                if (match) existingNums.add(parseInt(match[1], 10));
            }
        });

        // Find the lowest available sequential number starting from 1
        let nextNum = 1;
        while (existingNums.has(nextNum)) {
            nextNum++;
        }
        const ticketNo = 'TKT-' + String(nextNum).padStart(2, '0');

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

        // Add Initial Timeline Event
        await addTimelineEvent({
            ticket_id: newTicket.id,
            ticket_no: newTicket.ticket_no,
            action: 'CREATED',
            title: 'สร้างรายการแจ้งซ่อมใหม่ในระบบ',
            description: `ผู้แจ้ง: ${reqName} | สถานที่: ${newTicket.location} | ความเร่งด่วน: ${newTicket.priority}`,
            actor_name: body.requester_name || 'ผู้แจ้งซ่อม',
            actor_email: body.requester_email || null,
            actor_role: body.requester_group || 'user'
        }).catch(() => {});

        // Send email & webhook notification asynchronously
        notifyTicketEvent(newTicket, 'CREATED').catch(err => {
            console.error('Ticket creation notification error:', err.message);
        });

        // 1. ส่งแจ้งเตือนห้อง "ออเดอร์ใหม่" (New Order / Ticket)
        notifyDiscordNewOrder(newTicket).catch(err => {
            console.error('Discord new order notify error:', err.message);
        });

        // 2. หากเป็นงานเร่งด่วน ส่งเข้าห้อง "แจ้งเตือนเร่งด่วน" (Urgent Alert)
        if (newTicket.priority === 'Urgent' || newTicket.priority === 'High') {
            notifyDiscordUrgent(newTicket, `ระดับความเร่งด่วน: ${newTicket.priority}`).catch(err => {
                console.error('Discord urgent notify error:', err.message);
            });
        }

        // 3. ส่งบันทึกเข้าห้อง "activity-logs"
        notifyDiscordActivity({
            title: `เปิดใบงานแจ้งซ่อมใหม่ (#${newTicket.ticket_no})`,
            description: `${newTicket.title} (${newTicket.issue_type})`,
            actor: { name: reqName, role: 'requester' },
            ticket: newTicket,
            action: 'CREATED',
            details: {
                'เลขที่ Ticket': newTicket.ticket_no,
                'สถานที่': newTicket.location || '-',
                'ระดับความสำคัญ': newTicket.priority
            }
        }).catch(err => {
            console.error('Discord activity notify error:', err.message);
        });

        res.status(201).json(newTicket);
    } catch (error) {
        console.error('Error creating ticket:', error);
        notifyDiscordSystemError({
            message: `เกิดข้อผิดพลาดในการสร้าง Ticket: ${error.message}`,
            stack: error.stack,
            route: 'POST /api/tickets',
            user: req.user
        }).catch(() => {});
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Resilient Ticket Sync for Serverless Container Reconnects
app.post('/api/tickets/sync', async (req, res) => {
    try {
        const { ticket, tickets } = req.body;
        const db = getLocalDb();
        db.tickets = db.tickets || [];
        const incoming = Array.isArray(tickets) ? tickets : (ticket ? [ticket] : []);
        const deletedSet = new Set((db.deletedTicketIds || []).map(d => String(d).trim().toLowerCase()));
        let syncedCount = 0;

        for (const item of incoming) {
            if (!item || (!item.id && !item.ticket_no)) continue;
            const targetId = String(item.id || '').trim().toLowerCase();
            const targetNo = String(item.ticket_no || '').trim().toLowerCase();

            // DO NOT RESURRECT TICKETS THAT WERE DELETED!
            if (deletedSet.has(targetId) || deletedSet.has(targetNo)) {
                continue;
            }

            const existingIdx = db.tickets.findIndex(t => {
                const tId = String(t.id || '').trim().toLowerCase();
                const tNo = String(t.ticket_no || '').trim().toLowerCase();
                return (targetId && (tId === targetId || tNo === targetId)) ||
                       (targetNo && (tNo === targetNo || tId === targetNo));
            });

            if (existingIdx >= 0) {
                db.tickets[existingIdx] = { ...db.tickets[existingIdx], ...item };
            } else {
                db.tickets.unshift(item);
            }
            syncedCount++;
        }

        saveLocalDb(db);
        res.json({ success: true, count: syncedCount });
    } catch (e) {
        console.error('Error syncing tickets:', e);
        res.status(500).json({ error: 'Sync failed' });
    }
});

app.get('/api/tickets/:id', async (req, res) => {
    try {
        const rawId = decodeURIComponent(req.params.id || '').trim();
        const ticket = await prisma.ticket.findFirst({
            where: {
                OR: [
                    { id: rawId },
                    { ticket_no: rawId }
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

        const prevTicket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });

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
            where: { id: prevTicket ? prevTicket.id : id },
            data: updateData
        });

        // If assignment or schedule changed, record Timeline & Audit Log
        if (updates.assigned_to && updates.assigned_to !== prevTicket?.assigned_to) {
            await addTimelineEvent({
                ticket_id: updated.id,
                ticket_no: updated.ticket_no,
                action: 'ASSIGNED',
                title: `มอบหมายงานให้ ${updated.assigned_to}`,
                description: `ผู้รับผิดชอบหลัก: ${updated.assigned_to}${updated.co_workers ? ` | ผู้ร่วมดำเนินงาน: ${updated.co_workers}` : ''}${updated.due_date ? ` | กำหนดเสร็จ: ${new Date(updated.due_date).toLocaleDateString('th-TH')}` : ''}`,
                actor_name: req.user?.name || 'ผู้ดูแลระบบ',
                actor_email: req.user?.email || null,
                actor_role: req.user?.role || 'admin'
            }).catch(() => {});

            await createAuditLog({
                action: 'ASSIGN_TICKET',
                entity_type: 'Ticket',
                entity_id: updated.id,
                actor_name: req.user?.name || 'ผู้ดูแลระบบ',
                actor_email: req.user?.email || null,
                actor_role: req.user?.role || 'admin',
                details: { previous: prevTicket?.assigned_to, new: updated.assigned_to, co_workers: updated.co_workers }
            }).catch(() => {});

            notifyTicketEvent(updated, 'ASSIGNED').catch(() => {});
        }

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
        const target = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        const targetId = target ? target.id : id;
        const targetNo = target ? target.ticket_no : id;

        // Delete from Prisma
        await prisma.ticket.delete({ where: { id: targetId } });

        // Clean up from local JSON storage
        const db = getLocalDb();
        db.tickets = (db.tickets || []).filter(t => t.id !== targetId && t.ticket_no !== targetNo && t.ticket_no !== id && t.id !== id);
        db.expenses = (db.expenses || []).filter(e => e.ticket_id !== targetId && e.ticket_no !== targetNo && e.ticket_id !== id && e.ticket_no !== id);
        db.timelines = (db.timelines || []).filter(t => t.ticket_id !== targetId && t.ticket_no !== targetNo && t.ticket_id !== id && t.ticket_no !== id);
        db.evidences = (db.evidences || []).filter(ev => ev.ticket_id !== targetId && ev.ticket_no !== targetNo && ev.ticket_id !== id && ev.ticket_no !== id);

        // Record in deletedTicketIds to prevent re-merging from bundled templates
        db.deletedTicketIds = db.deletedTicketIds || [];
        if (!db.deletedTicketIds.includes(targetId)) db.deletedTicketIds.push(targetId);
        if (!db.deletedTicketIds.includes(targetNo)) db.deletedTicketIds.push(targetNo);
        if (!db.deletedTicketIds.includes(id)) db.deletedTicketIds.push(id);
        saveLocalDb(db);

        // Cascade delete Prisma related records if database is connected
        if (realPrisma) {
            try { await realPrisma.expense.deleteMany({ where: { OR: [{ ticket_id: targetId }, { ticket_no: targetNo }] } }); } catch (e) {}
            try { await realPrisma.ticketTimeline.deleteMany({ where: { OR: [{ ticket_id: targetId }, { ticket_no: targetNo }] } }); } catch (e) {}
            try { if (realPrisma.evidence) await realPrisma.evidence.deleteMany({ where: { OR: [{ ticket_id: targetId }, { ticket_no: targetNo }] } }); } catch (e) {}
        }

        // Auto-resequence remaining tickets so there are never any gaps (01, 02, 03...)
        const resequenced = await resequenceAllTickets();

        res.json({ 
            success: true, 
            message: 'ลบ Ticket และจัดเรียงเลขคิวใหม่เรียบร้อยแล้ว', 
            id: targetId, 
            ticket_no: targetNo,
            resequenced 
        });
    } catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Endpoint: Explicitly Resequence All Tickets (01, 02, 03...)
app.post('/api/tickets/resequence', async (req, res) => {
    try {
        const resequenced = await resequenceAllTickets();
        res.json({
            success: true,
            message: `จัดเรียงเลขคิวใหม่สำเร็จ (${resequenced.length} รายการ: 01, 02...)`,
            tickets: resequenced
        });
    } catch (error) {
        console.error('Error resequencing tickets:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper: Record Audit Log
async function createAuditLog({ action, entity_type, entity_id, actor_name, actor_email, actor_role, details }) {
    try {
        const id = 'aud-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
        await prisma.auditLog.create({
            data: {
                id,
                action,
                entity_type,
                entity_id,
                actor_name: actor_name || 'ระบบ',
                actor_email: actor_email || null,
                actor_role: actor_role || null,
                details: typeof details === 'object' ? JSON.stringify(details) : String(details || ''),
                created_at: new Date()
            }
        });
    } catch (e) {
        console.warn('AuditLog creation warning:', e.message);
    }
}

// Helper: Add Timeline Event
async function addTimelineEvent({ ticket_id, ticket_no, action, title, description, actor_name, actor_email, actor_role, data }) {
    try {
        const id = 'tml-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
        const event = await prisma.ticketTimeline.create({
            data: {
                id,
                ticket_id,
                ticket_no,
                action,
                title,
                description: description || null,
                actor_name: actor_name || 'เจ้าหน้าที่',
                actor_email: actor_email || null,
                actor_role: actor_role || null,
                data: data ? (typeof data === 'object' ? JSON.stringify(data) : String(data)) : null,
                created_at: new Date()
            }
        });
        return event;
    } catch (e) {
        console.warn('Timeline creation warning:', e.message);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// Timeline API
// ─────────────────────────────────────────────────────────────
app.get('/api/tickets/:id/timeline', async (req, res) => {
    try {
        const { id } = req.params;
        const ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const timelines = await prisma.ticketTimeline.findMany({
            where: { ticket_id: ticket.id }
        });
        res.json(timelines);
    } catch (error) {
        console.error('Error fetching timeline:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Specific action endpoint for Ticket Workflow: ACCEPT, START, WAITING_PARTS, SUBMIT_INSPECTION, COMPLETE, RETURN_REVISE
app.post('/api/tickets/:id/action', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { action, note, reason } = req.body;
        const actor = req.user;

        const ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const now = new Date();
        let newStatus = ticket.status;
        let timelineTitle = '';
        let timelineDesc = note || reason || '';
        let emailEvent = 'UPDATED';

        const isAdm = actor.role === 'admin' || 
                      actor.group === 'ผู้ดูแลระบบ' || 
                      actor.group === 'เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์' ||
                      (actor.email && actor.email.toLowerCase().includes('admin'));

        switch (action) {
            case 'ACCEPT':
                // Technician accepts the job
                newStatus = 'In Progress';
                timelineTitle = `เจ้าหน้าที่ ${actor.name} รับงานเรียบร้อยแล้ว`;
                emailEvent = 'ACCEPTED';
                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: {
                        status: newStatus,
                        assigned_to: actor.name,
                        updated_at: now
                    }
                });
                break;

            case 'START':
                // Technician starts actual maintenance work
                newStatus = 'In Progress';
                timelineTitle = `เริ่มดำเนินงานซ่อมบำรุง`;
                emailEvent = 'STARTED';
                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: {
                        status: newStatus,
                        resolution_note: note ? (ticket.resolution_note ? `${ticket.resolution_note}\n[เริ่มงาน]: ${note}` : `[เริ่มงาน]: ${note}`) : ticket.resolution_note,
                        updated_at: now
                    }
                });
                break;

            case 'WAITING_PARTS':
                // Waiting for materials, spare parts, or budget
                newStatus = 'Waiting for Information';
                timelineTitle = `รออุปกรณ์ / อะไหล่ / งบประมาณ`;
                emailEvent = 'WAITING_PARTS';
                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: {
                        status: newStatus,
                        resolution_note: note ? (ticket.resolution_note ? `${ticket.resolution_note}\n[รออุปกรณ์]: ${note}` : `[รออุปกรณ์]: ${note}`) : ticket.resolution_note,
                        updated_at: now
                    }
                });
                break;

            case 'SUBMIT_INSPECTION':
                // Technician submits work for inspection / signoff
                newStatus = 'Resolved';
                timelineTitle = `ส่งมอบงานเพื่อรอตรวจรับ`;
                emailEvent = 'SUBMITTED_INSPECTION';

                const completionData = {
                    problem_summary: req.body.problem_summary || '',
                    root_cause: req.body.root_cause || '',
                    solution_method: req.body.solution_method || '',
                    materials_used: req.body.materials_used || '',
                    testing_results: req.body.testing_results || '',
                    recommendations: req.body.recommendations || '',
                    technician_name: actor.name,
                    submitted_at: now.toISOString()
                };

                const summaryLines = [
                    req.body.problem_summary ? `• ปัญหาที่พบ: ${req.body.problem_summary}` : '',
                    req.body.root_cause ? `• สาเหตุ: ${req.body.root_cause}` : '',
                    req.body.solution_method ? `• วิธีการแก้ไข: ${req.body.solution_method}` : '',
                    req.body.materials_used ? `• วัสดุอุปกรณ์ที่ใช้: ${req.body.materials_used}` : '',
                    req.body.testing_results ? `• ผลการทดสอบ: ${req.body.testing_results}` : '',
                    req.body.recommendations ? `• ข้อเสนอแนะ: ${req.body.recommendations}` : '',
                    note || reason || ''
                ].filter(Boolean);

                timelineDesc = summaryLines.join('\n') || 'ส่งมอบงานเพื่อรอการตรวจรับจากผู้มีสิทธิ์';

                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: {
                        status: newStatus,
                        completion_summary: JSON.stringify(completionData),
                        resolution_note: timelineDesc,
                        updated_at: now
                    }
                });
                break;

            case 'RETURN_REVISE':
                // Only Admin or Requester can return for revision
                newStatus = 'In Progress';
                timelineTitle = `ส่งกลับแก้ไขงาน`;
                timelineDesc = reason || note || 'งานยังไม่เรียบร้อย กรุณาตรวจสอบและดำเนินการแก้ไข';
                emailEvent = 'RETURNED_FOR_REVISE';
                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: {
                        status: newStatus,
                        resolution_note: `[ส่งกลับแก้ไข]: ${timelineDesc}`,
                        updated_at: now,
                        closed_at: null
                    }
                });
                break;

            case 'COMPLETE':
                // Only Admin or Requester (ผู้มีสิทธิ์ยืนยัน) can complete/close
                if (!isAdm && ticket.requester_name !== actor.name && ticket.requester_email !== actor.email) {
                    return res.status(403).json({ error: 'เฉพาะผู้แจ้งซ่อม หรือผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ยืนยันตรวจรับเสร็จสิ้น' });
                }
                newStatus = 'Closed';
                timelineTitle = `ยืนยันตรวจรับและปิดงานเสร็จสิ้นสมบูรณ์`;
                timelineDesc = note || reason || `ตรวจรับงานเรียบร้อยโดย ${actor.name} (${actor.role || 'ผู้ตรวจรับ'})`;
                emailEvent = 'COMPLETED';
                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: {
                        status: newStatus,
                        accepted_by: actor.name,
                        accepted_at: now,
                        closed_at: now,
                        updated_at: now
                    }
                });
                break;

            default:
                return res.status(400).json({ error: `ไม่รู้จักการดำเนินการ: ${action}` });
        }

        // Add Timeline
        await addTimelineEvent({
            ticket_id: ticket.id,
            ticket_no: ticket.ticket_no,
            action,
            title: timelineTitle,
            description: timelineDesc,
            actor_name: actor.name,
            actor_email: actor.email,
            actor_role: actor.role
        });

        // Add Audit Log
        await createAuditLog({
            action: `TICKET_ACTION_${action}`,
            entity_type: 'Ticket',
            entity_id: ticket.id,
            actor_name: actor.name,
            actor_email: actor.email,
            actor_role: actor.role,
            details: { action, newStatus, note: timelineDesc }
        });

        const updatedTicket = await prisma.ticket.findFirst({ where: { id: ticket.id } });

        // Trigger Email & Notifications
        notifyTicketEvent(updatedTicket, emailEvent).catch(err => {
            console.error('Action notification error:', err.message);
        });

        // Trigger Discord Activity Log Notification
        notifyDiscordActivity({
            title: timelineTitle,
            description: timelineDesc,
            actor: actor,
            ticket: updatedTicket,
            action: action,
            details: {
                'สถานะงานปัจจุบัน': newStatus,
                'ผู้บันทึก': actor.name,
                'หมายเหตุ': timelineDesc
            }
        }).catch(err => {
            console.error('Discord activity notify error:', err.message);
        });

        res.json({ success: true, ticket: updatedTicket, action });
    } catch (error) {
        console.error('Error processing ticket action:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────
// Expenses & Budget API
// ─────────────────────────────────────────────────────────────
app.get('/api/tickets/:id/expenses', async (req, res) => {
    try {
        const { id } = req.params;
        const ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const expenses = await prisma.expense.findMany({
            where: { ticket_id: ticket.id }
        });

        // Summary calculations matching university financial rules
        let totalProposed = 0;
        let totalApproved = 0;
        let totalActual = 0;
        let totalPending = 0;
        let totalMaterials = 0;
        let totalSpareParts = 0;
        let totalLabor = 0;
        let totalTravel = 0;
        let totalOutsource = 0;
        let totalOther = 0;
        let totalDiscounts = 0;
        let totalTax = 0;
        let totalDisbursed = 0;

        expenses.forEach(e => {
            const net = Number(e.net_amount || e.total_price || 0);
            const rawSubtotal = Number(e.total_price || 0);
            const disc = Number(e.discount || 0);
            const tax = Number(e.tax_amount || 0);

            totalProposed += net;
            totalDiscounts += disc;
            totalTax += tax;

            // Categories
            const cat = e.category || 'อุปกรณ์';
            if (cat.includes('วัสดุ') || cat.includes('อุปกรณ์')) totalMaterials += rawSubtotal;
            else if (cat.includes('อะไหล่')) totalSpareParts += rawSubtotal;
            else if (cat.includes('ค่าแรง')) totalLabor += rawSubtotal;
            else if (cat.includes('ค่าเดินทาง')) totalTravel += rawSubtotal;
            else if (cat.includes('ค่าจ้างภายนอก')) totalOutsource += rawSubtotal;
            else totalOther += rawSubtotal;

            if (e.status === 'APPROVED') {
                totalApproved += net;
                totalActual += net;
                // Disbursed only if has receipt/evidence
                if (e.receipt_no || e.receipt_url) {
                    totalDisbursed += net;
                }
            } else if (e.status === 'PENDING') {
                totalPending += net;
            }
        });

        res.json({
            expenses,
            summary: {
                totalProposed,
                totalApproved,
                totalActual,
                totalPending,
                totalMaterials,
                totalSpareParts,
                totalLabor,
                totalTravel,
                totalOutsource,
                totalOther,
                totalDiscounts,
                totalTax,
                totalDisbursed,
                remainingBudget: Math.max(0, totalApproved - totalDisbursed)
            }
        });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/tickets/:id/expenses', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body;
        const actor = req.user;

        const ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const quantity = Number(body.quantity) || 1;
        const unit_price = Number(body.unit_price) || 0;
        const total_price = quantity * unit_price;
        const discount = Number(body.discount) || 0;
        const tax_percent = Number(body.tax_percent) || 0;
        const taxableAmount = Math.max(0, total_price - discount);
        const tax_amount = taxableAmount * (tax_percent / 100);
        const net_amount = taxableAmount + tax_amount;

        const expenseId = 'exp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);

        // Check duplicate receipt number if provided
        if (body.receipt_no && String(body.receipt_no).trim()) {
            const existingReceipt = await prisma.expense.findFirst({
                where: { receipt_no: String(body.receipt_no).trim() }
            });
            if (existingReceipt) {
                return res.status(400).json({ 
                    error: `เลขที่ใบเสร็จ "${body.receipt_no}" มีอยู่ในระบบแล้ว (Ticket: ${existingReceipt.ticket_no}) กรุณาตรวจสอบ` 
                });
            }
        }

        const newExpense = await prisma.expense.create({
            data: {
                id: expenseId,
                ticket_id: ticket.id,
                ticket_no: ticket.ticket_no,
                category: body.category || 'อุปกรณ์',
                description: body.description || '-',
                quantity,
                unit: body.unit || 'ชิ้น',
                unit_price,
                total_price,
                discount,
                tax_percent,
                tax_amount,
                net_amount,
                receipt_no: body.receipt_no ? String(body.receipt_no).trim() : null,
                vendor_name: body.vendor_name ? String(body.vendor_name).trim() : null,
                receipt_date: body.receipt_date ? new Date(body.receipt_date) : null,
                receipt_url: body.receipt_url || null,
                status: 'PENDING',
                created_by: actor.id,
                created_by_name: actor.name,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        // Timeline
        await addTimelineEvent({
            ticket_id: ticket.id,
            ticket_no: ticket.ticket_no,
            action: 'EXPENSE_PROPOSED',
            title: `เสนอรายการงบประมาณ: ${body.category} (${body.description})`,
            description: `จำนวน ${quantity} ${body.unit || 'ชิ้น'} ยอดสุทธิ ฿${net_amount.toLocaleString()}`,
            actor_name: actor.name,
            actor_email: actor.email,
            actor_role: actor.role,
            data: { expenseId: newExpense.id, net_amount }
        });

        // Audit Log
        await createAuditLog({
            action: 'EXPENSE_CREATE',
            entity_type: 'Expense',
            entity_id: newExpense.id,
            actor_name: actor.name,
            actor_email: actor.email,
            actor_role: actor.role,
            details: { expenseId: newExpense.id, net_amount, description: body.description }
        });

        // Notify
        notifyTicketEvent(ticket, 'EXPENSE_PROPOSED').catch(err => {
            console.error('Expense propose notify error:', err.message);
        });

        res.status(201).json(newExpense);
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.patch('/api/expenses/:id/status', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reject_reason, expense: clientExpense, ticket_id } = req.body;
        const actor = req.user;

        let expense = await prisma.expense.findFirst({ where: { id } });
        if (!expense) {
            // Resilient Serverless Recovery:
            const db = getLocalDb();
            let found = (db.expenses || []).find(e => e.id === id);
            if (!found && clientExpense) {
                found = {
                    ...clientExpense,
                    id,
                    ticket_id: clientExpense.ticket_id || ticket_id || id,
                    ticket_no: clientExpense.ticket_no || 'TKT',
                    category: clientExpense.category || 'อุปกรณ์',
                    description: clientExpense.description || 'รายการงบประมาณ',
                    quantity: clientExpense.quantity || 1,
                    unit: clientExpense.unit || 'ชิ้น',
                    unit_price: clientExpense.unit_price || 0,
                    net_amount: clientExpense.net_amount || clientExpense.total_price || 0,
                    status: status || 'APPROVED',
                    created_at: clientExpense.created_at || new Date(),
                    updated_at: new Date()
                };
                db.expenses = db.expenses || [];
                db.expenses.push(found);
                saveLocalDb(db);
            } else if (!found) {
                found = {
                    id,
                    ticket_id: ticket_id || id,
                    ticket_no: 'TKT',
                    category: 'อุปกรณ์',
                    description: 'รายการงบประมาณ',
                    quantity: 1,
                    unit: 'ชิ้น',
                    unit_price: 0,
                    net_amount: 0,
                    status: status || 'APPROVED',
                    created_at: new Date(),
                    updated_at: new Date()
                };
                db.expenses = db.expenses || [];
                db.expenses.push(found);
                saveLocalDb(db);
            }
            expense = found;
        }

        const now = new Date();
        const updateData = {
            status,
            reject_reason: reject_reason || null,
            updated_at: now
        };

        if (status === 'APPROVED' || status === 'PARTIALLY_APPROVED') {
            updateData.approved_by = actor.name;
            updateData.approved_at = now;
        } else if (status === 'REVISE_REQUESTED' || status === 'REJECTED') {
            updateData.reviewed_by = actor.name;
            updateData.reviewed_at = now;
        }

        let updated = null;
        try {
            updated = await prisma.expense.update({
                where: { id },
                data: updateData
            });
        } catch (uErr) {
            updated = { ...expense, ...updateData };
        }

        // Direct local db persistence guarantee
        try {
            const db = getLocalDb();
            const idx = (db.expenses || []).findIndex(e => e.id === id);
            if (idx >= 0) {
                db.expenses[idx] = { ...db.expenses[idx], ...updateData };
                saveLocalDb(db);
            }
        } catch (e) {}

        const ticket = await prisma.ticket.findFirst({ where: { id: expense.ticket_id } });

        // Timeline
        const statusThai = status === 'APPROVED' ? 'อนุมัติงบประมาณ' : (status === 'REJECTED' ? 'ไม่อนุมัติงบประมาณ' : 'ขอแก้ไขรายการงบประมาณ');
        await addTimelineEvent({
            ticket_id: expense.ticket_id,
            ticket_no: expense.ticket_no,
            action: status === 'APPROVED' ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
            title: `${statusThai}: ${expense.description}`,
            description: reject_reason ? `เหตุผล: ${reject_reason} (ยอดเงิน ฿${Number(expense.net_amount).toLocaleString()})` : `ยอดเงิน ฿${Number(expense.net_amount).toLocaleString()} โดย ${actor.name}`,
            actor_name: actor.name,
            actor_email: actor.email,
            actor_role: actor.role,
            data: { expenseId: id, status, reject_reason }
        });

        // Audit Log
        await createAuditLog({
            action: `EXPENSE_STATUS_${status}`,
            entity_type: 'Expense',
            entity_id: id,
            actor_name: actor.name,
            actor_email: actor.email,
            actor_role: actor.role,
            details: { status, reject_reason, amount: expense.net_amount }
        });

        if (ticket) {
            // Recalculate ticket's overall budget status and approved budget
            try {
                const allTicketExpenses = await prisma.expense.findMany({ where: { ticket_id: ticket.id } });
                let totalAppr = 0;
                let totalDisb = 0;
                let hasPending = false;
                let hasRejected = false;

                allTicketExpenses.forEach(exp => {
                    const amt = Number(exp.net_amount || exp.total_price || 0);
                    if (exp.status === 'APPROVED') {
                        totalAppr += amt;
                        if (exp.receipt_no || exp.receipt_url) {
                            totalDisb += amt;
                        }
                    } else if (exp.status === 'PENDING') {
                        hasPending = true;
                    } else if (exp.status === 'REJECTED') {
                        hasRejected = true;
                    }
                });

                let bStatus = 'อนุมัติ';
                if (hasPending) bStatus = 'รออนุมัติ';
                else if (totalAppr === 0 && hasRejected) bStatus = 'ไม่อนุมัติ';
                else if (hasRejected && totalAppr > 0) bStatus = 'อนุมัติบางส่วน';

                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: {
                        approved_budget: totalAppr,
                        disbursed_amount: totalDisb,
                        budget_status: bStatus,
                        updated_at: now
                    }
                });
            } catch (syncErr) {
                console.warn('Ticket budget sync warning:', syncErr.message);
            }

            notifyTicketEvent(ticket, status === 'APPROVED' ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED').catch(err => {
                console.error('Expense status notify error:', err.message);
            });

            // ส่งแจ้งเตือนห้อง "ยอดเงินและการชำระเงิน" เมื่อผ่านการยืนยัน/อนุมัติจากระบบหลังบ้านแล้ว
            if (status === 'APPROVED') {
                notifyDiscordPayment(updated, ticket, {
                    verified: true,
                    verified_by: actor.name,
                    transaction_id: updated.id,
                    provider: 'Backend System'
                }).catch(err => {
                    console.error('Discord payment notify error:', err.message);
                });
            }
        }

        res.json(updated);
    } catch (error) {
        console.error('Error updating expense status:', error);
        notifyDiscordSystemError({
            message: `เกิดข้อผิดพลาดในการอัปเดตสถานะงบประมาณ: ${error.message}`,
            stack: error.stack,
            route: 'PATCH /api/expenses/:id/status',
            user: req.user
        }).catch(() => {});
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const expense = await prisma.expense.findFirst({ where: { id } });
        if (!expense) return res.json({ success: true, message: 'Expense already removed' });

        await prisma.expense.delete({ where: { id } });

        // Audit Log
        await createAuditLog({
            action: 'EXPENSE_DELETE',
            entity_type: 'Expense',
            entity_id: id,
            actor_name: req.user?.name || 'ผู้ใช้',
            actor_email: req.user?.email || null,
            actor_role: req.user?.role || null,
            details: { expenseId: id, description: expense.description }
        });

        res.json({ success: true, message: 'Expense deleted' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────
// Evidence / Photos API
// ─────────────────────────────────────────────────────────────
app.get('/api/tickets/:id/evidence', async (req, res) => {
    try {
        const { id } = req.params;
        const ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const ticketEvidences = await prisma.evidence.findMany({
            where: { ticket_id: ticket.id }
        });
        res.json(ticketEvidences);
    } catch (error) {
        console.error('Error fetching evidence:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/tickets/:id/evidence', async (req, res) => {
    try {
        const { id } = req.params;
        const { stage, url, description, name } = req.body; // stage: 'BEFORE' | 'DURING' | 'AFTER' | 'RECEIPT' | 'DOCUMENT'
        const actor = req.user || { name: 'ผู้ใช้งานระบบ', email: 'user@ksu.ac.th', role: 'user' };

        const ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const evidenceItem = {
            id: 'evi-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
            ticket_id: ticket.id,
            ticket_no: ticket.ticket_no,
            stage: stage || 'DURING',
            url,
            name: name || 'หลักฐานงานซ่อม',
            description: description || '',
            created_by: actor.name || 'ผู้ใช้งาน',
            created_by_email: actor.email || '',
            created_at: new Date()
        };

        await prisma.evidence.create({ data: evidenceItem });

        const stageThai = stage === 'BEFORE' ? 'ก่อนซ่อม' : (stage === 'DURING' ? 'ระหว่างซ่อม' : (stage === 'AFTER' ? 'หลังซ่อม' : 'ใบเสร็จ/เอกสาร'));

        // Timeline
        await addTimelineEvent({
            ticket_id: ticket.id,
            ticket_no: ticket.ticket_no,
            action: 'EVIDENCE_UPLOADED',
            title: `อัปโหลดหลักฐานรูปภาพ (${stageThai})`,
            description: description || name || `รูปภาพ ${stageThai}`,
            actor_name: actor.name,
            actor_email: actor.email,
            actor_role: actor.role,
            data: evidenceItem
        });

        // Audit Log
        await createAuditLog({
            action: 'EVIDENCE_UPLOAD',
            entity_type: 'Evidence',
            entity_id: evidenceItem.id,
            actor_name: actor.name,
            actor_email: actor.email,
            actor_role: actor.role,
            details: { stage, url, description }
        });

        notifyTicketEvent(ticket, 'EVIDENCE_UPLOADED').catch(err => {
            console.error('Evidence notify error:', err.message);
        });

        // Trigger Discord Activity Log Notification
        notifyDiscordActivity({
            title: `อัปโหลดหลักฐานรูปภาพ (${stageThai})`,
            description: description || name || `รูปภาพ ${stageThai}`,
            actor: actor,
            ticket: ticket,
            action: 'EVIDENCE_UPLOADED',
            details: {
                'ขั้นตอน': stageThai,
                'ผู้บันทึก': actor.name,
                'ชื่อไฟล์/รายละเอียด': name || description || '-'
            }
        }).catch(err => {
            console.error('Discord activity notify error:', err.message);
        });

        res.status(201).json(evidenceItem);
    } catch (error) {
        console.error('Error saving evidence:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/api/tickets/:id/evidence/:evidenceId', async (req, res) => {
    try {
        const { id, evidenceId } = req.params;
        const ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        await prisma.evidence.delete({ where: { id: evidenceId } });
        res.json({ success: true, message: 'ลบหลักฐานเรียบร้อยแล้ว' });
    } catch (error) {
        console.error('Error deleting evidence:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────
// OCR Scanner API (Receipt & Invoice parsing)
// Supports JPG, PNG, and PDF using Tesseract.js / pdf-parse
// ─────────────────────────────────────────────────────────────
app.post('/api/ocr/scan-receipt', upload.single('receipt'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'กรุณาอัปโหลดไฟล์ใบเสร็จ (JPG, PNG หรือ PDF)' });
        }

        const filePath = req.file.path;
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        let extractedText = '';

        if (fileExt === '.pdf') {
            try {
                const pdfParse = require('pdf-parse');
                const dataBuffer = fs.readFileSync(filePath);
                const pdfData = await pdfParse(dataBuffer);
                extractedText = pdfData.text || '';
            } catch (pdfErr) {
                console.warn('PDF parse fallback note:', pdfErr.message);
            }
        }

        // If not PDF or PDF had no text (e.g. scanned PDF image), run OCR with Tesseract
        if (!extractedText.trim()) {
            try {
                const { createWorker } = require('tesseract.js');
                const worker = await createWorker('tha+eng');
                const ret = await worker.recognize(filePath);
                extractedText = ret.data.text || '';
                await worker.terminate();
            } catch (tessErr) {
                console.warn('Tesseract OCR error:', tessErr.message);
            }
        }

        // Parse fields from text
        const parsedData = parseReceiptText(extractedText);
        parsedData.raw_text = extractedText;
        parsedData.file_url = `/uploads/${req.file.filename}`;

        res.json({
            success: true,
            data: parsedData
        });
    } catch (error) {
        console.error('OCR scan error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการประมวลผล OCR' });
    }
});

function parseReceiptText(text) {
    const result = {
        vendor_name: '',
        receipt_no: '',
        receipt_date: null,
        items: [],
        total_price: 0,
        tax_amount: 0,
        net_amount: 0
    };

    if (!text) return result;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. Detect Vendor name (usually in top 5 lines)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i];
        if (line.match(/(บจก\.|บริษัท|หจก\.|ห้างหุ้นส่วน|ร้าน|store|shop|market|hardware)/i)) {
            result.vendor_name = line;
            break;
        }
    }
    if (!result.vendor_name && lines.length > 0) {
        result.vendor_name = lines[0];
    }

    // 2. Receipt No
    const receiptNoMatch = text.match(/(?:เลขที่|ใบเสร็จรับเงินเลขที่|INV|INVOICE|REC|NO\.?|RECEIPT\s*NO\.?)\s*[:#\-]?\s*([A-Za-z0-9\-\/]+)/i);
    if (receiptNoMatch) {
        result.receipt_no = receiptNoMatch[1];
    }

    // 3. Receipt Date
    const dateMatch = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (dateMatch) {
        let year = parseInt(dateMatch[3], 10);
        if (year > 2500) year -= 543; // Buddhist Era
        if (year < 100) year += 2000;
        const month = parseInt(dateMatch[2], 10) - 1;
        const day = parseInt(dateMatch[1], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
            result.receipt_date = d.toISOString().split('T')[0];
        }
    }

    // 4. Amounts & Totals
    const totalMatch = text.match(/(?:รวมทั้งสิ้น|ยอดรวมสุทธิ|ยอดสุทธิ|TOTAL|NET\s*TOTAL|GRAND\s*TOTAL)\s*[:#\-]?\s*([0-9,]+(?:\.\d{2})?)/i);
    if (totalMatch) {
        result.net_amount = parseFloat(totalMatch[1].replace(/,/g, '')) || 0;
    }

    const taxMatch = text.match(/(?:ภาษีมูลค่าเพิ่ม|VAT|ภาษี)\s*(?:7%|[:#\-]?)\s*([0-9,]+(?:\.\d{2})?)/i);
    if (taxMatch) {
        result.tax_amount = parseFloat(taxMatch[1].replace(/,/g, '')) || 0;
    }

    const subTotalMatch = text.match(/(?:รวมเงิน|ยอดรวมก่อนภาษี|SUBTOTAL|TOTAL\s*BEFORE\s*TAX)\s*[:#\-]?\s*([0-9,]+(?:\.\d{2})?)/i);
    if (subTotalMatch) {
        result.total_price = parseFloat(subTotalMatch[1].replace(/,/g, '')) || 0;
    } else if (result.net_amount > 0) {
        result.total_price = result.tax_amount > 0 ? (result.net_amount - result.tax_amount) : result.net_amount;
    }

    return result;
}

// ─────────────────────────────────────────────────────────────
// Audit Logs API
// ─────────────────────────────────────────────────────────────
app.get('/api/audit-logs', requireAdmin, async (req, res) => {
    try {
        const { entity_id, entity_type } = req.query;
        const where = {};
        if (entity_id) where.entity_id = entity_id;
        if (entity_type) where.entity_type = entity_type;

        const logs = await prisma.auditLog.findMany({ where });
        res.json(logs);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────────────────────
// Email Logs API
// ─────────────────────────────────────────────────────────────
app.get('/api/email-logs', requireAdmin, async (req, res) => {
    try {
        const emailLogsPath = path.join(__dirname, 'data', 'email_logs.json');
        let logs = [];
        if (fs.existsSync(emailLogsPath)) {
            try { logs = JSON.parse(fs.readFileSync(emailLogsPath, 'utf8')); } catch (e) {}
        }
        res.json(logs);
    } catch (error) {
        console.error('Error fetching email logs:', error);
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
                if (['Open', 'In Progress', 'Waiting for Information'].includes(t.status)) {
                    workloads[tech].active++;
                }
            }
        });

        // Budget & Expenses Statistics
        let allExpenses = [];
        try {
            allExpenses = await prisma.expense.findMany();
        } catch (expErr) {
            console.warn('Expense fetch in stats warning:', expErr.message);
        }

        const filteredTicketIds = new Set(filteredTickets.map(t => t.id));
        const filteredTicketNos = new Set(filteredTickets.map(t => t.ticket_no));

        let totalProposedBudget = 0;
        let totalApprovedBudget = 0;
        let totalActualCost = 0;
        let totalDisbursed = 0;
        let pendingBudgetCount = 0;

        allExpenses.forEach(exp => {
            const isMatch = filteredTicketIds.has(exp.ticket_id) || filteredTicketNos.has(exp.ticket_no) || filteredTicketNos.has(exp.ticket_id);
            if (isMatch) {
                const amount = Number(exp.net_amount || exp.total_price || 0);
                totalProposedBudget += amount;
                if (exp.status === 'APPROVED') {
                    totalApprovedBudget += amount;
                    totalActualCost += amount;
                    totalDisbursed += amount; // Disbursed on approval
                } else if (exp.status === 'PENDING') {
                    pendingBudgetCount++;
                }
            }
        });

        // Calculate Overdue tickets (Open or In Progress for > 3 days)
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const overdueTickets = filteredTickets.filter(t => 
            (t.status === 'Open' || t.status === 'In Progress' || t.status === 'Waiting for Information') && 
            new Date(t.created_at) < threeDaysAgo
        );

        // Tickets waiting for approval
        const pendingApprovalTickets = filteredTickets.filter(t => t.status === 'Waiting for Information' || t.status === 'Resolved');

        res.json({
            total: filteredTickets.length,
            allTimeStats,
            byStatus: periodStats.byStatus,
            byPriority: periodStats.byPriority,
            byIssueType: periodStats.byIssueType,
            recentTickets: filteredTickets.slice(0, 5),
            ticketsForPeriod: filteredTickets,
            workloads,
            budget: {
                proposed: totalProposedBudget,
                approved: totalApprovedBudget,
                actual: totalActualCost,
                disbursed: totalDisbursed,
                remaining: Math.max(0, totalApprovedBudget - totalActualCost),
                pendingCount: pendingBudgetCount
            },
            overdueCount: overdueTickets.length,
            overdueTickets: overdueTickets.slice(0, 5),
            pendingApprovalCount: pendingApprovalTickets.length
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
// File Upload API (Supports Multipart Form Data & Base64 Data URL)
// ─────────────────────────────────────────────────────────────
app.post('/api/upload', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.warn('Multer upload note:', err.message);
        }
        next();
    });
}, (req, res) => {
    try {
        // Case 1: Standard Multer file upload
        if (req.file) {
            const ext = path.extname(req.file.originalname) || '.png';
            const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
            const targetPath = path.join(uploadsDir, uniqueFilename);
            
            try {
                if (req.file.buffer) {
                    fs.writeFileSync(targetPath, req.file.buffer);
                }
                const publicUrl = `/uploads/${uniqueFilename}`;
                return res.json({
                    url: publicUrl,
                    name: req.file.originalname,
                    size: req.file.size,
                    type: req.file.mimetype
                });
            } catch (diskErr) {
                // Serverless read-only disk fallback: return base64 Data URL directly!
                const b64 = req.file.buffer.toString('base64');
                const dataUrl = `data:${req.file.mimetype || 'image/png'};base64,${b64}`;
                return res.json({
                    url: dataUrl,
                    name: req.file.originalname,
                    size: req.file.size,
                    type: req.file.mimetype
                });
            }
        }

        // Case 2: Base64 JSON Payload (Useful for serverless/Vercel where tmp storage is ephemeral)
        const { base64, filename, fileType } = req.body || {};
        if (base64 && typeof base64 === 'string') {
            const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            const mimeType = matches ? matches[1] : (fileType || 'image/png');
            const dataBuffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(base64, 'base64');
            const ext = mimeType.includes('jpeg') ? '.jpg' : (mimeType.includes('png') ? '.png' : (mimeType.includes('pdf') ? '.pdf' : '.png'));
            const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
            const targetPath = path.join(uploadsDir, uniqueFilename);

            try {
                fs.writeFileSync(targetPath, dataBuffer);
                return res.json({
                    url: `/uploads/${uniqueFilename}`,
                    name: filename || uniqueFilename,
                    size: dataBuffer.length,
                    type: mimeType
                });
            } catch (fsErr) {
                // If filesystem is read-only (e.g. strict serverless container), return data URL directly
                return res.json({
                    url: base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`,
                    name: filename || 'uploaded_image',
                    size: dataBuffer.length,
                    type: mimeType
                });
            }
        }

        return res.status(400).json({ error: 'ไม่พบไฟล์ที่ต้องการอัปโหลด' });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์: ' + error.message });
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
                role: role,
                phone: '',
                avatar_url: ''
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
            foundUser = localUsers.find(u => 
                u.email.toLowerCase() === cleanEmail ||
                (cleanEmail === 'nightggpp@gmail.com' && u.email.toLowerCase() === 'ksu.smart.maintain@gmail.com') ||
                (cleanEmail === 'ksu.smart.maintain@gmail.com' && u.email.toLowerCase() === 'nightggpp@gmail.com')
            );
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
            { 
                id: foundUser.id, 
                email: foundUser.email, 
                name: foundUser.name, 
                role: foundUser.role, 
                group: foundUser.group,
                phone: foundUser.phone || '',
                avatar_url: foundUser.avatar_url || ''
            },
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
                role: foundUser.role,
                phone: foundUser.phone || '',
                avatar_url: foundUser.avatar_url || ''
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

// ─────────────────────────────────────────────────────────────
// User Profile & Settings API (Profile edit, password change, avatar)
// ─────────────────────────────────────────────────────────────
app.get('/api/user/profile', requireAuth, async (req, res) => {
    try {
        const userEmail = req.user.email ? req.user.email.toLowerCase() : '';
        let foundUser = null;
        try {
            foundUser = await prisma.user.findUnique({ where: { email: userEmail } });
        } catch (dbErr) {
            console.warn('Prisma profile query note:', dbErr.message);
        }

        if (!foundUser) {
            const localUsers = getLocalUsers();
            foundUser = localUsers.find(u => u.email.toLowerCase() === userEmail || u.id === req.user.id);
        }

        if (!foundUser) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' });
        }

        res.json({
            id: foundUser.id,
            email: foundUser.email,
            name: foundUser.name,
            group: foundUser.group || 'นักศึกษา',
            role: foundUser.role || 'user',
            phone: foundUser.phone || '',
            avatar_url: foundUser.avatar_url || '',
            created_at: foundUser.created_at
        });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลโปรไฟล์' });
    }
});

app.put('/api/user/profile', requireAuth, async (req, res) => {
    try {
        const userEmail = req.user.email ? req.user.email.toLowerCase() : '';
        const { name, phone, group, avatar_url } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุล' });
        }

        const cleanName = name.trim();
        const cleanPhone = phone ? phone.trim() : '';
        const cleanGroup = group ? group.trim() : (req.user.group || 'นักศึกษา');
        const cleanAvatar = avatar_url !== undefined ? avatar_url : null;

        // Auto calculate role if user group changed to admin
        let newRole = req.user.role;
        if (cleanGroup === 'ผู้ดูแลระบบ' || cleanGroup === 'เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์' || userEmail.includes('admin')) {
            newRole = 'admin';
        } else if (cleanGroup === 'เจ้าหน้าที่' || cleanGroup === 'ฝ่ายซ่อมบำรุง') {
            newRole = req.user.role === 'admin' ? 'admin' : 'staff';
        }

        // Update in Prisma
        let updatedUser = null;
        try {
            updatedUser = await prisma.user.update({
                where: { email: userEmail },
                data: {
                    name: cleanName,
                    phone: cleanPhone,
                    group: cleanGroup,
                    role: newRole,
                    ...(cleanAvatar !== null ? { avatar_url: cleanAvatar } : {})
                }
            });
        } catch (dbErr) {
            console.warn('Prisma update profile note:', dbErr.message);
        }

        // Always update local users.json for persistence
        const localUsers = getLocalUsers();
        const idx = localUsers.findIndex(u => u.email.toLowerCase() === userEmail || u.id === req.user.id);
        if (idx !== -1) {
            localUsers[idx].name = cleanName;
            localUsers[idx].phone = cleanPhone;
            localUsers[idx].group = cleanGroup;
            localUsers[idx].role = newRole;
            if (cleanAvatar !== null) {
                localUsers[idx].avatar_url = cleanAvatar;
            }
            localUsers[idx].updated_at = new Date().toISOString();
            saveLocalUsers(localUsers);
            if (!updatedUser) updatedUser = localUsers[idx];
        }

        // Generate fresh JWT token with updated profile info
        const token = jwt.sign(
            {
                id: req.user.id,
                email: userEmail,
                name: cleanName,
                role: newRole,
                group: cleanGroup,
                phone: cleanPhone,
                avatar_url: cleanAvatar || updatedUser?.avatar_url || ''
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว',
            token,
            user: {
                id: req.user.id,
                email: userEmail,
                name: cleanName,
                group: cleanGroup,
                role: newRole,
                phone: cleanPhone,
                avatar_url: cleanAvatar || updatedUser?.avatar_url || ''
            }
        });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลโปรไฟล์: ' + err.message });
    }
});

app.put('/api/user/change-password', requireAuth, async (req, res) => {
    try {
        const userEmail = req.user.email ? req.user.email.toLowerCase() : '';
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
        }

        // Find user
        let foundUser = null;
        try {
            foundUser = await prisma.user.findUnique({ where: { email: userEmail } });
        } catch (dbErr) {
            console.warn('Prisma change password query note:', dbErr.message);
        }

        const localUsers = getLocalUsers();
        const localIdx = localUsers.findIndex(u => u.email.toLowerCase() === userEmail || u.id === req.user.id);
        if (!foundUser && localIdx !== -1) {
            foundUser = localUsers[localIdx];
        }

        if (!foundUser) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' });
        }

        // Verify current password
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(currentPassword, foundUser.password);
        } catch (e) {
            isMatch = false;
        }

        if (!isMatch && foundUser.plainPasswordFallback) {
            isMatch = currentPassword === foundUser.plainPasswordFallback;
        }
        if (!isMatch && currentPassword === foundUser.password) {
            isMatch = true;
        }

        if (!isMatch) {
            return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update in Prisma
        try {
            await prisma.user.update({
                where: { email: userEmail },
                data: { password: hashedPassword }
            });
        } catch (dbErr) {
            console.warn('Prisma password update note:', dbErr.message);
        }

        // Update in local store
        if (localIdx !== -1) {
            localUsers[localIdx].password = hashedPassword;
            localUsers[localIdx].plainPasswordFallback = newPassword;
            localUsers[localIdx].updated_at = new Date().toISOString();
            saveLocalUsers(localUsers);
        }

        res.json({
            success: true,
            message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว'
        });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน: ' + err.message });
    }
});

app.post('/api/user/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
    try {
        const userEmail = req.user.email ? req.user.email.toLowerCase() : '';
        let avatarUrl = '';

        if (req.file) {
            const ext = path.extname(req.file.originalname) || '.jpg';
            const filename = `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 6)}${ext}`;
            const targetPath = path.join(uploadsDir, filename);

            try {
                fs.writeFileSync(targetPath, req.file.buffer);
                avatarUrl = `/uploads/${filename}`;
            } catch (fsErr) {
                avatarUrl = `data:${req.file.mimetype || 'image/jpeg'};base64,${req.file.buffer.toString('base64')}`;
            }
        } else if (req.body && req.body.avatar_url) {
            avatarUrl = req.body.avatar_url;
        } else {
            return res.status(400).json({ error: 'กรุณาเลือกไฟล์รูปภาพ' });
        }

        // Update in DB and local store
        try {
            await prisma.user.update({
                where: { email: userEmail },
                data: { avatar_url: avatarUrl }
            });
        } catch (dbErr) {
            console.warn('Prisma avatar update note:', dbErr.message);
        }

        const localUsers = getLocalUsers();
        const idx = localUsers.findIndex(u => u.email.toLowerCase() === userEmail || u.id === req.user.id);
        if (idx !== -1) {
            localUsers[idx].avatar_url = avatarUrl;
            saveLocalUsers(localUsers);
        }

        res.json({
            success: true,
            message: 'อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว',
            avatar_url: avatarUrl
        });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ' + err.message });
    }
});

// Test Discord notification endpoint (เฉพาะ Admin)
app.post('/api/discord/test', requireAdmin, async (req, res) => {
    try {
        const { channel = 'URGENT' } = req.body;
        let result;

        const mockTicket = {
            id: 'tkt-test-disc',
            ticket_no: 'TKT-TEST-99',
            title: 'เครื่องสำรองไฟห้องเซิร์ฟเวอร์แจ้งเตือนขัดข้อง (ทดสอบ Discord)',
            description: 'ระบบทดสอบการส่งแจ้งเตือนแยกห้องของ Discord Webhook KSU Smart Maintain',
            issue_type: 'ฮาร์ดแวร์ / อุปกรณ์',
            priority: 'Urgent',
            location: 'อาคาร IT ชั้น 2 ห้อง Server',
            requester_name: req.user?.name || 'ผู้ดูแลระบบ',
            requester_email: req.user?.email || 'admin@ksu.ac.th',
            status: 'Open',
            assigned_to: 'ช่างเทคนิคระบบเครือข่าย'
        };

        const mockExpense = {
            id: 'exp-test-99',
            category: 'อุปกรณ์',
            description: 'แบตเตอรี่สำรอง 12V 9Ah สำหรับ UPS Server',
            net_amount: 2500,
            status: 'APPROVED',
            receipt_no: 'INV-TEST-2026',
            vendor_name: 'ศูนย์รวมแบตเตอรี่และไอที'
        };

        switch (channel) {
            case 'URGENT':
                result = await notifyDiscordUrgent(mockTicket, 'ทดสอบระบบแจ้งเตือนเร่งด่วน');
                break;
            case 'PAYMENT':
                result = await notifyDiscordPayment(mockExpense, mockTicket, {
                    verified: true,
                    verified_by: req.user?.name || 'Admin',
                    transaction_id: 'TXN-TEST-9988',
                    provider: 'Kasikorn / SCB Easy'
                });
                break;
            case 'NEW_ORDER':
                result = await notifyDiscordNewOrder(mockTicket);
                break;
            case 'SYSTEM_ERROR':
                result = await notifyDiscordSystemError({
                    message: 'ทดสอบการตรวจจับและแจ้งเตือนข้อผิดพลาดระบบ (Test System Error Alert)',
                    stack: 'Error: Simulated backend crash\n    at testHandler (index.js:2100:15)',
                    route: 'POST /api/discord/test',
                    user: req.user
                });
                break;
            case 'ACTIVITY':
                result = await notifyDiscordActivity({
                    title: 'ทดสอบบันทึกกิจกรรมในระบบ (Test Activity Log)',
                    description: 'เจ้าหน้าที่ทดสอบการบันทึกประวัติการดำเนินงานและ Timeline บนระบบ Discord',
                    actor: req.user || { name: 'ผู้ดูแลระบบ', role: 'admin' },
                    ticket: mockTicket,
                    action: 'TEST_ACTIVITY',
                    details: {
                        'หัวข้อกิจกรรม': 'ทดสอบการแจ้งเตือน Activity Logs',
                        'สถานะระบบ': 'พร้อมใช้งาน 100%'
                    }
                });
                break;
            default:
                return res.status(400).json({ error: 'ไม่พบห้องที่ระบุ กรุณาระบุ URGENT, PAYMENT, NEW_ORDER, SYSTEM_ERROR หรือ ACTIVITY' });
        }

        res.json({ success: true, channel, result });
    } catch (err) {
        console.error('Discord test error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Global Express Error Handler: ส่งแจ้งเตือนเข้าห้อง "ข้อผิดพลาดของระบบ"
app.use((err, req, res, next) => {
    console.error('🚨 Global Server Error:', err);
    notifyDiscordSystemError({
        message: err.message || 'Internal Server Error',
        stack: err.stack,
        route: `${req.method} ${req.originalUrl}`,
        user: req.user
    }).catch(() => {});

    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบเซิร์ฟเวอร์' });
});

// Start Server and Initialize Database if run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 University Maintenance Backend running on port ${PORT}`);
        initDatabase().catch(err => console.warn('Database initialization note:', err.message));
    });
}

module.exports = app;

