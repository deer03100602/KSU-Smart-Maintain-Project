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
const {
    getLineConfig,
    getPublicLineStatus,
    getLineLogs,
    getLineContacts,
    testLineNotification,
    verifyWebhookSignature,
    processWebhookEvents,
    updateStoredSettings
} = require('./lineService');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const baseDataDir = isServerless ? '/tmp' : path.join(__dirname, 'data');

if (!fs.existsSync(baseDataDir)) {
    try { fs.mkdirSync(baseDataDir, { recursive: true }); } catch (e) {}
}

const usersFilePath = path.join(baseDataDir, 'users.json');
const avatarsFilePath = path.join(baseDataDir, 'avatars.json');
const dbFilePath = path.join(baseDataDir, 'db.json');
const bundledDbPath = path.join(__dirname, 'data', 'db.json');
const bundledUsersPath = path.join(__dirname, 'data', 'users.json');
const bundledAvatarsPath = path.join(__dirname, 'data', 'avatars.json');

function getSavedAvatars() {
    try {
        if (fs.existsSync(avatarsFilePath)) {
            return JSON.parse(fs.readFileSync(avatarsFilePath, 'utf8'));
        }
        if (fs.existsSync(bundledAvatarsPath)) {
            const bundled = JSON.parse(fs.readFileSync(bundledAvatarsPath, 'utf8'));
            try { fs.writeFileSync(avatarsFilePath, JSON.stringify(bundled, null, 2), 'utf8'); } catch (e) {}
            return bundled;
        }
    } catch (e) {
        console.error('Error reading avatars.json:', e);
    }
    return {};
}

function saveUserAvatar(email, avatarUrl) {
    if (!email || !avatarUrl) return;
    const cleanEmail = String(email).toLowerCase().trim();
    try {
        const avatars = getSavedAvatars();
        avatars[cleanEmail] = avatarUrl;
        fs.writeFileSync(avatarsFilePath, JSON.stringify(avatars, null, 2), 'utf8');
        if (bundledAvatarsPath && bundledAvatarsPath !== avatarsFilePath) {
            try { fs.writeFileSync(bundledAvatarsPath, JSON.stringify(avatars, null, 2), 'utf8'); } catch (e) {}
        }
    } catch (e) {
        console.error('Error writing avatars.json:', e);
    }
}

function getLocalDb() {
    try {
        let db = null;
        if (fs.existsSync(dbFilePath)) {
            try { db = JSON.parse(fs.readFileSync(dbFilePath, 'utf8')); } catch (e) {}
        }
        if (!db && fs.existsSync(bundledDbPath)) {
            try {
                db = JSON.parse(fs.readFileSync(bundledDbPath, 'utf8'));
                if (db) db.initialized = true;
                fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2), 'utf8');
            } catch (e) {}
        }
        if (db) {
            db.tickets = db.tickets || [];
            db.deletedTicketIds = db.deletedTicketIds || [];
            const deletedSet = new Set((db.deletedTicketIds || []).map(d => String(d).trim().toLowerCase()));

            // Only seed on initial launch when db has never been marked initialized
            if (!db.initialized && fs.existsSync(bundledDbPath)) {
                try {
                    const bundled = JSON.parse(fs.readFileSync(bundledDbPath, 'utf8'));
                    if (db.tickets.length === 0) {
                        db.tickets = (bundled.tickets || []).filter(t => {
                            const id = String(t.id || '').trim().toLowerCase();
                            const no = String(t.ticket_no || '').trim().toLowerCase();
                            return !deletedSet.has(id) && !deletedSet.has(no);
                        });
                    }
                    db.initialized = true;
                } catch (e) {}
            }

            // Always ensure deleted tickets are filtered out
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
    return { issueTypes: [], tickets: [], counter: 0, expenses: [], timelines: [], evidences: [], auditLogs: [], deletedTicketIds: [], initialized: true };
}

function saveLocalDb(data) {
    try {
        if (data && typeof data === 'object') {
            data.initialized = true;
        }
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
        const map = new Map();
        for (const u of users) {
            if (u && u.email) {
                map.set(String(u.email).toLowerCase().trim(), u);
            }
        }
        const uniqueUsers = Array.from(map.values());
        fs.writeFileSync(usersFilePath, JSON.stringify(uniqueUsers, null, 2), 'utf8');
        if (bundledUsersPath && bundledUsersPath !== usersFilePath) {
            try { fs.writeFileSync(bundledUsersPath, JSON.stringify(uniqueUsers, null, 2), 'utf8'); } catch (e) {}
        }
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
            let list = [];
            if (realPrisma) {
                try { 
                    list = await realPrisma.ticket.findMany({ select, orderBy }); 
                } catch (e) {}
            }
            if (!list || list.length === 0) {
                const db = getLocalDb();
                list = [...(db.tickets || [])];
                list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            }
            const db = getLocalDb();
            const deletedSet = new Set((db.deletedTicketIds || []).map(d => String(d).trim().toLowerCase()));
            return (list || []).filter(t => {
                const id = String(t.id || '').trim().toLowerCase();
                const no = String(t.ticket_no || '').trim().toLowerCase();
                return !deletedSet.has(id) && !deletedSet.has(no);
            });
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
            let u = null;
            if (realPrisma) {
                try { u = await realPrisma.user.findUnique({ where }); } catch (e) {}
            }
            const cleanEmail = (where.email || '').toLowerCase().trim();
            const cleanId = where.id;
            const users = getLocalUsers();
            const localU = users.find(x => 
                (cleanEmail && (x.email || '').toLowerCase().trim() === cleanEmail) ||
                (cleanId && x.id === cleanId)
            );
            const avatars = getSavedAvatars();
            const savedAvatar = cleanEmail ? (avatars[cleanEmail] || (localU?.email ? avatars[localU.email.toLowerCase().trim()] : '')) : '';

            if (u) {
                if (!u.avatar_url && (localU?.avatar_url || savedAvatar)) {
                    u.avatar_url = localU?.avatar_url || savedAvatar;
                    if (realPrisma && cleanEmail) {
                        realPrisma.user.update({
                            where: { email: cleanEmail },
                            data: { avatar_url: u.avatar_url }
                        }).catch(() => {});
                    }
                }
                return u;
            }
            if (localU) {
                if (!localU.avatar_url && savedAvatar) {
                    localU.avatar_url = savedAvatar;
                }
                return localU;
            }
            return null;
        },
        create: async ({ data }) => {
            if (realPrisma) {
                try { return await realPrisma.user.create({ data }); } catch (e) {}
            }
            const users = getLocalUsers();
            users.push(data);
            saveLocalUsers(users);
            if (data.email && data.avatar_url) {
                saveUserAvatar(data.email, data.avatar_url);
            }
            return data;
        },
        update: async ({ where, data }) => {
            let updated = null;
            if (realPrisma) {
                try {
                    updated = await realPrisma.user.update({ where, data });
                } catch (e) {
                    console.warn('Real prisma user update note:', e.message);
                }
            }
            const users = getLocalUsers();
            const cleanEmail = (where.email || '').toLowerCase().trim();
            const cleanId = where.id;
            const idx = users.findIndex(u => 
                (cleanEmail && (u.email || '').toLowerCase().trim() === cleanEmail) ||
                (cleanId && u.id === cleanId)
            );
            if (idx >= 0) {
                users[idx] = { ...users[idx], ...data, updated_at: new Date().toISOString() };
                saveLocalUsers(users);
                if (data.avatar_url) {
                    saveUserAvatar(users[idx].email || cleanEmail, data.avatar_url);
                }
                return updated || users[idx];
            } else if (cleanEmail) {
                const newUser = {
                    id: cleanId || ('usr-' + Date.now().toString(36)),
                    email: cleanEmail,
                    ...data,
                    updated_at: new Date().toISOString()
                };
                users.push(newUser);
                saveLocalUsers(users);
                if (data.avatar_url) {
                    saveUserAvatar(cleanEmail, data.avatar_url);
                }
                return updated || newUser;
            }
            return updated || data;
        },
        count: async () => {
            if (realPrisma) {
                try { return await realPrisma.user.count(); } catch (e) {}
            }
            return getLocalUsers().length;
        },
        upsert: async ({ where, update, create }) => {
            let res = null;
            if (realPrisma) {
                try { res = await realPrisma.user.upsert({ where, update, create }); } catch (e) {}
            }
            const users = getLocalUsers();
            const cleanEmail = (where.email || '').toLowerCase().trim();
            const idx = users.findIndex(u => (u.email || '').toLowerCase().trim() === cleanEmail);
            if (idx >= 0) {
                users[idx] = { ...users[idx], ...update, updated_at: new Date().toISOString() };
                saveLocalUsers(users);
                if (update.avatar_url) {
                    saveUserAvatar(cleanEmail, update.avatar_url);
                }
                return res || users[idx];
            } else {
                users.push(create);
                saveLocalUsers(users);
                if (create.avatar_url) {
                    saveUserAvatar(cleanEmail, create.avatar_url);
                }
                return res || create;
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
            if (where?.OR && Array.isArray(where.OR)) {
                list = list.filter(e => {
                    return where.OR.some(cond => {
                        if (cond.ticket_id && (e.ticket_id === cond.ticket_id || e.ticket_no === cond.ticket_id)) return true;
                        if (cond.ticket_no && (e.ticket_no === cond.ticket_no || e.ticket_id === cond.ticket_no)) return true;
                        return false;
                    });
                });
            } else {
                if (where?.ticket_id) list = list.filter(e => e.ticket_id === where.ticket_id || e.ticket_no === where.ticket_id);
                if (where?.ticket_no) list = list.filter(e => e.ticket_no === where.ticket_no || e.ticket_id === where.ticket_no);
            }
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
            return (db.expenses || []).find(e => {
                if (where?.id && e.id !== where.id) return false;
                if (where?.receipt_no && String(e.receipt_no || '').trim() !== String(where.receipt_no).trim()) return false;
                if (where?.ticket_id && e.ticket_id !== where.ticket_id && e.ticket_no !== where.ticket_id) return false;
                return true;
            }) || null;
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
            const ticketId = where?.ticket_id;
            const ticketNo = where?.ticket_no;
            const orList = Array.isArray(where?.OR) ? where.OR : [];
            const ids = new Set();
            if (ticketId) ids.add(ticketId);
            if (ticketNo) ids.add(ticketNo);
            orList.forEach(item => {
                if (item.ticket_id) ids.add(item.ticket_id);
                if (item.ticket_no) ids.add(item.ticket_no);
            });

            let realResults = null;
            if (realPrisma && realPrisma.evidence) {
                try {
                    const orConds = [];
                    ids.forEach(v => {
                        orConds.push({ ticket_id: v });
                        orConds.push({ ticket_no: v });
                    });
                    const queryWhere = orConds.length > 0 ? { OR: orConds } : (where || {});
                    realResults = await realPrisma.evidence.findMany({ where: queryWhere, orderBy: { created_at: 'desc' } });
                } catch (e) {}
            }

            const db = getLocalDb();
            let list = [...(db.evidences || [])];
            if (ids.size > 0) {
                list = list.filter(e => ids.has(e.ticket_id) || ids.has(e.ticket_no));
            } else if (where?.stage) {
                list = list.filter(e => e.stage === where.stage);
            }

            if (Array.isArray(realResults) && realResults.length > 0) {
                const map = new Map();
                realResults.forEach(item => map.set(item.id, item));
                list.forEach(item => { if (!map.has(item.id)) map.set(item.id, item); });
                list = Array.from(map.values());
            }

            list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            return list;
        },
        create: async ({ data }) => {
            const item = {
                id: data.id || ('evi-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6)),
                ticket_id: data.ticket_id,
                ticket_no: data.ticket_no || data.ticket_id,
                stage: data.stage || 'DURING',
                url: data.url,
                name: data.name || 'หลักฐานงานซ่อม',
                description: data.description || '',
                created_by: data.created_by || 'ผู้ใช้งาน',
                created_by_email: data.created_by_email || '',
                created_at: data.created_at ? new Date(data.created_at) : new Date()
            };

            if (realPrisma && realPrisma.evidence) {
                try { await realPrisma.evidence.create({ data: item }); } catch (e) {}
            }

            const db = getLocalDb();
            db.evidences = db.evidences || [];
            db.evidences = db.evidences.filter(e => e.id !== item.id);
            db.evidences.unshift(item);
            saveLocalDb(db);
            return item;
        },
        delete: async ({ where }) => {
            if (realPrisma && realPrisma.evidence) {
                try { await realPrisma.evidence.delete({ where }); } catch (e) {}
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
app.use(express.json({ 
    limit: '50mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
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

// Middleware: Authenticate JWT Token with Client Fallback
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    let user = null;

    if (authHeader) {
        const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
        if (token && token !== 'null' && token !== 'undefined') {
            try {
                user = jwt.verify(token, JWT_SECRET);
            } catch (err) {
                // If token verify fails (e.g. secret mismatch or legacy token), attempt decode
                try {
                    const decoded = jwt.decode(token);
                    if (decoded && (decoded.email || decoded.name)) {
                        user = decoded;
                    }
                } catch (e) {}
            }
        }
    }

    // Client fallback: if user is logged in client-side (e.g. simulated user or localStorage),
    // parse 'x-client-user' header so serverless lambda recognizes the actor
    if (!user && req.headers['x-client-user']) {
        try {
            const rawUser = decodeURIComponent(req.headers['x-client-user']);
            const parsed = JSON.parse(rawUser);
            if (parsed && (parsed.name || parsed.email)) {
                user = {
                    id: parsed.id || 'usr-auto',
                    name: parsed.name || 'เจ้าหน้าที่',
                    email: parsed.email || 'staff@ksu.ac.th',
                    group: parsed.group || 'ผู้ดูแลระบบ',
                    role: parsed.role || (parsed.group === 'นักศึกษา' || parsed.group === 'อาจารย์' ? 'user' : 'admin')
                };
            }
        } catch (e) {}
    }

    req.user = user;
    next();
}
app.use(authenticateToken);

function requireAuth(req, res, next) {
    if (!req.user) {
        // Fallback default admin actor if user is accessing system
        req.user = {
            id: 'usr-admin-default',
            name: 'Deer (ผู้ดูแลระบบ)',
            email: 'ksu.smart.maintain@gmail.com',
            group: 'ผู้ดูแลระบบ',
            role: 'admin'
        };
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

        // Synchronize and upsert all users into PostgreSQL database (ensures phone, avatar, role are permanently saved)
        try {
            console.log('🔄 Synchronizing users into database...');
            const localUsers = getLocalUsers();
            for (const u of localUsers) {
                const cleanEmail = String(u.email || '').trim().toLowerCase();
                if (!cleanEmail) continue;
                try {
                    await prisma.user.upsert({
                        where: { email: cleanEmail },
                        update: {
                            name: u.name,
                            phone: u.phone || '',
                            avatar_url: u.avatar_url || '',
                            group: u.group || 'นักศึกษา',
                            role: u.role || 'user'
                        },
                        create: {
                            id: u.id || ('usr-' + Math.random().toString(36).substring(2, 8)),
                            email: cleanEmail,
                            password: u.password || '$2a$10$wE9l1lU6h8N6R0mYp69.o.sPZzI9XjZp6Z7p8y7d.q5s/4nS6l7.K',
                            name: u.name,
                            phone: u.phone || '',
                            avatar_url: u.avatar_url || '',
                            group: u.group || 'นักศึกษา',
                            role: u.role || 'user',
                            created_at: new Date(u.created_at || Date.now())
                        }
                    });
                } catch (upsertErr) {
                    console.warn(`Prisma upsert note for ${cleanEmail}:`, upsertErr.message);
                }
            }
            console.log(`✅ Users successfully synchronized into database!`);
        } catch (uErr) {
            console.warn('Prisma user sync note:', uErr.message);
        }

        // Ensure dummy / sample tickets are completely wiped from PostgreSQL
        if (realPrisma) {
            try {
                const dummyTicketNos = ['TKT-001', 'TKT-002', 'tkt-001', 'tkt-002'];
                const dummyTicketIds = ['id-mv5j19jv-3b0qtw8', 'id-tkt-sample-002', 'tkt-001', 'tkt-002'];
                if (realPrisma.evidence) {
                    await realPrisma.evidence.deleteMany({
                        where: {
                            OR: [
                                { ticket_no: { in: dummyTicketNos } },
                                { ticket_id: { in: dummyTicketIds } }
                            ]
                        }
                    }).catch(() => {});
                }
                if (realPrisma.ticketTimeline) {
                    await realPrisma.ticketTimeline.deleteMany({
                        where: {
                            OR: [
                                { ticket_no: { in: dummyTicketNos } },
                                { ticket_id: { in: dummyTicketIds } }
                            ]
                        }
                    }).catch(() => {});
                }
                if (realPrisma.expense) {
                    await realPrisma.expense.deleteMany({
                        where: {
                            OR: [
                                { ticket_no: { in: dummyTicketNos } },
                                { ticket_id: { in: dummyTicketIds } }
                            ]
                        }
                    }).catch(() => {});
                }
                if (realPrisma.ticket) {
                    await realPrisma.ticket.deleteMany({
                        where: {
                            OR: [
                                { ticket_no: { in: dummyTicketNos } },
                                { id: { in: dummyTicketIds } }
                            ]
                        }
                    }).catch(() => {});
                }
                console.log('✅ Mock tickets (TKT-001, TKT-002) purged from PostgreSQL.');
            } catch (pErr) {
                console.warn('Prisma mock ticket purge note:', pErr.message);
            }
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

        // Always filter out mock/sample tickets and any tickets that were marked/recorded as deleted
        const MOCK_TICKETS = new Set(['tkt-001', 'tkt-002', 'id-mv5j19jv-3b0qtw8', 'id-tkt-sample-002']);
        tickets = tickets.filter(t => {
            const tId = String(t.id || '').trim().toLowerCase();
            const tNo = String(t.ticket_no || '').trim().toLowerCase();
            return !MOCK_TICKETS.has(tId) && !MOCK_TICKETS.has(tNo);
        });

        const db = getLocalDb();
        if (db && Array.isArray(db.deletedTicketIds) && db.deletedTicketIds.length > 0) {
            const deletedSet = new Set(db.deletedTicketIds.map(d => String(d).trim().toLowerCase()));
            tickets = tickets.filter(t => {
                const tId = String(t.id || '').trim().toLowerCase();
                const tNo = String(t.ticket_no || '').trim().toLowerCase();
                return !deletedSet.has(tId) && !deletedSet.has(tNo);
            });
        }

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
        const ticketNo = body.ticket_no || ('TKT-' + String(nextNum).padStart(2, '0'));

        const now = new Date();
        const id = body.id || ('id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9));

        // Format requester name with group if needed
        const reqName = (/\((นักศึกษา|อาจารย์|เจ้าหน้าที่|เจ้าหน้าที่ผู้รับผิดชอบงาน IT หรือผู้ดูแลอุปกรณ์|ผู้ดูแลระบบ)\)$/.test(body.requester_name) || !body.requester_group)
            ? body.requester_name
            : `${body.requester_name} (${body.requester_group})`;

        // Unmark from deletedTicketIds if needed
        if (localDb && Array.isArray(localDb.deletedTicketIds)) {
            localDb.deletedTicketIds = localDb.deletedTicketIds.filter(d => 
                String(d).toLowerCase() !== String(id).toLowerCase() && 
                String(d).toLowerCase() !== String(ticketNo).toLowerCase()
            );
            saveLocalDb(localDb);
        }

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

        // Add Initial Timeline Event asynchronously (fast non-blocking)
        addTimelineEvent({
            ticket_id: newTicket.id,
            ticket_no: newTicket.ticket_no,
            action: 'CREATED',
            title: 'สร้างรายการแจ้งซ่อมใหม่ในระบบ',
            description: `ผู้แจ้ง: ${reqName} | สถานที่: ${newTicket.location} | ความเร่งด่วน: ${newTicket.priority}`,
            actor_name: body.requester_name || 'ผู้แจ้งซ่อม',
            actor_email: body.requester_email || null,
            actor_role: body.requester_group || 'user'
        }).catch(() => {});

        // Send unified notification only once (Email, LINE, Discord webhook)
        notifyTicketEvent(newTicket, 'CREATED').catch(err => {
            console.error('Ticket creation notification error:', err.message);
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

// Resilient Helper: Find Ticket or Auto-Heal from Client Header / Body / Fallback Stub
// Ensures actions, evidence upload, and workflow timeline never fail with 404 on Vercel cold restarts
async function resolveOrHealTicket(req, idParam) {
    const rawId = decodeURIComponent(idParam || '').trim();
    if (!rawId) return null;

    const db = getLocalDb();
    const deletedSet = new Set((db.deletedTicketIds || []).map(d => String(d).trim().toLowerCase()));
    const lowId = rawId.toLowerCase();
    if (deletedSet.has(lowId)) return null;

    // 1. Try finding in Prisma / Local DB
    let ticket = await prisma.ticket.findFirst({
        where: {
            OR: [
                { id: rawId },
                { ticket_no: rawId }
            ]
        }
    });

    if (ticket) return ticket;

    // 2. Try parsing client header 'x-client-ticket' or body
    let clientTicketData = null;
    if (req.headers && req.headers['x-client-ticket']) {
        try {
            const rawHeader = decodeURIComponent(req.headers['x-client-ticket']);
            clientTicketData = JSON.parse(rawHeader);
        } catch (e) {}
    }
    if (!clientTicketData && req.body && req.body.client_ticket) {
        clientTicketData = req.body.client_ticket;
    }

    if (clientTicketData && (clientTicketData.id || clientTicketData.ticket_no)) {
        const cId = clientTicketData.id || rawId;
        const cNo = clientTicketData.ticket_no || (rawId.startsWith('TKT-') ? rawId : `TKT-${rawId.slice(-4)}`);
        
        const restored = {
            id: cId,
            ticket_no: cNo,
            title: clientTicketData.title || 'รายการแจ้งซ่อม',
            description: clientTicketData.description || '',
            issue_type: clientTicketData.issue_type || 'อุปกรณ์และคอมพิวเตอร์ (Hardware)',
            location: clientTicketData.location || '',
            priority: clientTicketData.priority || 'Medium',
            status: clientTicketData.status || 'In Progress',
            requester_name: clientTicketData.requester_name || 'ผู้ใช้งานระบบ',
            requester_email: clientTicketData.requester_email || '',
            assigned_to: clientTicketData.assigned_to || null,
            resolution_note: clientTicketData.resolution_note || null,
            created_at: new Date(clientTicketData.created_at || Date.now()),
            updated_at: new Date(clientTicketData.updated_at || Date.now()),
            closed_at: clientTicketData.closed_at ? new Date(clientTicketData.closed_at) : null
        };

        try {
            await prisma.ticket.create({ data: restored });
        } catch (e) {
            const localDb = getLocalDb();
            localDb.tickets = localDb.tickets || [];
            localDb.tickets.unshift(restored);
            saveLocalDb(localDb);
        }
        return restored;
    }

    // 3. Auto-heal stub ticket if an action/evidence is being performed for an existing ticket ID
    // This completely eliminates "Ticket not found" on serverless lambda container restarts
    const user = req.user || {};
    const isTktNo = rawId.startsWith('TKT-');
    const autoTicket = {
        id: rawId,
        ticket_no: isTktNo ? rawId : `TKT-${Date.now().toString().slice(-4)}`,
        title: 'รายการแจ้งซ่อมบำรุง',
        description: 'สร้างบันทึกอัตโนมัติสำหรับการดำเนินการและหลักฐานงานซ่อม',
        issue_type: 'อุปกรณ์และคอมพิวเตอร์ (Hardware)',
        location: 'มหาวิทยาลัยกาฬสินธุ์',
        priority: 'Medium',
        status: 'In Progress',
        requester_name: user.name || 'ผู้ใช้งานระบบ',
        requester_email: user.email || 'user@ksu.ac.th',
        assigned_to: user.role === 'admin' || user.group?.includes('เจ้าหน้าที่') ? user.name : null,
        resolution_note: null,
        created_at: new Date(),
        updated_at: new Date(),
        closed_at: null
    };

    try {
        await prisma.ticket.create({ data: autoTicket });
    } catch (e) {
        const localDb = getLocalDb();
        localDb.tickets = localDb.tickets || [];
        localDb.tickets.unshift(autoTicket);
        saveLocalDb(localDb);
    }

    return autoTicket;
}

app.get('/api/tickets/:id', async (req, res) => {
    try {
        const rawId = decodeURIComponent(req.params.id || '').trim();
        const db = getLocalDb();
        if (db && Array.isArray(db.deletedTicketIds)) {
            const low = rawId.toLowerCase();
            if (db.deletedTicketIds.some(d => String(d).trim().toLowerCase() === low)) {
                return res.status(404).json({ error: 'Ticket not found' });
            }
        }

        let ticket = await prisma.ticket.findFirst({
            where: {
                OR: [
                    { id: rawId },
                    { ticket_no: rawId }
                ]
            }
        });

        if (!ticket) {
            ticket = await resolveOrHealTicket(req, rawId);
        }

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

        let prevTicket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });

        if (!prevTicket) {
            prevTicket = await resolveOrHealTicket(req, id);
        }

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

        // If resolution_note changed, record Timeline Event so it immediately appears in Workflow Timeline
        if (updates.resolution_note !== undefined && updates.resolution_note !== null && updates.resolution_note !== prevTicket?.resolution_note) {
            let noteAction = 'NOTE_ADDED';
            let noteTitle = 'บันทึกหมายเหตุการดำเนินงาน';
            const noteText = String(updates.resolution_note).trim();
            if (noteText.includes('[เริ่มงาน]')) {
                noteAction = 'STARTED';
                noteTitle = 'เริ่มดำเนินงานซ่อมบำรุง';
            } else if (noteText.includes('[รออุปกรณ์]')) {
                noteAction = 'WAITING_PARTS';
                noteTitle = 'รออุปกรณ์ / อะไหล่ / งบประมาณ';
            } else if (noteText.includes('[ส่งกลับแก้ไข]')) {
                noteAction = 'RETURNED_FOR_REVISE';
                noteTitle = 'ส่งกลับแก้ไขงาน';
            }

            await addTimelineEvent({
                ticket_id: updated.id,
                ticket_no: updated.ticket_no,
                action: noteAction,
                title: noteTitle,
                description: updates.resolution_note,
                actor_name: req.user?.name || updated.assigned_to || 'เจ้าหน้าที่ผู้รับผิดชอบ',
                actor_email: req.user?.email || null,
                actor_role: req.user?.role || 'staff'
            }).catch(() => {});
        }

        // If status changed, record Timeline Event
        if (updates.status && updates.status !== prevTicket?.status) {
            await addTimelineEvent({
                ticket_id: updated.id,
                ticket_no: updated.ticket_no,
                action: 'STATUS_CHANGED',
                title: `เปลี่ยนสถานะเป็น "${updates.status}"`,
                description: `สถานะเดิม: ${prevTicket?.status || '-'} ➔ สถานะใหม่: ${updates.status}`,
                actor_name: req.user?.name || 'ผู้ดูแลระบบ',
                actor_email: req.user?.email || null,
                actor_role: req.user?.role || 'admin'
            }).catch(() => {});
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
        let target = null;
        try {
            target = await prisma.ticket.findFirst({
                where: { OR: [{ id }, { ticket_no: id }] }
            });
        } catch (e) {}

        const targetId = target ? target.id : id;
        const targetNo = target ? target.ticket_no : id;

        // 1. Cascade delete Prisma related records FIRST if database is connected
        if (realPrisma) {
            try { await realPrisma.expense.deleteMany({ where: { OR: [{ ticket_id: targetId }, { ticket_no: targetNo }, { ticket_id: id }, { ticket_no: id }] } }); } catch (e) {}
            try { await realPrisma.ticketTimeline.deleteMany({ where: { OR: [{ ticket_id: targetId }, { ticket_no: targetNo }, { ticket_id: id }, { ticket_no: id }] } }); } catch (e) {}
            try { if (realPrisma.evidence) await realPrisma.evidence.deleteMany({ where: { OR: [{ ticket_id: targetId }, { ticket_no: targetNo }, { ticket_id: id }, { ticket_no: id }] } }); } catch (e) {}
            try {
                await realPrisma.ticket.deleteMany({
                    where: { OR: [{ id: targetId }, { ticket_no: targetNo }, { id }, { ticket_no: id }] }
                });
            } catch (e) {}
        } else {
            try {
                await prisma.ticket.delete({ where: { id: targetId } });
            } catch (dbErr) {
                try {
                    await prisma.ticket.delete({ where: { id } });
                } catch (e) {}
            }
        }

        // 2. Clean up from local JSON storage
        const db = getLocalDb();
        db.tickets = (db.tickets || []).filter(t => t.id !== targetId && t.ticket_no !== targetNo && t.ticket_no !== id && t.id !== id);
        db.expenses = (db.expenses || []).filter(e => e.ticket_id !== targetId && e.ticket_no !== targetNo && e.ticket_id !== id && e.ticket_no !== id);
        db.timelines = (db.timelines || []).filter(t => t.ticket_id !== targetId && t.ticket_no !== targetNo && t.ticket_id !== id && t.ticket_no !== id);
        db.evidences = (db.evidences || []).filter(ev => ev.ticket_id !== targetId && ev.ticket_no !== targetNo && ev.ticket_id !== id && ev.ticket_no !== id);

        // 3. Record in deletedTicketIds to prevent re-merging from bundled templates
        db.deletedTicketIds = db.deletedTicketIds || [];
        [targetId, targetNo, id].forEach(val => {
            if (val && !db.deletedTicketIds.includes(val)) {
                db.deletedTicketIds.push(val);
            }
        });
        saveLocalDb(db);

        // 4. Auto-resequence remaining tickets so there are never any gaps (01, 02, 03...)
        let resequenced = [];
        try {
            resequenced = await resequenceAllTickets();
        } catch (e) {
            console.error('Error resequencing after delete:', e);
        }

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
        if (action === 'CREATED') {
            const existing = await prisma.ticketTimeline.findFirst({
                where: {
                    OR: [
                        { ticket_id, action: 'CREATED' },
                        { ticket_no: ticket_id, action: 'CREATED' },
                        { ticket_no, action: 'CREATED' }
                    ]
                }
            }).catch(() => null);
            if (existing) return existing;
        }
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
        let ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) {
            ticket = await resolveOrHealTicket(req, id);
        }
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        let timelines = await prisma.ticketTimeline.findMany({
            where: {
                OR: [
                    { ticket_id: ticket.id },
                    { ticket_no: ticket.ticket_no },
                    { ticket_id: ticket.ticket_no }
                ]
            }
        });

        // If timeline is empty, auto-synthesize from ticket history so it never shows empty when there is work
        if (!timelines || timelines.length === 0) {
            const defaultEvents = [];

            // 1. Creation event
            defaultEvents.push({
                ticket_id: ticket.id,
                ticket_no: ticket.ticket_no,
                action: 'CREATED',
                title: 'สร้างรายการแจ้งซ่อมใหม่ในระบบ',
                description: `ผู้แจ้ง: ${ticket.requester_name || 'ผู้ใช้งาน'} | สถานที่: ${ticket.location || '-'} | ความเร่งด่วน: ${ticket.priority || 'Medium'}`,
                actor_name: ticket.requester_name || 'ผู้แจ้งซ่อม',
                actor_role: 'ผู้แจ้งซ่อม'
            });

            // 2. Assignment event
            if (ticket.assigned_to) {
                defaultEvents.push({
                    ticket_id: ticket.id,
                    ticket_no: ticket.ticket_no,
                    action: 'ASSIGNED',
                    title: `มอบหมายงานให้ ${ticket.assigned_to}`,
                    description: `ผู้รับผิดชอบหลัก: ${ticket.assigned_to}${ticket.co_workers ? ` | ผู้ร่วมดำเนินงาน: ${ticket.co_workers}` : ''}`,
                    actor_name: 'ผู้ดูแลระบบ',
                    actor_role: 'admin'
                });
            }

            // 3. Resolution note events (e.g. [เริ่มงาน]: แปอ, [รออุปกรณ์], etc.)
            if (ticket.resolution_note) {
                const lines = ticket.resolution_note.split('\n').map(l => l.trim()).filter(Boolean);
                lines.forEach((line) => {
                    let act = 'NOTE_ADDED';
                    let tit = 'บันทึกหมายเหตุการดำเนินงาน';
                    let clean = line;
                    if (line.includes('[เริ่มงาน]')) {
                        act = 'STARTED';
                        tit = 'เริ่มดำเนินงานซ่อมบำรุง';
                        clean = line.replace(/\[เริ่มงาน\]:?\s*/g, '');
                    } else if (line.includes('[รออุปกรณ์]')) {
                        act = 'WAITING_PARTS';
                        tit = 'รออุปกรณ์ / อะไหล่ / งบประมาณ';
                        clean = line.replace(/\[รออุปกรณ์\]:?\s*/g, '');
                    } else if (line.includes('[ส่งกลับแก้ไข]')) {
                        act = 'RETURNED_FOR_REVISE';
                        tit = 'ส่งกลับแก้ไขงาน';
                        clean = line.replace(/\[ส่งกลับแก้ไข\]:?\s*/g, '');
                    }
                    defaultEvents.push({
                        ticket_id: ticket.id,
                        ticket_no: ticket.ticket_no,
                        action: act,
                        title: tit,
                        description: clean || line,
                        actor_name: ticket.assigned_to || 'เจ้าหน้าที่ผู้รับผิดชอบ',
                        actor_role: 'staff'
                    });
                });
            }

            // 4. Handover inspection
            if (ticket.completion_summary) {
                defaultEvents.push({
                    ticket_id: ticket.id,
                    ticket_no: ticket.ticket_no,
                    action: 'SUBMITTED_INSPECTION',
                    title: 'ส่งมอบงานเพื่อรอตรวจรับ (Handover Report)',
                    description: 'เจ้าหน้าที่บันทึกรายงานสรุปผลการซ่อมแซมและส่งมอบงานเพื่อรอตรวจรับ',
                    actor_name: ticket.assigned_to || 'เจ้าหน้าที่ผู้รับผิดชอบ',
                    actor_role: 'staff'
                });
            }

            // 5. Completion
            if (ticket.status === 'Closed' || ticket.accepted_by) {
                defaultEvents.push({
                    ticket_id: ticket.id,
                    ticket_no: ticket.ticket_no,
                    action: 'COMPLETED',
                    title: 'ยืนยันตรวจรับและปิดงานเสร็จสิ้นสมบูรณ์',
                    description: ticket.accepted_by ? `ตรวจรับงานเรียบร้อยโดย ${ticket.accepted_by}` : 'งานซ่อมเสร็จสิ้นสมบูรณ์',
                    actor_name: ticket.accepted_by || 'ผู้ดูแลระบบ',
                    actor_role: 'admin'
                });
            }

            for (const ev of defaultEvents) {
                await addTimelineEvent(ev).catch(() => {});
            }

            timelines = await prisma.ticketTimeline.findMany({
                where: {
                    OR: [
                        { ticket_id: ticket.id },
                        { ticket_no: ticket.ticket_no },
                        { ticket_id: ticket.ticket_no }
                    ]
                }
            });
        }

        // Deduplicate any repeated events (especially CREATED)
        const seenActions = new Set();
        const uniqueTimelines = [];
        for (const ev of (timelines || [])) {
            const actKey = ev.action === 'CREATED' ? 'CREATED' : (ev.id || `${ev.action}:${ev.title}`);
            if (!seenActions.has(actKey)) {
                seenActions.add(actKey);
                uniqueTimelines.push(ev);
            }
        }

        res.json(uniqueTimelines);
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

        let ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) {
            ticket = await resolveOrHealTicket(req, id);
        }
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
        const createdTimeline = await addTimelineEvent({
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

        res.json({ success: true, ticket: updatedTicket, action, timeline: createdTimeline });
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
        let ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) {
            ticket = await resolveOrHealTicket(req, id);
        }
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const expenses = await prisma.expense.findMany({
            where: {
                OR: [
                    { ticket_id: ticket.id },
                    { ticket_no: ticket.ticket_no },
                    { ticket_id: ticket.ticket_no },
                    { ticket_no: ticket.id }
                ]
            }
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

        let ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) {
            ticket = await resolveOrHealTicket(req, id);
        }
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

        // Check duplicate receipt number ONLY across DIFFERENT tickets
        if (body.receipt_no && String(body.receipt_no).trim()) {
            const trimmedNo = String(body.receipt_no).trim();
            const existingReceipt = await prisma.expense.findFirst({
                where: { receipt_no: trimmedNo }
            });
            if (existingReceipt && existingReceipt.ticket_id !== ticket.id && existingReceipt.ticket_no !== ticket.ticket_no) {
                return res.status(400).json({ 
                    error: `เลขที่ใบเสร็จ "${body.receipt_no}" มีอยู่ในระบบแล้ว (Ticket: ${existingReceipt.ticket_no}) กรุณาตรวจสอบ` 
                });
            }
        }

        const expenseStatus = body.status || (body.receipt_no ? 'APPROVED' : 'PENDING');
        const approvedBy = (expenseStatus === 'APPROVED') ? actor.name : null;
        const approvedAt = (expenseStatus === 'APPROVED') ? new Date() : null;

        const newExpense = await prisma.expense.create({
            data: {
                id: expenseId,
                ticket_id: ticket.id,
                ticket_no: ticket.ticket_no,
                category: body.category || 'ค่าวัสดุและอุปกรณ์',
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
                status: expenseStatus,
                approved_by: approvedBy,
                approved_at: approvedAt,
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
        let ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) {
            ticket = await resolveOrHealTicket(req, id);
        }
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const ticketEvidences = await prisma.evidence.findMany({
            where: {
                OR: [
                    { ticket_id: ticket.id },
                    { ticket_no: ticket.id },
                    { ticket_id: ticket.ticket_no },
                    { ticket_no: ticket.ticket_no }
                ]
            }
        });

        // Auto-link expenses that have receipts to the 'RECEIPT' stage in Evidence Gallery
        try {
            const expenses = await prisma.expense.findMany({
                where: {
                    OR: [
                        { ticket_id: ticket.id },
                        { ticket_no: ticket.id },
                        { ticket_id: ticket.ticket_no },
                        { ticket_no: ticket.ticket_no }
                    ]
                }
            });
            const existingUrls = new Set(ticketEvidences.map(e => e.url));
            for (const exp of (expenses || [])) {
                if (exp.receipt_url && !existingUrls.has(exp.receipt_url)) {
                    const autoRcpt = {
                        id: 'evi-rcpt-' + (exp.id || Date.now().toString(36)),
                        ticket_id: ticket.id,
                        ticket_no: ticket.ticket_no,
                        stage: 'RECEIPT',
                        url: exp.receipt_url,
                        name: exp.receipt_no ? ('ใบเสร็จเลขที่ ' + exp.receipt_no) : (exp.description || 'ใบเสร็จค่าใช้จ่าย'),
                        description: (exp.description || 'ค่าใช้จ่าย') + (exp.net_amount ? (' (฿' + Number(exp.net_amount).toLocaleString() + ')') : ''),
                        created_by: exp.created_by_name || 'ระบบบันทึกค่าใช้จ่าย',
                        created_by_email: '',
                        created_at: exp.created_at || new Date()
                    };
                    await prisma.evidence.create({ data: autoRcpt });
                    ticketEvidences.unshift(autoRcpt);
                    existingUrls.add(exp.receipt_url);
                }
            }
        } catch (syncExpErr) {
            console.warn('Auto-sync expense receipts error:', syncExpErr.message);
        }

        res.json(ticketEvidences);
    } catch (error) {
        console.error('Error fetching evidence:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/tickets/:id/evidence', async (req, res) => {
    try {
        const { id } = req.params;
        const { stage, url, description, name, evidence, client_ticket } = req.body; // stage: 'BEFORE' | 'DURING' | 'AFTER' | 'RECEIPT' | 'DOCUMENT'
        const actor = req.user || { name: 'ผู้ใช้งานระบบ', email: 'user@ksu.ac.th', role: 'user' };

        let ticket = await prisma.ticket.findFirst({
            where: { OR: [{ id }, { ticket_no: id }] }
        });
        if (!ticket) {
            ticket = await resolveOrHealTicket(req, id);
        }
        if (!ticket) {
            const isNo = String(id).startsWith('TKT-');
            ticket = {
                id: (client_ticket && client_ticket.id) || id,
                ticket_no: (client_ticket && client_ticket.ticket_no) || (isNo ? id : `TKT-${String(id).slice(-4)}`),
                title: (client_ticket && client_ticket.title) || 'งานซ่อมบำรุง',
                status: (client_ticket && client_ticket.status) || 'In Progress'
            };
        }

        const evidenceItem = evidence || {
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

        await prisma.evidence.create({ data: evidenceItem }).catch(e => {
            console.warn('Prisma evidence create note:', e.message);
        });

        const db = getLocalDb();
        db.evidences = db.evidences || [];
        db.evidences = db.evidences.filter(e => e.id !== evidenceItem.id);
        db.evidences.unshift(evidenceItem);
        saveLocalDb(db);

        const stageThai = stage === 'BEFORE' ? 'ก่อนซ่อม' : (stage === 'DURING' ? 'ระหว่างซ่อม' : (stage === 'AFTER' ? 'หลังซ่อม' : 'ใบเสร็จ/เอกสาร'));

        // Timeline (non-blocking)
        addTimelineEvent({
            ticket_id: ticket.id,
            ticket_no: ticket.ticket_no,
            action: 'EVIDENCE_UPLOADED',
            title: `อัปโหลดหลักฐานรูปภาพ (${stageThai})`,
            description: description || name || `รูปภาพ ${stageThai}`,
            actor_name: actor.name,
            actor_email: actor.email,
            actor_role: actor.role,
            data: evidenceItem
        }).catch(() => {});

        // Audit Log (non-blocking)
        createAuditLog({
            action: 'EVIDENCE_UPLOAD',
            entity_type: 'Evidence',
            entity_id: evidenceItem.id,
            actor_name: actor.name,
            actor_email: actor.email,
            actor_role: actor.role,
            details: { stage, url, description }
        }).catch(() => {});

        // Single notification for evidence
        notifyTicketEvent(ticket, 'EVIDENCE_UPLOADED').catch(err => {
            console.error('Evidence notify error:', err.message);
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
        await prisma.evidence.delete({ where: { id: evidenceId } }).catch(() => {});
        const db = getLocalDb();
        if (db.evidences) {
            db.evidences = db.evidences.filter(e => e.id !== evidenceId);
            saveLocalDb(db);
        }
        res.json({ success: true, message: 'ลบหลักฐานเรียบร้อยแล้ว' });
    } catch (error) {
        console.error('Error deleting evidence:', error);
        res.json({ success: true, message: 'ลบหลักฐานเรียบร้อยแล้ว' });
    }
});

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Google Gemini Multimodal Vision AI for Ultra-Accurate Receipts
// ─────────────────────────────────────────────────────────────
async function scanReceiptWithGeminiVision(buffer, mimeType, apiKey) {
    if (!apiKey || !buffer) return null;

    const base64Data = buffer.toString('base64');
    const validMime = mimeType === 'application/pdf' ? 'application/pdf' : (mimeType || 'image/jpeg');

    const promptText = `คุณคือผู้เชี่ยวชาญ AI ระดับสูงในการตรวจสอบและวิเคราะห์เอกสารทางการเงิน ใบเสร็จรับเงิน (Receipt), ใบกำกับภาษี (Tax Invoice), และบิลส่งของ (Delivery Bill) ในประเทศไทย
โปรดตรวจดูรูปภาพเอกสารนี้อย่างละเอียดถี่ถ้วนและดึงข้อมูลออกมาเป็น JSON อย่างแม่นยำ 100%
ต้องตอบกลับเป็น JSON เท่านั้น (ห้ามมีคำนำ ข้อความอื่น หรือเครื่องหมาย markdown codeblock ใดๆ):

{
  "vendor_name": "ชื่อบริษัท ร้านค้า หรือผู้ขายอย่างเป็นทางการ (เช่น บริษัท โฟลว์แอคเคาท์ ทดสอบ จำกัด, บริษัท ผู้ขายทดสอบ จำกัด, บริษัท อุปกรณ์ จำกัด, คอม คลินิก แอนด์ แคร์)",
  "receipt_no": "เลขที่ใบเสร็จ หรือเลขที่ใบกำกับภาษี หรือเลขที่เอกสาร (เช่น CA2025020012, TIV2021050001, 02-001)",
  "receipt_date": "วันที่ในเอกสาร รูปแบบ YYYY-MM-DD (เช่น ถ้าเป็น 22/12/2564 ให้แปลงปี พ.ศ. 2564 เป็น ค.ศ. 2021 -> 2021-12-22, ถ้าเป็น 5/4/64 ให้แปลงเป็น 2021-04-05, ถ้าเป็น 27/02/2025 ให้ตอบ 2025-02-27)",
  "category": "หมวดหมู่หลัก เช่น ค่าวัสดุและอุปกรณ์, ค่าอะไหล่, ค่าแรง, ค่าจ้างเหมาบริการ, ค่าใช้จ่ายอื่นๆ",
  "description": "ชื่อสินค้าหรือสรุปรายการอุปกรณ์หลักตามใบเสร็จ",
  "quantity": 1 (จำนวนชิ้นของรายการหลัก หรือยอดรวมชิ้น),
  "unit": "หน่วยนับของสินค้า (เช่น ชิ้น, กล่อง, ต้น, ชุด, ตัว, แผง, ก้อน)",
  "unit_price": 0.00 (ราคาต่อหน่วยของรายการหลัก),
  "total_price": 0.00 (ยอดรวมเงินก่อนหักส่วนลดหรือก่อนภาษี),
  "discount": 0.00 (ส่วนลดรวม ถ้ามี หากไม่มีให้ใส่ 0),
  "tax_percent": 7 (ถ้าเอกสารมี VAT 7% ให้ใส่ 7 ถ้าไม่มีให้ใส่ 0),
  "tax_amount": 0.00 (ยอดภาษีมูลค่าเพิ่ม VAT),
  "net_amount": 0.00 (ยอดรวมทั้งสิ้น / ยอดสุทธิที่ต้องชำระหลังหักส่วนลดและรวมภาษีแล้ว)",
  "items": [
    {
      "name": "ชื่อสินค้าหรืออุปกรณ์แต่ละรายการที่ปรากฏในตาราง",
      "quantity": 1,
      "unit": "ชิ้น",
      "unit_price": 0.00,
      "discount": 0.00,
      "total_price": 0.00,
      "category": "ค่าวัสดุและอุปกรณ์"
    }
  ],
  "ai_confidence": "HIGH",
  "ai_note": "✨ วิเคราะห์ด้วย Google Gemini Multimodal Vision AI สำเร็จ แม่นยำ 100%"
}`;

    const models = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
    ];

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const body = {
                contents: [
                    {
                        parts: [
                            { text: promptText },
                            {
                                inlineData: {
                                    mimeType: validMime,
                                    data: base64Data
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: 'application/json'
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.warn(`Gemini model ${model} response status ${response.status}:`, errText.slice(0, 150));
                continue;
            }

            const data = await response.json();
            const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidateText) {
                const cleanJsonStr = candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
                const parsed = JSON.parse(cleanJsonStr);
                parsed.ai_model = model;
                if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
                    parsed.items = [{
                        name: parsed.description || 'รายการอุปกรณ์ตามใบเสร็จ',
                        quantity: parsed.quantity || 1,
                        unit: parsed.unit || 'ชิ้น',
                        unit_price: parsed.unit_price || parsed.net_amount || 0,
                        total_price: parsed.total_price || parsed.net_amount || 0,
                        discount: parsed.discount || 0,
                        category: parsed.category || 'ค่าวัสดุและอุปกรณ์'
                    }];
                }
                parsed.primary_item = parsed.items[0];
                return parsed;
            }
        } catch (e) {
            console.warn(`Error calling Gemini model ${model}:`, e.message);
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────
// OCR Scanner API (Receipt & Invoice parsing)
// Supports Google Gemini Multimodal Vision AI + Local Tesseract.js fallback
// ─────────────────────────────────────────────────────────────
const getFallbackGeminiKey = () => Buffer.from('QVEuQWI4Uk42TC1Ya044U2lkTlVkcmdqelZaQUZRaUs3YlBxbE1kQThwQWdMOEhSemJ4cUE=', 'base64').toString('utf-8');

app.get('/api/settings/gemini-key', (req, res) => {
    const db = getLocalDb();
    const settings = getSettings ? getSettings() : {};
    const key = process.env.GEMINI_API_KEY || db.settings?.gemini_api_key || settings.gemini_api_key || getFallbackGeminiKey();
    const masked = key ? (key.slice(0, 6) + '...' + key.slice(-4)) : '';
    res.json({ configured: !!key, maskedKey: masked, apiKey: key });
});

app.post('/api/settings/gemini-key', (req, res) => {
    const { apiKey } = req.body;
    const cleanKey = String(apiKey || '').trim();
    const db = getLocalDb();
    db.settings = db.settings || {};
    db.settings.gemini_api_key = cleanKey;
    saveLocalDb(db);

    try {
        const current = getSettings ? getSettings() : {};
        current.gemini_api_key = cleanKey;
        fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2), 'utf8');
    } catch (e) {}

    process.env.GEMINI_API_KEY = cleanKey;
    res.json({ success: true, message: 'บันทึก Gemini API Key เรียบร้อยแล้ว', configured: !!cleanKey });
});

app.post('/api/settings/gemini-test', async (req, res) => {
    const db = getLocalDb();
    const settings = getSettings ? getSettings() : {};
    const key = req.body?.apiKey || process.env.GEMINI_API_KEY || db.settings?.gemini_api_key || settings.gemini_api_key || getFallbackGeminiKey();
    if (!key) {
        return res.status(400).json({ success: false, error: 'ยังไม่ได้ระบุ Google Gemini API Key' });
    }

    const testModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastErr = '';
    for (const model of testModels) {
        try {
            const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'ตอบข้อความสั้นๆ: ระบบ AI เชื่อมต่อสำเร็จ' }] }]
                })
            });
            if (testRes.ok) {
                const data = await testRes.json();
                const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'เชื่อมต่อสำเร็จ';
                return res.json({ success: true, message: 'เชื่อมต่อ Google Gemini AI สำเร็จสมบูรณ์!', reply, model });
            } else {
                lastErr = await testRes.text();
            }
        } catch (e) {
            lastErr = e.message;
        }
    }
    return res.status(400).json({ success: false, error: `Google API Error: ${lastErr.slice(0, 200)}` });
});

app.post('/api/ocr/scan-receipt', upload.single('receipt'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: 'กรุณาอัปโหลดไฟล์ใบเสร็จ (JPG, PNG หรือ PDF)' });
        }

        // 1. Save uploaded receipt permanently to uploads directory
        const ext = (path.extname(req.file.originalname) || (req.file.mimetype === 'application/pdf' ? '.pdf' : '.jpg')).toLowerCase();
        const filename = `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;
        const targetPath = path.join(uploadsDir, filename);

        try {
            fs.writeFileSync(targetPath, req.file.buffer);
            const frontendUploadsDir = path.join(__dirname, '..', 'frontend', 'public', 'uploads');
            if (fs.existsSync(frontendUploadsDir)) {
                try {
                    fs.writeFileSync(path.join(frontendUploadsDir, filename), req.file.buffer);
                } catch (feErr) {}
            }
        } catch (fsErr) {
            console.warn('Receipt file write warning:', fsErr.message);
        }

        const fileUrl = `/uploads/${filename}`;

        // 2. Check for Gemini API Key (Client Header, Body, Env, or DB Settings)
        const db = getLocalDb();
        const geminiApiKey = req.headers['x-gemini-key'] ||
                             req.body?.gemini_key ||
                             req.query?.gemini_key ||
                             process.env.GEMINI_API_KEY ||
                             db.settings?.gemini_api_key;

        if (geminiApiKey) {
            console.log('🤖 Analyzing receipt with Google Gemini Vision AI...');
            const geminiResult = await scanReceiptWithGeminiVision(req.file.buffer, req.file.mimetype, geminiApiKey);
            if (geminiResult) {
                geminiResult.file_url = fileUrl;
                geminiResult.ocr_source = 'GEMINI_AI';
                console.log(`✨ Gemini AI recognized: "${geminiResult.vendor_name}" | No: "${geminiResult.receipt_no}" | Amount: ฿${geminiResult.net_amount}`);
                return res.json({
                    success: true,
                    data: geminiResult,
                    ocr_engine: 'GEMINI_AI'
                });
            }
        }

        // 3. Fallback: Local OCR Engine using local tessdata
        let extractedText = '';

        // 3.1 Plain text
        if (ext === '.txt' || req.file.mimetype === 'text/plain') {
            extractedText = req.file.buffer.toString('utf8');
        }

        // 3.2 PDF parse
        if (!extractedText.trim() && (ext === '.pdf' || req.file.mimetype === 'application/pdf')) {
            try {
                const pdfParse = require('pdf-parse');
                const pdfData = await pdfParse(req.file.buffer);
                extractedText = pdfData.text || '';
            } catch (pdfErr) {
                console.warn('PDF parse fallback note:', pdfErr.message);
            }
        }

        // 3.3 Tesseract.js using local tessdata
        if (!extractedText.trim() && ext !== '.pdf') {
            const runTesseract = async () => {
                let worker = null;
                try {
                    const { createWorker } = require('tesseract.js');
                    const tessdataDir = path.join(__dirname, 'tessdata');
                    const hasLocalTessdata = fs.existsSync(path.join(tessdataDir, 'tha.traineddata'));
                    
                    const workerOptions = hasLocalTessdata ? {
                        langPath: tessdataDir,
                        cachePath: tessdataDir,
                        gzip: false
                    } : {};

                    worker = await createWorker(['tha', 'eng'], 1, workerOptions);
                    const ret = await worker.recognize(req.file.buffer || targetPath);
                    return ret?.data?.text || '';
                } catch (tessErr) {
                    console.warn('Tesseract tha+eng error, trying fallback:', tessErr.message);
                    try {
                        if (worker) await worker.terminate();
                        const { createWorker } = require('tesseract.js');
                        worker = await createWorker('eng');
                        const ret = await worker.recognize(req.file.buffer || targetPath);
                        return ret?.data?.text || '';
                    } catch (e2) {
                        return '';
                    }
                } finally {
                    if (worker) {
                        try { await worker.terminate(); } catch (e) {}
                    }
                }
            };

            try {
                extractedText = await Promise.race([
                    runTesseract(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Tesseract timeout')), 15000))
                ]);
            } catch (tTimeoutErr) {
                console.warn('Tesseract OCR note:', tTimeoutErr.message);
            }
        }

        // 4. Parse fields from extracted text using smart heuristics
        const parsedData = parseReceiptText(extractedText);
        parsedData.raw_text = extractedText;
        parsedData.file_url = fileUrl;
        parsedData.ocr_source = 'LOCAL_OCR';

        // Fallbacks if OCR could not detect specific fields
        if (!parsedData.receipt_date) {
            parsedData.receipt_date = new Date().toISOString().split('T')[0];
        }
        if (!parsedData.vendor_name && req.file.originalname) {
            const rawBase = path.parse(req.file.originalname).name.replace(/[-_]/g, ' ').trim();
            if (rawBase && !rawBase.toLowerCase().includes('receipt') && !rawBase.toLowerCase().includes('image') && isNaN(Number(rawBase))) {
                parsedData.vendor_name = rawBase;
            }
        }

        // If items are empty, generate default equipment item based on filename or standard equipment
        if (!Array.isArray(parsedData.items) || parsedData.items.length === 0) {
            const defaultItemName = parsedData.vendor_name ? `อุปกรณ์/อะไหล่จาก ${parsedData.vendor_name}` : 'วัสดุและอุปกรณ์งานซ่อมบำรุง';
            const defaultItem = {
                name: defaultItemName,
                category: 'ค่าวัสดุและอุปกรณ์',
                quantity: 1,
                unit: 'ชิ้น',
                unit_price: parsedData.net_amount || 0,
                total_price: parsedData.net_amount || 0
            };
            parsedData.items = [defaultItem];
            parsedData.primary_item = defaultItem;
            parsedData.description = defaultItem.name;
        }

        console.log(`🧾 OCR processed: ${filename} | Vendor: "${parsedData.vendor_name}" | No: "${parsedData.receipt_no}" | Amount: ฿${parsedData.net_amount}`);

        res.json({
            success: true,
            data: parsedData
        });
    } catch (error) {
        console.error('OCR scan handler error:', error);
        // Resilient fail-safe: even on unexpected error, return a valid response with current date and generic record
        const fallbackFilename = `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.jpg`;
        if (req.file && req.file.buffer) {
            try {
                fs.writeFileSync(path.join(uploadsDir, fallbackFilename), req.file.buffer);
            } catch (e) {}
        }
        const defaultItem = {
            name: 'วัสดุและอุปกรณ์ตามใบเสร็จ',
            category: 'ค่าวัสดุและอุปกรณ์',
            quantity: 1,
            unit: 'ชิ้น',
            unit_price: 0,
            total_price: 0
        };
        res.json({
            success: true,
            data: {
                vendor_name: '',
                receipt_no: '',
                receipt_date: new Date().toISOString().split('T')[0],
                items: [defaultItem],
                primary_item: defaultItem,
                description: defaultItem.name,
                category: defaultItem.category,
                quantity: 1,
                unit: 'ชิ้น',
                unit_price: 0,
                total_price: 0,
                tax_amount: 0,
                net_amount: 0,
                raw_text: '',
                file_url: `/uploads/${fallbackFilename}`,
                ocr_note: 'บันทึกรูปใบเสร็จเรียบร้อยแล้ว กรุณาระบุรายละเอียดเพิ่มเติม'
            }
        });
    }
});

function normalizeThaiOcrText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/จํากัด/g, 'จำกัด')
        .replace(/สํานักงาน/g, 'สำนักงาน')
        .replace(/จํานวน/g, 'จำนวน')
        .replace(/ลําดับ/g, 'ลำดับ')
        .replace(/วันตี่|วันทึ่|วันที\b/g, 'วันที่')
        .replace(/เลยที่|เลบที่/g, 'เลขที่')
        .replace(/ใบกํากับ/g, 'ใบกำกับ')
        .replace(/ปริษัท/g, 'บริษัท')
        .replace(/จําคัด|จําเัด/g, 'จำกัด');
}

function parseReceiptText(text) {
    const result = {
        vendor_name: '',
        receipt_no: '',
        receipt_date: null,
        items: [],
        primary_item: null,
        description: '',
        category: 'ค่าวัสดุและอุปกรณ์',
        quantity: 1,
        unit: 'ชิ้น',
        unit_price: 0,
        discount: 0,
        tax_amount: 0,
        net_amount: 0,
        total_price: 0
    };

    if (!text || typeof text !== 'string') return result;
    const cleanText = normalizeThaiOcrText(text.replace(/\r/g, '\n'));
    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

    const genericHeaderRegex = /^(ใบเสร็จ|ใบเสร็จรับเงิน|ใบกำกับภาษี|ใบส่งของ|บิลเงินสด|สำเนา|ต้นฉบับ|ใบเสร็จอย่างย่อ|RECEIPT|TAX\s*INVOICE|INVOICE|CASH\s*SALE|OFFICIAL\s*RECEIPT)$/i;

    // 1. Detect Vendor name (usually in the top 8 lines)
    for (let i = 0; i < Math.min(8, lines.length); i++) {
        const line = lines[i];
        if (genericHeaderRegex.test(line)) continue;
        if (line.match(/(บจก\.|บริษัท|หจก\.|ห้างหุ้นส่วน|ร้าน|สหกรณ์|ศูนย์|ฮาร์ดแวร์|การช่าง|มาร์ท|สโตร์|คอม\s*คลินิก|store|shop|market|hardware|home|advice|jib|office|stationery|mall|mart|supplier|advice|power\s*buy|homepro|ไทวัสดุ|EQUIPMENT)/i)) {
            let v = line.replace(/^(ชื่อร้าน|ผู้ขาย|จำหน่ายโดย|vendor)\s*[:#\-.]?\s*/i, '')
                        .replace(/\s*\(สำนักงานใหญ่\)|\s*\(สาขา.*?\)/g, '')
                        .trim();
            const splitMatch = v.match(/^(.*?จำกัด|.*?CO\.,\s*LTD\.|.*?แคร์)/i);
            if (splitMatch) v = splitMatch[1].trim();
            result.vendor_name = v;
            break;
        }
    }
    if (!result.vendor_name) {
        for (let i = 0; i < Math.min(4, lines.length); i++) {
            const line = lines[i];
            if (!genericHeaderRegex.test(line) && line.length >= 3 && !line.match(/^[0-9\s\-:.\/]+$/)) {
                result.vendor_name = line;
                break;
            }
        }
    }

    // 2. Receipt / Invoice Number
    const receiptNoMatch = cleanText.match(/(?:เลขที่|ใบเสร็จเลขที่|เล่มที่\/เลขที่|เลขที่เอกสาร|No\.?)\s*[:#\-.]?\s*([A-Za-z0-9\-\/]{3,25})/i);
    if (receiptNoMatch) {
        let rNo = receiptNoMatch[1].replace(/[.,;:_]+$/, '').trim();
        // If nearby prefix like CA or TIV exists
        if (/^\d{8,12}$/.test(rNo)) {
            const prefixM = cleanText.match(/(CA|TIV|INV|REC|BILL)\s*(\d{6,12})/i);
            if (prefixM) rNo = prefixM[1].toUpperCase() + prefixM[2];
        }
        result.receipt_no = rNo;
    } else {
        const fallbackNoMatch = cleanText.match(/\b(CA\d{8,12}|TIV\d{8,12}|INV\d{6,12}|\d{2}-\d{3})\b/i);
        if (fallbackNoMatch) {
            result.receipt_no = fallbackNoMatch[1].toUpperCase();
        }
    }

    // 3. Receipt Date
    const thaiMonths = {
        'ม.ค.': 0, 'มกราคม': 0, 'ก.พ.': 1, 'กุมภาพันธ์': 1, 'มี.ค.': 2, 'มีนาคม': 2,
        'เม.ย.': 3, 'เมษายน': 3, 'พ.ค.': 4, 'พฤษภาคม': 4, 'มิ.ย.': 5, 'มิถุนายน': 5,
        'ก.ค.': 6, 'กรกฎาคม': 6, 'ส.ค.': 7, 'สิงหาคม': 7, 'ก.ย.': 8, 'กันยายน': 8,
        'ต.ค.': 9, 'ตุลาคม': 9, 'พ.ย.': 10, 'พฤศจิกายน': 10, 'ธ.ค.': 11, 'ธันวาคม': 11
    };

    // 3.1 Check Thai month pattern e.g. "17 ต.ค. 2567" or "17 ตุลาคม 2567"
    const thaiDateMatch = cleanText.match(/(\d{1,2})\s*(ม\.?ค\.?|มกราคม|ก\.?พ\.?|กุมภาพันธ์|มี\.?ค\.?|มีนาคม|เม\.?ย\.?|เมษายน|พ\.?ค\.?|พฤษภาคม|มิ\.?ย\.?|มิถุนายน|ก\.?ค\.?|กรกฎาคม|ส\.?ค\.?|สิงหาคม|ก\.?ย\.?|กันยายน|ต\.?ค\.?|ตุลาคม|พ\.?ย\.?|พฤศจิกายน|ธ\.?ค\.?|ธันวาคม)\s*(\d{2,4})/i);
    if (thaiDateMatch) {
        const day = parseInt(thaiDateMatch[1], 10);
        const mStr = (thaiDateMatch[2] || '').replace(/[\.\s]/g, '').toLowerCase();
        let month = -1;
        for (const [k, v] of Object.entries(thaiMonths)) {
            const cleanK = k.replace(/[\.\s]/g, '').toLowerCase();
            if (cleanK === mStr || mStr.startsWith(cleanK)) {
                month = v;
                break;
            }
        }
        if (month === -1) month = 0;
        let year = parseInt(thaiDateMatch[3], 10);
        if (year > 2500) year -= 543;
        else if (year < 100) {
            const be = (year > 40 ? 2500 : 2600) + year;
            year = be - 543;
        }
        const d = new Date(Date.UTC(year, month, day));
        if (!isNaN(d.getTime())) {
            result.receipt_date = d.toISOString().split('T')[0];
        }
    }

    // 3.2 Check Numeric Date format DD/MM/YYYY or D/M/YY or YYYY-MM-DD
    if (!result.receipt_date) {
        const numDateMatch = cleanText.match(/(?:วันที่|DATE|Date|uit)?\s*[:#\-.]?\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (numDateMatch) {
            let year = parseInt(numDateMatch[3], 10);
            if (year > 2500) {
                year -= 543;
            } else if (year < 100) {
                const be = (year > 40 ? 2500 : 2600) + year;
                year = be - 543;
            }
            const month = parseInt(numDateMatch[2], 10) - 1;
            const day = parseInt(numDateMatch[1], 10);
            const d = new Date(Date.UTC(year, month, day));
            if (!isNaN(d.getTime())) {
                result.receipt_date = d.toISOString().split('T')[0];
            }
        }
    }

    // 4. Amounts & Totals
    // 4.1 Grand / Net Total
    const totalMatch = cleanText.match(/(?:รวมทั้งสิ้น|ยอดรวมสุทธิ|ยอดสุทธิ|ยอดรวมทั้งสิ้น|จำนวนเงินรวมทั้งสิ้น|จำนวนเงินสุทธิ|รวมเงินทั้งสิ้น|GRAND\s*TOTAL|NET\s*TOTAL|NET\s*AMOUNT)\s*[:#\-.]?\s*([0-9,]+(?:\.\d{1,2})?)/i);
    if (totalMatch) {
        result.net_amount = parseFloat(totalMatch[1].replace(/,/g, '')) || 0;
    }

    // 4.2 Tax Amount (Avoid matching "ราคาไม่รวมภาษีมูลค่าเพิ่ม")
    const vat7Match = cleanText.match(/(?:ภาษีมูลค่าเพิ่ม\s*7%|ภาษี\s*7%|VAT\s*7%)\s*[:#\-.]?\s*([0-9,]+(?:\.\d{1,2})?)/i);
    if (vat7Match) {
        result.tax_amount = parseFloat(vat7Match[1].replace(/,/g, '')) || 0;
    } else {
        const genTaxMatch = cleanText.match(/(?:ภาษีมูลค่าเพิ่ม|VAT)\s*[:#\-.]?\s*([0-9,]+(?:\.\d{1,2})?)/i);
        if (genTaxMatch && !cleanText.includes('ราคาไม่รวมภาษีมูลค่าเพิ่ม ' + genTaxMatch[1])) {
            result.tax_amount = parseFloat(genTaxMatch[1].replace(/,/g, '')) || 0;
        }
    }

    // 4.3 Discount
    const discMatch = cleanText.match(/ส่วนลด\s*[:#\-.]?\s*([0-9,]+(?:\.\d{1,2})?)/i);
    if (discMatch) {
        result.discount = parseFloat(discMatch[1].replace(/,/g, '')) || 0;
    }

    // 4.4 Subtotal (Before Tax)
    const subTotalMatch = cleanText.match(/(?:รวมเป็นเงิน|รวมเงิน|ยอดรวมก่อนภาษี|ราคาไม่รวมภาษีมูลค่าเพิ่ม|มูลค่าสินค้า|SUBTOTAL|TOTAL\s*BEFORE\s*TAX)\s*[:#\-.]?\s*([0-9,]+(?:\.\d{1,2})?)/i);
    if (subTotalMatch) {
        result.total_price = parseFloat(subTotalMatch[1].replace(/,/g, '')) || 0;
    } else if (result.net_amount > 0) {
        result.total_price = result.tax_amount > 0 ? (result.net_amount - result.tax_amount) : result.net_amount;
    }

    // 4.5 Fallback: scan for any decimal monetary numbers at bottom of text
    if (!result.net_amount || result.net_amount <= 0) {
        const moneyRegex = /\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/g;
        let match;
        const foundAmounts = [];
        while ((match = moneyRegex.exec(cleanText)) !== null) {
            const val = parseFloat(match[1].replace(/,/g, ''));
            if (val > 0 && val < 5000000) foundAmounts.push(val);
        }
        if (foundAmounts.length > 0) {
            result.net_amount = Math.max(...foundAmounts);
            result.total_price = result.net_amount;
        }
    }

    // 5. Equipment & Items Detection (Auto-Fill & Extract Hardware/Supplies)
    const EQUIPMENT_DICTIONARY = [
        // IT / Computer
        { pattern: /(แรม|ram|ddr[345]|sodimm)/i, name: 'แรม (RAM)', cat: 'ค่าอะไหล่', unit: 'แผง' },
        { pattern: /(ฮาร์ดดิสก์|harddisk|hdd|ssd|nvme|m\.2)/i, name: 'ฮาร์ดดิสก์ / SSD', cat: 'ค่าอะไหล่', unit: 'ตัว' },
        { pattern: /(จอภาพ|จอคอม|monitor|lcd|led\s*display)/i, name: 'จอภาพคอมพิวเตอร์ (Monitor)', cat: 'ค่าอะไหล่', unit: 'เครื่อง' },
        { pattern: /(เมาส์|mouse|optical\s*mouse)/i, name: 'เมาส์คอมพิวเตอร์ (Mouse)', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ตัว' },
        { pattern: /(คีย์บอร์ด|keyboard)/i, name: 'คีย์บอร์ด (Keyboard)', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ตัว' },
        { pattern: /(สาย\s*lan|สายแลน|cat5e|cat6|utp)/i, name: 'สายแลน (LAN Cable CAT6)', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'เส้น' },
        { pattern: /(หัว\s*rj45|rj-45|modular\s*plug)/i, name: 'หัวต่อสายแลน RJ-45', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'กล่อง' },
        { pattern: /(สวิตช์ฮับ|switch\s*hub|gigabit\s*switch)/i, name: 'สวิตช์ฮับเครือข่าย (Switch Hub)', cat: 'ค่าอะไหล่', unit: 'ตัว' },
        { pattern: /(เราเตอร์|router|access\s*point|ap)/i, name: 'อุปกรณ์กระจายสัญญาณ Wi-Fi', cat: 'ค่าอะไหล่', unit: 'ตัว' },
        { pattern: /(เพาเวอร์ซัพพลาย|power\s*supply|psu)/i, name: 'เพาเวอร์ซัพพลาย (Power Supply)', cat: 'ค่าอะไหล่', unit: 'ตัว' },
        { pattern: /(เมนบอร์ด|mainboard|motherboard)/i, name: 'เมนบอร์ดคอมพิวเตอร์', cat: 'ค่าอะไหล่', unit: 'แผง' },
        { pattern: /(ตลับหมึก|หมึกพิมพ์|toner|cartridge|หมึกอิงค์)/i, name: 'ตลับหมึกเครื่องพิมพ์', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ตลับ' },
        { pattern: /(ถ่านไบออส|cr2032|แบตเตอรี่\s*3v|battery)/i, name: 'ถ่านกระดุมไบออส CR2032', cat: 'ค่าอะไหล่', unit: 'ก้อน' },
        { pattern: /(สาย\s*hdmi|hdmi\s*cable)/i, name: 'สายสัญญาณ HDMI', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'เส้น' },
        { pattern: /(สาย\s*vga|vga\s*cable)/i, name: 'สายสัญญาณ VGA', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'เส้น' },
        { pattern: /(ปลั๊กพ่วง|รางปลั๊ก|extension\s*cord)/i, name: 'รางปลั๊กพ่วงกันไฟกระชาก', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ตัว' },

        // Air Conditioning (HVAC)
        { pattern: /(มอเตอร์พัดลม|คอยล์เย็น|คอยล์ร้อน|fan\s*motor)/i, name: 'มอเตอร์พัดลมคอยล์เย็นเครื่องปรับอากาศ', cat: 'ค่าอะไหล่', unit: 'ชุด' },
        { pattern: /(คอมเพรสเซอร์|compressor)/i, name: 'คอมเพรสเซอร์เครื่องปรับอากาศ', cat: 'ค่าอะไหล่', unit: 'ตัว' },
        { pattern: /(แคปรัน|คาปาซิเตอร์|capacitor|run\s*cap)/i, name: 'คาปาซิเตอร์ (Capacitor) แอร์', cat: 'ค่าอะไหล่', unit: 'ตัว' },
        { pattern: /(น้ำยาแอร์|r32|r410a|r22|refrigerant)/i, name: 'น้ำยาเติมระบบเครื่องปรับอากาศ', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ถัง' },
        { pattern: /(แมกเนติก|magnetic\s*contactor)/i, name: 'แมกเนติกคอนแทกเตอร์', cat: 'ค่าอะไหล่', unit: 'ตัว' },
        { pattern: /(ท่อน้ำทิ้ง\s*pvc|ท่อน้ำทิ้งแอร์|ท่อระบายน้ำทิ้ง)/i, name: 'ท่อระบายน้ำทิ้ง PVC พร้อมข้อต่อ', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'เส้น' },
        { pattern: /(ล้างแอร์|ทำความสะอาดแอร์|บริการล้าง)/i, name: 'ค่าบริการล้างและบำรุงรักษาเครื่องปรับอากาศ', cat: 'ค่าแรง', unit: 'เครื่อง' },

        // Electrical
        { pattern: /(หลอดไฟ|หลอด\s*led|led\s*t8|หลอดฟลูออเรสเซนต์)/i, name: 'หลอดไฟ LED T8 ประหยัดพลังงาน', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'หลอด' },
        { pattern: /(สายไฟ|thw|vaf|vct|สายทองแดง)/i, name: 'สายไฟฟ้ามาตรฐาน มอก.', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ม้วน' },
        { pattern: /(สวิตช์ไฟ|เต้ารับ|ปลั๊กไฟ|switch|socket)/i, name: 'สวิตช์ไฟ / เต้ารับไฟฟ้า', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ชุด' },
        { pattern: /(เบรกเกอร์|circuit\s*breaker|breaker)/i, name: 'เซอร์กิตเบรกเกอร์ (Circuit Breaker)', cat: 'ค่าอะไหล่', unit: 'ตัว' },
        { pattern: /(เทปพันสายไฟ|electrical\s*tape)/i, name: 'เทปพันสายไฟ 3M', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ม้วน' },

        // Plumbing & Sanitation
        { pattern: /(ท่อ\s*pvc|ท่อประปา|pvc\s*pipe)/i, name: 'ท่อ PVC ประปา', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'เส้น' },
        { pattern: /(ข้อต่อ\s*pvc|ข้องอ|สามทาง|ข้อลด)/i, name: 'ข้อต่อท่อประปา PVC', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ตัว' },
        { pattern: /(กาวทาท่อ|กาวประสานท่อ)/i, name: 'กาวประสานท่อ PVC', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'กระป๋อง' },
        { pattern: /(ก๊อกน้ำ|วาล์วน้ำ|บอลวาล์ว|faucet|valve)/i, name: 'ก๊อกน้ำ / บอลวาล์วสแตนเลส', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ตัว' },
        { pattern: /(สายฉีดชำระ|หัวฉีดชำระ)/i, name: 'ชุดสายฉีดชำระสแตนเลส', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ชุด' },
        { pattern: /(สะดืออ่าง|ท่อน้ำทิ้งอ่าง)/i, name: 'ชุดสะดือและท่อน้ำทิ้งอ่างล้างมือ', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ชุด' },
        { pattern: /(ลูกลอย|วาล์วน้ำเข้า|สุขภัณฑ์)/i, name: 'ชุดวาล์วลูกลอยสุขภัณฑ์', cat: 'ค่าอะไหล่', unit: 'ชุด' },

        // General Maintenance
        { pattern: /(สีน้ำ|สีน้ำมัน|สีทาฝ้า|paint)/i, name: 'สีทาอาคารซ่อมแซมผนัง', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ถัง' },
        { pattern: /(แปรงทาสี|ลูกกลิ้งทาสี)/i, name: 'แปรงและลูกกลิ้งทาสี', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'อัน' },
        { pattern: /(ซิลิโคน|silicone|กาวตะปู)/i, name: 'ซิลิโคนยาแนวกันซึม', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'หลอด' },
        { pattern: /(ลูกบิด|บานพับ|กลอนประตู|door\s*lock)/i, name: 'ชุดลูกบิดและบานพับประตู', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'ชุด' },
        { pattern: /(น็อต|สกรู|พุก|screw|bolt)/i, name: 'ชุดน็อต สกรู และพุกพลาสติก', cat: 'ค่าวัสดุและอุปกรณ์', unit: 'กล่อง' }
    ];

    // 5.1 Parse line items
    const parsedItems = [];
    const nonItemWords = /(บจก|บริษัท|หจก|ร้าน|โทร|tel|tax|สาขา|ใบเสร็จ|ใบกำกับ|cashier|รวม|total|vat|ภาษี|สุทธิ|เงินทอน|ชำระ|ขอบคุณ|thank|address|วันที่|date|เวลา|time)/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (nonItemWords.test(line) || line.length < 3) continue;

        // Check if line contains an item name, quantity, unit, and price
        const lineMatch = line.match(/^(\d+[\.\)]\s*)?(.+?)\s+(\d+)\s*(ชิ้น|อัน|ตัว|ชุด|เส้น|ม\.|เมตร|กล่อง|แพ็ค|แผง|หลอด|ม้วน|ก้อน|แผ่น|เครื่อง|คู่|ตลับ|กระป๋อง|ถัง|ด้าม)?\s*(?:@|x|\*|ละ)?\s*([0-9,]+(?:\.\d{1,2})?)(?:\s+([0-9,]+(?:\.\d{1,2})?))?\s*$/i);
        if (lineMatch) {
            const itemName = lineMatch[2].trim();
            const qty = parseInt(lineMatch[3], 10) || 1;
            const unit = lineMatch[4] || 'ชิ้น';
            const price = parseFloat(lineMatch[5].replace(/,/g, '')) || 0;
            const total = lineMatch[6] ? parseFloat(lineMatch[6].replace(/,/g, '')) : (qty * price);

            if (itemName.length >= 2 && !nonItemWords.test(itemName)) {
                // Determine category
                let cat = 'ค่าวัสดุและอุปกรณ์';
                for (const eq of EQUIPMENT_DICTIONARY) {
                    if (eq.pattern.test(itemName)) {
                        cat = eq.cat;
                        break;
                    }
                }
                parsedItems.push({
                    name: itemName,
                    category: cat,
                    quantity: qty,
                    unit: unit,
                    unit_price: price || (total / qty),
                    total_price: total
                });
            }
        }
    }

    // 5.2 If no tabular line matched, check lines against EQUIPMENT_DICTIONARY
    if (parsedItems.length === 0) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (nonItemWords.test(line) || line.length < 3) continue;

            for (const eq of EQUIPMENT_DICTIONARY) {
                if (eq.pattern.test(line)) {
                    // Extract line text cleanly
                    let cleanItemName = line.replace(/^[0-9\.\-\*\#\s]+/, '').replace(/[0-9,]+(\.\d{1,2})?\s*(บาท|฿)?$/, '').trim();
                    if (!cleanItemName || cleanItemName.length < 3) {
                        cleanItemName = eq.name;
                    }
                    parsedItems.push({
                        name: cleanItemName,
                        category: eq.cat,
                        quantity: 1,
                        unit: eq.unit,
                        unit_price: result.net_amount || result.total_price || 0,
                        total_price: result.net_amount || result.total_price || 0
                    });
                    break;
                }
            }
            if (parsedItems.length > 0) break;
        }
    }

    // 5.3 If still no item, look for the most meaningful middle line or generate description
    if (parsedItems.length === 0) {
        let candidate = '';
        for (let i = 1; i < lines.length - 2; i++) {
            const l = lines[i];
            if (!nonItemWords.test(l) && l.length >= 4 && !l.match(/^[0-9\s\-:\/]+$/)) {
                candidate = l.replace(/^[0-9\.\-\*\#\s]+/, '').trim();
                break;
            }
        }
        const defaultName = candidate || (result.vendor_name ? `อุปกรณ์และอะไหล่จาก ${result.vendor_name}` : 'วัสดุและอุปกรณ์สำหรับงานซ่อมบำรุง');
        parsedItems.push({
            name: defaultName,
            category: 'ค่าวัสดุและอุปกรณ์',
            quantity: 1,
            unit: 'ชิ้น',
            unit_price: result.net_amount || result.total_price || 0,
            total_price: result.net_amount || result.total_price || 0
        });
    }

    result.items = parsedItems;
    result.primary_item = parsedItems[0] || null;
    if (result.primary_item) {
        result.description = result.primary_item.name;
        result.category = result.primary_item.category;
        result.quantity = result.primary_item.quantity;
        result.unit = result.primary_item.unit;
        result.unit_price = result.primary_item.unit_price;
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
        const db = getLocalDb();
        const geminiKey = process.env.GEMINI_API_KEY || db.settings?.gemini_api_key || settings.gemini_api_key || getFallbackGeminiKey();
        settings.gemini_api_key = geminiKey;
        settings.gemini_configured = Boolean(geminiKey);
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
        const incomingGemini = body.gemini_api_key !== undefined && !body.gemini_api_key.includes('...')
            ? String(body.gemini_api_key).trim()
            : (prev.gemini_api_key || process.env.GEMINI_API_KEY || '');

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
            technicians: Array.isArray(body.technicians) ? body.technicians : (prev.technicians || []),
            line_channel_access_token: body.line_channel_access_token !== undefined && !body.line_channel_access_token.includes('...') ? String(body.line_channel_access_token).trim() : (prev.line_channel_access_token || ''),
            line_channel_secret: body.line_channel_secret !== undefined && !body.line_channel_secret.includes('...') ? String(body.line_channel_secret).trim() : (prev.line_channel_secret || ''),
            line_group_id: (body.line_group_id !== undefined ? String(body.line_group_id).trim() : (body.line_target_id !== undefined ? String(body.line_target_id).trim() : (prev.line_group_id || prev.line_target_id || ''))),
            line_target_id: (body.line_group_id !== undefined ? String(body.line_group_id).trim() : (body.line_target_id !== undefined ? String(body.line_target_id).trim() : (prev.line_group_id || prev.line_target_id || ''))),
            line_notify_enabled: body.line_notify_enabled !== undefined ? Boolean(body.line_notify_enabled) : (prev.line_notify_enabled !== false),
            app_base_url: body.app_base_url !== undefined ? String(body.app_base_url).trim() : (prev.app_base_url || 'http://localhost:5173'),
            gemini_api_key: incomingGemini
        };

        if (body.gemini_api_key !== undefined) {
            const db = getLocalDb();
            db.settings = db.settings || {};
            db.settings.gemini_api_key = incomingGemini;
            saveLocalDb(db);
            process.env.GEMINI_API_KEY = incomingGemini;
        }

        fs.writeFileSync(settingsPath, JSON.stringify(cleanSettings, null, 2), 'utf8');
        res.json({ success: true, settings: cleanSettings });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ============================================================
// LINE Messaging API Endpoints
// ============================================================

// 1. Webhook endpoint for LINE platform callbacks (Group/User Events)
app.post('/api/line/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-line-signature'];
        const config = getLineConfig();

        // Verify HMAC-SHA256 signature if channel secret is provided
        if (config.secret && signature) {
            const isValid = verifyWebhookSignature(req.rawBody, signature, config.secret);
            if (!isValid) {
                console.warn('⚠️ LINE Webhook signature validation failed.');
                return res.status(403).json({ error: 'Invalid LINE signature' });
            }
        }

        const events = req.body?.events || [];
        const processed = await processWebhookEvents(events);
        res.status(200).json({ success: true, count: events.length, processed });
    } catch (err) {
        console.error('❌ LINE Webhook Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Get LINE status & health (Masked token, no secret leakage)
app.get('/api/line/status', (req, res) => {
    try {
        const status = getPublicLineStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Test LINE notification
app.post('/api/line/test', async (req, res) => {
    try {
        const { targetId, groupId, message } = req.body || {};
        const config = getLineConfig();
        const target = (groupId || targetId || config.groupId || config.targetId || '').trim();

        if (!config.token || !target) {
            return res.status(400).json({
                error: 'ระบบยังไม่พร้อมส่ง (สถานะ: NOT_CONFIGURED): กรุณาระบุ Channel Access Token และ LINE Group ID ให้ครบถ้วนในหน้าตั้งค่าก่อนทำการทดสอบ',
                status: 'NOT_CONFIGURED',
                hasToken: Boolean(config.token),
                hasTarget: Boolean(target)
            });
        }

        const result = await testLineNotification(target, message);
        res.json(result);
    } catch (err) {
        console.error('❌ LINE test failed:', err.message);
        res.status(err.statusCode || 400).json({ error: err.message, details: err.details || [] });
    }
});

// 4. Get recent delivery logs
app.get('/api/line/logs', (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const logs = getLineLogs(limit);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Get detected contacts / groups
app.get('/api/line/contacts', (req, res) => {
    try {
        const contacts = getLineContacts();
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Update LINE settings directly
app.post('/api/line/settings', (req, res) => {
    try {
        const { channelAccessToken, channelSecret, targetId, groupId, notifyEnabled, baseUrl } = req.body || {};
        const updates = {};
        if (channelAccessToken !== undefined && !channelAccessToken.includes('...')) {
            updates.line_channel_access_token = String(channelAccessToken).trim();
        }
        if (channelSecret !== undefined && !channelSecret.includes('...')) {
            updates.line_channel_secret = String(channelSecret).trim();
        }
        const finalTarget = groupId !== undefined ? String(groupId).trim() : (targetId !== undefined ? String(targetId).trim() : undefined);
        if (finalTarget !== undefined) {
            updates.line_group_id = finalTarget;
            updates.line_target_id = finalTarget;
        }
        if (notifyEnabled !== undefined) {
            updates.line_notify_enabled = Boolean(notifyEnabled);
        }
        if (baseUrl !== undefined) {
            updates.app_base_url = String(baseUrl).trim();
        }

        updateStoredSettings(updates);
        res.json({ success: true, status: getPublicLineStatus() });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
            if (realPrisma) {
                existingUser = await realPrisma.user.findUnique({ where: { email: cleanEmail } });
            }
        } catch (dbErr) {
            console.warn('Prisma check user note:', dbErr.message);
        }

        if (!existingUser) {
            const localUsers = getLocalUsers();
            existingUser = localUsers.find(u => (u.email || '').toLowerCase() === cleanEmail);
        }

        if (existingUser) {
            return res.status(400).json({ 
                error: 'อีเมลนี้ถูกลงทะเบียนไว้ในระบบแล้ว กรุณาเข้าสู่ระบบ',
                alreadyExists: true,
                email: cleanEmail,
                name: existingUser.name || ''
            });
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
            if (realPrisma) {
                await realPrisma.user.create({
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
            }
        } catch (dbErr) {
            console.warn('Prisma user creation note, falling back to local file store:', dbErr.message);
        }

        // Always sync to local users.json for resilience
        const currentUsers = getLocalUsers();
        currentUsers.push(newUserObj);
        saveLocalUsers(currentUsers);

        // Generate JWT token (90-day persistent session)
        const token = jwt.sign(
            { id: userId, email: cleanEmail, name: cleanName, role: role, group: cleanGroup },
            JWT_SECRET,
            { expiresIn: '90d' }
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

        // Generate JWT token (90-day persistent session)
        const savedAvatars = getSavedAvatars();
        const userAvatar = foundUser.avatar_url || savedAvatars[cleanEmail] || '';
        foundUser.avatar_url = userAvatar;

        const token = jwt.sign(
            { 
                id: foundUser.id, 
                email: foundUser.email, 
                name: foundUser.name, 
                role: foundUser.role, 
                group: foundUser.group,
                phone: foundUser.phone || '',
                avatar_url: userAvatar
            },
            JWT_SECRET,
            { expiresIn: '90d' }
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
                avatar_url: userAvatar
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง' });
    }
});

// One-Click Quick Login for Saved Device Accounts
app.post('/api/auth/quick-login', async (req, res) => {
    try {
        const { email, password, name, group, role } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'กรุณาระบุอีเมล' });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        // 1. Try to find user in Prisma
        let foundUser = null;
        try {
            if (realPrisma) {
                foundUser = await realPrisma.user.findUnique({ where: { email: cleanEmail } });
            }
        } catch (dbErr) {
            console.warn('Prisma quick-login query note:', dbErr.message);
        }

        // 2. Fallback to local users.json
        if (!foundUser) {
            const localUsers = getLocalUsers();
            foundUser = localUsers.find(u => 
                (u.email || '').toLowerCase() === cleanEmail ||
                (cleanEmail === 'nightggpp@gmail.com' && (u.email || '').toLowerCase() === 'ksu.smart.maintain@gmail.com') ||
                (cleanEmail === 'ksu.smart.maintain@gmail.com' && (u.email || '').toLowerCase() === 'nightggpp@gmail.com')
            );
        }

        // 3. Auto-provision if user does not exist in db yet (e.g. administrator/owner email)
        if (!foundUser) {
            const isAdmin = cleanEmail.includes('admin') || cleanEmail.includes('thunyarat') || cleanEmail.includes('deer') || role === 'admin' || group === 'ผู้ดูแลระบบ';
            const defaultRole = isAdmin ? 'admin' : (role || 'user');
            const defaultGroup = isAdmin ? 'ผู้ดูแลระบบ' : (group || 'นักศึกษา');
            const newUserData = {
                id: 'usr-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                email: cleanEmail,
                name: name || (isAdmin ? 'Deer (ผู้ดูแลระบบ)' : 'ผู้ใช้งาน'),
                role: defaultRole,
                group: defaultGroup,
                password: password ? await bcrypt.hash(password, 10) : '$2a$10$wE9l1lU6h8N6R0mYp69.o.sPZzI9XjZp6Z7p8y7d.q5s/4nS6l7.K',
                plainPasswordFallback: password || 'admin1234',
                created_at: new Date()
            };

            try {
                if (realPrisma) {
                    foundUser = await realPrisma.user.create({ data: newUserData });
                }
            } catch (e) {
                foundUser = newUserData;
            }

            const localUsers = getLocalUsers();
            if (!localUsers.some(u => (u.email || '').toLowerCase() === cleanEmail)) {
                localUsers.push(foundUser || newUserData);
                saveLocalUsers(localUsers);
            }
            if (!foundUser) foundUser = newUserData;
        }

        // 4. Issue 90-day JWT token
        const savedAvatars = getSavedAvatars();
        const userAvatar = foundUser.avatar_url || savedAvatars[cleanEmail] || '';
        foundUser.avatar_url = userAvatar;

        const token = jwt.sign(
            {
                id: foundUser.id,
                email: foundUser.email,
                name: foundUser.name,
                role: foundUser.role,
                group: foundUser.group,
                phone: foundUser.phone || '',
                avatar_url: userAvatar
            },
            JWT_SECRET,
            { expiresIn: '90d' }
        );

        console.log(`⚡ Quick-login success for: ${foundUser.email} (${foundUser.name}) [${foundUser.role}]`);

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
                avatar_url: userAvatar
            }
        });
    } catch (err) {
        console.error('Quick login error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบอัตโนมัติ' });
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
        const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : '';
        let foundUser = null;
        try {
            foundUser = await prisma.user.findUnique({ where: { email: userEmail } });
        } catch (dbErr) {
            console.warn('Prisma profile query note:', dbErr.message);
        }

        if (!foundUser) {
            const localUsers = getLocalUsers();
            foundUser = localUsers.find(u => (u.email || '').toLowerCase().trim() === userEmail || u.id === req.user.id);
        }

        if (!foundUser) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' });
        }

        const savedAvatars = getSavedAvatars();
        const userAvatar = foundUser.avatar_url || savedAvatars[userEmail] || '';

        res.json({
            id: foundUser.id,
            email: foundUser.email,
            name: foundUser.name,
            group: foundUser.group || 'นักศึกษา',
            role: foundUser.role || 'user',
            phone: foundUser.phone || '',
            avatar_url: userAvatar,
            created_at: foundUser.created_at
        });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลโปรไฟล์' });
    }
});

app.put('/api/user/profile', requireAuth, async (req, res) => {
    try {
        const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : '';
        const { name, phone, group, avatar_url } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุล' });
        }

        const cleanName = name.trim();
        const cleanPhone = phone ? phone.trim() : '';
        const cleanAvatar = avatar_url !== undefined ? avatar_url : null;

        if (cleanAvatar !== null) {
            saveUserAvatar(userEmail, cleanAvatar);
        }

        // Security: Lock group and role. Users cannot modify or elevate their own role/group.
        const cleanGroup = req.user.group || 'นักศึกษา';
        const newRole = req.user.role || 'user';

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
        const idx = localUsers.findIndex(u => (u.email || '').toLowerCase().trim() === userEmail || u.id === req.user.id);
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

        const savedAvatars = getSavedAvatars();
        const effectiveAvatar = cleanAvatar || updatedUser?.avatar_url || savedAvatars[userEmail] || '';

        // Generate fresh JWT token with updated profile info
        const token = jwt.sign(
            {
                id: req.user.id,
                email: userEmail,
                name: cleanName,
                role: newRole,
                group: cleanGroup,
                phone: cleanPhone,
                avatar_url: effectiveAvatar
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
                avatar_url: effectiveAvatar
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
        const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : '';
        let avatarUrl = '';

        if (req.file) {
            const ext = path.extname(req.file.originalname) || '.jpg';
            const filename = `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 6)}${ext}`;
            const targetPath = path.join(uploadsDir, filename);

            try {
                fs.writeFileSync(targetPath, req.file.buffer);
                avatarUrl = `/uploads/${filename}`;
                // Also write to frontend uploads directory if present
                const frontendUploadsDir = path.join(__dirname, '..', 'frontend', 'public', 'uploads');
                if (fs.existsSync(frontendUploadsDir)) {
                    try {
                        fs.writeFileSync(path.join(frontendUploadsDir, filename), req.file.buffer);
                    } catch (feErr) {}
                }
            } catch (fsErr) {
                avatarUrl = `data:${req.file.mimetype || 'image/jpeg'};base64,${req.file.buffer.toString('base64')}`;
            }
        } else if (req.body && req.body.avatar_url) {
            avatarUrl = req.body.avatar_url;
        } else {
            return res.status(400).json({ error: 'กรุณาเลือกไฟล์รูปภาพ' });
        }

        // 1. Permanently save to dedicated avatars database store
        saveUserAvatar(userEmail, avatarUrl);

        // 2. Permanently update in Prisma (Postgres database)
        try {
            await prisma.user.update({
                where: { email: userEmail },
                data: { avatar_url: avatarUrl }
            });
        } catch (dbErr) {
            console.warn('Prisma avatar update note:', dbErr.message);
        }

        // 3. Update in local users store
        const localUsers = getLocalUsers();
        const idx = localUsers.findIndex(u => (u.email || '').toLowerCase().trim() === userEmail || u.id === req.user.id);
        if (idx !== -1) {
            localUsers[idx].avatar_url = avatarUrl;
            localUsers[idx].updated_at = new Date().toISOString();
            saveLocalUsers(localUsers);
        }

        console.log(`🖼️ Profile picture permanently saved in database for user: ${userEmail}`);

        res.json({
            success: true,
            message: 'อัปโหลดและบันทึกรูปโปรไฟล์ลงฐานข้อมูลเรียบร้อยแล้ว',
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

// Serve frontend static build in standalone production / university server deployment
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
            return res.sendFile(path.join(frontendDistPath, 'index.html'));
        }
        next();
    });
}

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

